import express from "express"
import type { Request, Response, Router, NextFunction } from "express"
// archiver v8 est un module ESM qui exporte des classes (plus de fonction
// factory `archiver("zip")`) : on instancie donc directement ZipArchive.
import { ZipArchive } from "archiver"
import { prisma } from "../../prisma/singletonPrisma.js"
import { authMiddleware } from "../middleware/authMiddleware.js"
import { requireAdmin } from "../middleware/requireAdmin.js"
import { buildDayWindow, localDayKey } from "../utils/dayWindow.js"
import { TVA_RATE } from "../infrastructure/pdf/invoicePDF.js"
import { getUsdToEurRate, convertUsdToEur } from "../utils/currency.js"
import { Subscription } from "../services/classSubscription.js"

const router: Router = express.Router()

const VALID_ROLES = new Set(["ADMIN", "JURISTE", "USER", "LECTEUR"])

/** GET /admin/users — liste tous les utilisateurs (mono-entreprise). */
router.get("/users", authMiddleware, requireAdmin, async (_req: Request, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            select: { idUser: true, email: true, nom: true, prenom: true, role: true, isVerified: true, isBanned: true },
            orderBy: { idUser: "asc" },
        })
        return res.json({ success: true, data: users })
    } catch (err) {
        console.error("[admin] list users error:", err);
        return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
})

/** PATCH /admin/users/:idUser/role — change le rôle d'un utilisateur. */
router.patch("/users/:idUser/role", authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const targetId = Number(req.params["idUser"])
        const { role } = req.body as { role?: string }
        if (!role || !VALID_ROLES.has(role)) {
            return res.status(400).json({ success: false, message: "Rôle invalide." })
        }
        // Garde-fou : un admin ne peut pas se rétrograder lui-même (évite de perdre le dernier admin).
        if (targetId === Number(req.idUser) && role !== "ADMIN") {
            return res.status(400).json({ success: false, message: "Vous ne pouvez pas modifier votre propre rôle d'administrateur." })
        }
        const target = await prisma.user.findUnique({ where: { idUser: targetId }, select: { idUser: true } })
        if (!target) return res.status(404).json({ success: false, message: "Utilisateur introuvable." })

        await prisma.user.update({ where: { idUser: targetId }, data: { role: role as "ADMIN" | "JURISTE" | "USER" | "LECTEUR" } })
        return res.json({ success: true })
    } catch (err) {
        console.error("[admin] update role error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

/** GET /admin/revenue — tableau de bord financier (abonnements, factures, KPIs, MRR). */
router.get("/revenue", authMiddleware, requireAdmin, async (_req: Request, res: Response) => {
    try {
        const subscriptions = await prisma.subscription.findMany({
            include: {
                user: { select: { idUser: true, email: true, nom: true, prenom: true } },
                plan: true,
                facture: { orderBy: { createdAt: "desc" } },
            },
            orderBy: { startAt: "desc" },
        })

        // Seuls les paiements réussis comptent dans les revenus.
        const PAID = { status: "PAID" } as const

        const now = new Date()
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const dayOfWeek = startOfToday.getDay()
        const startOfWeek = new Date(startOfToday)
        startOfWeek.setDate(startOfToday.getDate() + (dayOfWeek === 0 ? -6 : 1 - dayOfWeek))
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

        const [totalRevenue, revenueToday, revenueWeek, revenueMonth, activeCount] = await Promise.all([
            prisma.facture.aggregate({ _sum: { price: true }, where: PAID }),
            prisma.facture.aggregate({ _sum: { price: true }, where: { ...PAID, createdAt: { gte: startOfToday } } }),
            prisma.facture.aggregate({ _sum: { price: true }, where: { ...PAID, createdAt: { gte: startOfWeek } } }),
            prisma.facture.aggregate({ _sum: { price: true }, where: { ...PAID, createdAt: { gte: startOfMonth } } }),
            prisma.subscription.count({ where: { status: "ACTIVE" } }),
        ])

        // MRR : somme des plans actifs normalisée au mois (annuel → price / 12).
        const activeSubs = subscriptions.filter((s) => s.status === "ACTIVE")
        const monthlyOf = (subs: typeof activeSubs) =>
            subs.reduce((sum, s) => sum + (s.plan.interval === "yearly" ? s.plan.price / 12 : s.plan.price), 0)
        const mrr = Math.round(monthlyOf(activeSubs))
        // Prévision : abonnements actifs encore valides au début du mois prochain
        // (scénario "aucun renouvellement, aucune nouvelle souscription").
        const mrrForecast = Math.round(monthlyOf(activeSubs.filter((s) => s.expiresAt > startOfNextMonth)))

        // Revenus groupés par nom de plan (paiements réussis uniquement)
        const revenueByPlan: Record<string, { count: number; revenue: number }> = {}
        for (const sub of subscriptions) {
            const planName = sub.plan.name
            if (!revenueByPlan[planName]) revenueByPlan[planName] = { count: 0, revenue: 0 }
            if (sub.status === "ACTIVE") revenueByPlan[planName].count++
            revenueByPlan[planName].revenue += sub.facture
                .filter((f) => f.status !== "FAILED")
                .reduce((s, f) => s + f.price, 0)
        }

        // Dernières factures (30 dernières, échecs inclus — le front affiche le statut)
        const recentFactures = await prisma.facture.findMany({
            take: 30,
            orderBy: { createdAt: "desc" },
            include: {
                subscription: {
                    include: {
                        user: { select: { email: true, nom: true, prenom: true } },
                        plan: { select: { name: true } },
                    },
                },
            },
        })

        return res.json({
            success: true,
            data: {
                subscriptions,
                totalRevenue: Number(totalRevenue._sum.price ?? 0),
                activeCount,
                revenueByPlan,
                recentFactures,
                kpis: {
                    revenueToday: Number(revenueToday._sum.price ?? 0),
                    revenueWeek: Number(revenueWeek._sum.price ?? 0),
                    revenueMonth: Number(revenueMonth._sum.price ?? 0),
                    mrr,
                    mrrForecast,
                    activeCount,
                },
            },
        })
    } catch (err) {
        console.error("[admin] revenue error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

/** PATCH /admin/users/:idUser/ban — bannit ou débannit un utilisateur. */
router.patch("/users/:idUser/ban", authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const targetId = Number(req.params["idUser"])
        if (Number.isNaN(targetId)) {
            return res.status(400).json({ success: false, message: "ID invalide." })
        }
        if (targetId === Number(req.idUser)) {
            return res.status(400).json({ success: false, message: "Vous ne pouvez pas vous bannir vous-même." })
        }
        const { banned } = req.body as { banned?: unknown }
        if (typeof banned !== "boolean") {
            return res.status(400).json({ success: false, message: "Le champ banned doit être un booléen." })
        }
        const target = await prisma.user.findUnique({ where: { idUser: targetId }, select: { idUser: true } })
        if (!target) return res.status(404).json({ success: false, message: "Utilisateur introuvable." })

        await prisma.user.update({ where: { idUser: targetId }, data: { isBanned: banned } })
        return res.json({ success: true, isBanned: banned })
    } catch (err) {
        console.error("[admin] ban user error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

/** GET /admin/feature-usage — statistiques d'usage des fonctionnalités par période. */
router.get("/feature-usage", authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const days = Math.min(Math.max(Number(req.query["days"]) || 30, 1), 1825)
        // Fenêtre commune à tous les graphes journaliers (voir dayWindow.ts) :
        // début à minuit local, jours en heure locale, zéro-remplie.
        const { from, keys } = buildDayWindow(days)

        // 1. Résumé par feature
        const featureCounts = await prisma.featureUsage.groupBy({
            by: ["feature"],
            where: { createdAt: { gte: from } },
            _count: { id: true },
            orderBy: { _count: { id: "desc" } },
        })
        const summary = featureCounts.map((f) => ({ feature: f.feature, count: f._count.id }))

        // 2. Timeline par jour, zéro-remplie et découpée en heure locale
        const events = await prisma.featureUsage.findMany({
            where: { createdAt: { gte: from } },
            select: { feature: true, createdAt: true },
            orderBy: { createdAt: "asc" },
        })
        const byDay: Record<string, Record<string, number>> = {}
        for (const key of keys) byDay[key] = {}
        for (const e of events) {
            const day = localDayKey(e.createdAt)
            if (!byDay[day]) continue // hors fenêtre (sécurité)
            byDay[day][e.feature] = (byDay[day][e.feature] ?? 0) + 1
        }
        const timeline = keys.map((date) => ({ date, ...byDay[date] }))

        // 3. Tous les utilisateurs actifs sur la période (triés par volume)
        const userGroups = await prisma.featureUsage.groupBy({
            by: ["userId"],
            where: { createdAt: { gte: from }, userId: { not: null } },
            _count: { id: true },
            orderBy: { _count: { id: "desc" } },
        })
        const userIds = userGroups.map((g) => g.userId!).filter(Boolean)
        const [users, userFeatures] = await Promise.all([
            prisma.user.findMany({
                where: { idUser: { in: userIds } },
                select: { idUser: true, email: true, nom: true, prenom: true },
            }),
            userIds.length > 0
                ? prisma.featureUsage.groupBy({
                    by: ["userId", "feature"],
                    where: { createdAt: { gte: from }, userId: { in: userIds } },
                    _count: { id: true },
                })
                : Promise.resolve([]),
        ])
        const topUsers = userGroups.map((g) => {
            const user = users.find((u) => u.idUser === g.userId)
            const byFeature = (userFeatures as { userId: number | null; feature: string; _count: { id: number } }[])
                .filter((f) => f.userId === g.userId)
                .reduce<Record<string, number>>((acc, f) => ({ ...acc, [f.feature]: f._count.id }), {})
            return {
                userId: g.userId!,
                email: user?.email ?? "?",
                nom: user?.nom ?? null,
                prenom: user?.prenom ?? null,
                total: g._count.id,
                byFeature,
            }
        })

        return res.json({ success: true, data: { summary, timeline, topUsers, days } })
    } catch (err) {
        console.error("[admin] feature-usage error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

/** GET /admin/feature-usage/users/:idUser — détail complet de l'activité d'un utilisateur. */
router.get("/feature-usage/users/:idUser", authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const targetId = Number(req.params["idUser"])
        if (Number.isNaN(targetId)) {
            return res.status(400).json({ success: false, message: "ID invalide." })
        }
        const days = Math.min(Math.max(Number(req.query["days"]) || 30, 1), 1825)
        // Mêmes conventions que le graphe global (voir dayWindow.ts).
        const { from, keys } = buildDayWindow(days)

        const user = await prisma.user.findUnique({
            where: { idUser: targetId },
            select: { idUser: true, email: true, nom: true, prenom: true, role: true, isBanned: true },
        })
        if (!user) return res.status(404).json({ success: false, message: "Utilisateur introuvable." })

        const events = await prisma.featureUsage.findMany({
            where: { userId: targetId, createdAt: { gte: from } },
            select: { feature: true, createdAt: true },
            orderBy: { createdAt: "asc" },
        })

        // Résumé par feature + timeline par jour (locale, zéro-remplie)
        const byFeature: Record<string, number> = {}
        const byDay: Record<string, Record<string, number>> = {}
        for (const key of keys) byDay[key] = {}
        for (const e of events) {
            byFeature[e.feature] = (byFeature[e.feature] ?? 0) + 1
            const day = localDayKey(e.createdAt)
            if (!byDay[day]) continue // hors fenêtre (sécurité)
            byDay[day][e.feature] = (byDay[day][e.feature] ?? 0) + 1
        }
        const summary = Object.entries(byFeature)
            .map(([feature, count]) => ({ feature, count }))
            .sort((a, b) => b.count - a.count)
        const timeline = keys.map((date) => ({ date, ...byDay[date] }))

        // 50 derniers événements (les plus récents en premier)
        const recentEvents = events
            .slice(-50)
            .reverse()
            .map((e) => ({ feature: e.feature, createdAt: e.createdAt }))

        return res.json({
            success: true,
            data: {
                user,
                total: events.length,
                firstActivity: events[0]?.createdAt ?? null,
                lastActivity: events[events.length - 1]?.createdAt ?? null,
                summary,
                timeline,
                recentEvents,
                days,
            },
        })
    } catch (err) {
        console.error("[admin] feature-usage user detail error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

/** GET /admin/users/:idUser/details — profil complet d'un utilisateur. */
router.get("/users/:idUser/details", authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const targetId = Number(req.params["idUser"])
        if (Number.isNaN(targetId)) {
            return res.status(400).json({ success: false, message: "ID invalide." })
        }
        const user = await prisma.user.findUnique({
            where: { idUser: targetId },
            select: {
                idUser: true,
                email: true,
                nom: true,
                prenom: true,
                role: true,
                isVerified: true,
                twoFactorEnabled: true,
                isBanned: true,
                subscription: {
                    select: {
                        status: true,
                        startAt: true,
                        expiresAt: true,
                        plan: { select: { name: true, price: true, interval: true, creditsIncluded: true } },
                        facture: { select: { price: true }, where: { status: "PAID" } },
                    },
                },
                enterprise: {
                    select: {
                        name: true,
                        siren: true,
                        statusJuridique: true,
                        address: { select: { address: true, codePostal: true, pays: true } },
                    },
                },
                userCredit: { select: { quotas: true } },
                _count: {
                    select: { contracts: true, signatureEnvelopes: true, contractHistory: true },
                },
            },
        })
        if (!user) return res.status(404).json({ success: false, message: "Utilisateur introuvable." })

        const totalPaid = user.subscription?.facture.reduce((s, f) => s + f.price, 0) ?? 0
        const invoiceCount = user.subscription?.facture.length ?? 0

        return res.json({
            success: true,
            data: {
                ...user,
                subscription: user.subscription
                    ? { ...user.subscription, totalPaid, invoiceCount, facture: undefined }
                    : null,
            },
        })
    } catch (err) {
        console.error("[admin] user details error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

/** GET /admin/overview — vue d'ensemble : utilisateurs actifs, conversion, alertes coût, crédits. */
router.get("/overview", authMiddleware, requireAdmin, async (_req: Request, res: Response) => {
    try {
        const now = new Date()
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const d1 = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
        const d7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        const d30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

        const [
            totalUsers,
            verifiedUsers,
            activeD1,
            activeD7,
            activeD30,
            activeSubs,
            todayCost,
            creditRows,
        ] = await Promise.all([
            // Counts utilisateurs
            prisma.user.count(),
            prisma.user.count({ where: { isVerified: true } }),

            // Utilisateurs actifs (FeatureUsage comme proxy)
            prisma.featureUsage.findMany({
                where: { createdAt: { gte: d1 }, userId: { not: null } },
                select: { userId: true },
                distinct: ["userId"],
            }).then((r) => r.length),
            prisma.featureUsage.findMany({
                where: { createdAt: { gte: d7 }, userId: { not: null } },
                select: { userId: true },
                distinct: ["userId"],
            }).then((r) => r.length),
            prisma.featureUsage.findMany({
                where: { createdAt: { gte: d30 }, userId: { not: null } },
                select: { userId: true },
                distinct: ["userId"],
            }).then((r) => r.length),

            // Abonnements actifs
            prisma.subscription.count({ where: { status: "ACTIVE" } }),

            // Coût LLM aujourd'hui
            prisma.llmUsage.aggregate({
                where: { startAt: { gte: startOfToday } },
                _sum: { totalCostUsd: true },
            }).then((r) => Number(r._sum.totalCostUsd ?? 0)),

            // Quotas restants par utilisateur (avec infos user + plan)
            prisma.userCredit.findMany({
                include: {
                    user: {
                        select: {
                            idUser: true,
                            email: true,
                            nom: true,
                            prenom: true,
                            subscription: {
                                select: { plan: { select: { creditsIncluded: true } } },
                            },
                        },
                    },
                },
                orderBy: { idUserCredit: "asc" },
            }),
        ])

        const threshold = Number(process.env.COST_ALERT_USD ?? 2)

        const credits = creditRows.map((c) => ({
            userId: c.user.idUser,
            email: c.user.email,
            nom: c.user.nom,
            prenom: c.user.prenom,
            // Quotas restants de l'utilisateur (structure par feature)
            quotas: c.quotas,
            // Quotas pleins du plan (référence pour la conso)
            planQuotas: c.user.subscription?.plan.creditsIncluded ?? null,
        }))

        return res.json({
            success: true,
            data: {
                users: { total: totalUsers, verified: verifiedUsers, active: { d1: activeD1, d7: activeD7, d30: activeD30 } },
                conversion: { withActiveSub: activeSubs, total: totalUsers, rate: totalUsers > 0 ? Math.round((activeSubs / totalUsers) * 1000) / 10 : 0 },
                costAlert: { todayUsd: todayCost, threshold, exceeded: todayCost > threshold },
                credits,
            },
        })
    } catch (err) {
        console.error("[admin] overview error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

// ════════════════════════════════════════════════════════════════════════════
// FISCALITÉ — récapitulatif TVA mensuel + export des factures d'un mois
// ════════════════════════════════════════════════════════════════════════════

const MONTH_LABELS = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
]

// Version sans accent, sûre pour les noms de fichiers (ZIP, PDF).
const MONTH_SLUGS = [
    "janvier", "fevrier", "mars", "avril", "mai", "juin",
    "juillet", "aout", "septembre", "octobre", "novembre", "decembre",
]

/**
 * À partir d'un montant TTC (en centimes), déduit la base HT et la TVA.
 * Le prix stocké dans Facture est toujours TTC ; la TVA n'est jamais stockée,
 * elle se recalcule au taux fixe TVA_RATE (même règle que le PDF de facture).
 * Renvoie des euros (nombres décimaux), pas des centimes.
 */
function breakdownTtcCents(ttcCents: number): { ht: number; tva: number; ttc: number } {
    const ttc = ttcCents / 100
    const ht = ttc / (1 + TVA_RATE)
    const tva = ttc - ht
    return { ht, tva, ttc }
}

/** Valide et borne l'année demandée (défaut : année courante). */
function parseYear(raw: unknown): number {
    const year = Number(raw)
    if (!Number.isInteger(year) || year < 2020 || year > 2100) {
        return new Date().getFullYear()
    }
    return year
}

/** Valide le mois demandé (1–12). Renvoie null si invalide. */
function parseMonth(raw: unknown): number | null {
    const month = Number(raw)
    if (!Number.isInteger(month) || month < 1 || month > 12) return null
    return month
}

/**
 * GET /admin/fiscalite?year=YYYY
 * Récapitulatif fiscal par mois pour l'année demandée :
 *  - Ventes (TVA collectée) : base HT, TVA 20 %, TTC, nombre de factures payées.
 *  - LLM (TVA autoliquidée) : coût USD → EUR, TVA 20 % notionnelle. Cette TVA est
 *    neutre à payer (autoliquidation), elle sert seulement à la déclaration.
 */
router.get("/fiscalite", authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const year = parseYear(req.query["year"])
        const startOfYear = new Date(year, 0, 1)
        const startOfNextYear = new Date(year + 1, 0, 1)

        // 1. Ventes de l'année : uniquement les paiements réussis (revenus réels).
        const factures = await prisma.facture.findMany({
            where: { status: "PAID", createdAt: { gte: startOfYear, lt: startOfNextYear } },
            select: { price: true, createdAt: true },
        })

        // 2. Coûts LLM de l'année (dépense en USD), datés par startAt.
        const llmUsages = await prisma.llmUsage.findMany({
            where: { startAt: { gte: startOfYear, lt: startOfNextYear } },
            select: { totalCostUsd: true, startAt: true },
        })

        // 3. Un accumulateur par mois (12 cases, index 0 = janvier).
        const months = MONTH_LABELS.map((label, index) => ({
            month: index + 1,
            label,
            ventesHt: 0,
            ventesTva: 0,
            ventesTtc: 0,
            facturesCount: 0,
            llmCostUsd: 0,
            llmCostEur: 0,
            llmTvaEur: 0, // TVA autoliquidée (neutre à payer)
        }))

        for (const facture of factures) {
            const bucket = months[facture.createdAt.getMonth()]
            const { ht, tva, ttc } = breakdownTtcCents(facture.price)
            bucket.ventesHt += ht
            bucket.ventesTva += tva
            bucket.ventesTtc += ttc
            bucket.facturesCount += 1
        }

        for (const usage of llmUsages) {
            const bucket = months[usage.startAt.getMonth()]
            const costUsd = Number(usage.totalCostUsd)
            const costEur = convertUsdToEur(costUsd)
            bucket.llmCostUsd += costUsd
            bucket.llmCostEur += costEur
            bucket.llmTvaEur += costEur * TVA_RATE
        }

        // 4. Totaux annuels.
        const totals = months.reduce(
            (acc, m) => ({
                ventesHt: acc.ventesHt + m.ventesHt,
                ventesTva: acc.ventesTva + m.ventesTva,
                ventesTtc: acc.ventesTtc + m.ventesTtc,
                facturesCount: acc.facturesCount + m.facturesCount,
                llmCostUsd: acc.llmCostUsd + m.llmCostUsd,
                llmCostEur: acc.llmCostEur + m.llmCostEur,
                llmTvaEur: acc.llmTvaEur + m.llmTvaEur,
            }),
            { ventesHt: 0, ventesTva: 0, ventesTtc: 0, facturesCount: 0, llmCostUsd: 0, llmCostEur: 0, llmTvaEur: 0 },
        )

        return res.json({
            success: true,
            data: {
                year,
                usdToEurRate: getUsdToEurRate(),
                tvaRate: TVA_RATE,
                months,
                totals,
            },
        })
    } catch (err) {
        console.error("[admin] fiscalite error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

/**
 * Récupère les factures payées d'un mois donné (année + mois), les plus récentes
 * d'abord, avec les infos nécessaires à l'export (client, plan).
 */
async function findPaidFacturesOfMonth(year: number, month: number) {
    const startOfMonth = new Date(year, month - 1, 1)
    const startOfNextMonth = new Date(year, month, 1)
    return prisma.facture.findMany({
        where: { status: "PAID", createdAt: { gte: startOfMonth, lt: startOfNextMonth } },
        orderBy: { createdAt: "desc" },
        include: {
            subscription: {
                include: {
                    plan: { select: { name: true, interval: true } },
                    user: { select: { email: true, nom: true, prenom: true } },
                },
            },
        },
    })
}

/** Formate un nombre en euros à la française pour un CSV (virgule décimale). */
function formatEurForCsv(amount: number): string {
    return amount.toFixed(2).replace(".", ",")
}

/** Échappe une valeur pour un CSV séparé par point-virgule. */
function csvCell(value: string): string {
    // Guillemets si la valeur contient un séparateur, un guillemet ou un saut de ligne.
    if (/[";\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`
    }
    return value
}

/**
 * GET /admin/fiscalite/factures-csv?year=YYYY&month=MM
 * Journal des ventes du mois au format CSV (pour l'expert-comptable).
 */
router.get("/fiscalite/factures-csv", authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const year = parseYear(req.query["year"])
        const month = parseMonth(req.query["month"])
        if (month === null) {
            return res.status(400).json({ success: false, message: "Mois invalide (attendu 1–12)." })
        }

        const factures = await findPaidFacturesOfMonth(year, month)

        const header = [
            "N° facture", "Date", "Client", "E-mail", "Plan",
            "Montant HT (€)", "TVA 20% (€)", "Montant TTC (€)",
        ]
        const lines = [header.map(csvCell).join(";")]

        for (const facture of factures) {
            const user = facture.subscription.user
            const clientName = [user.prenom, user.nom].filter(Boolean).join(" ") || user.email
            const invoiceNumber = `LJ-${facture.createdAt.toISOString().slice(0, 10).replace(/-/g, "")}-${String(facture.idFacture).padStart(4, "0")}`
            const { ht, tva, ttc } = breakdownTtcCents(facture.price)

            const row = [
                invoiceNumber,
                facture.createdAt.toLocaleDateString("fr-FR"),
                clientName,
                user.email,
                facture.subscription.plan.name,
                formatEurForCsv(ht),
                formatEurForCsv(tva),
                formatEurForCsv(ttc),
            ]
            lines.push(row.map(csvCell).join(";"))
        }

        // BOM UTF-8 pour qu'Excel ouvre correctement les accents.
        const csv = "﻿" + lines.join("\r\n")
        const fileName = `ventes_${MONTH_SLUGS[month - 1]}_${year}.csv`

        res.setHeader("Content-Type", "text/csv; charset=utf-8")
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`)
        return res.send(csv)
    } catch (err) {
        console.error("[admin] fiscalite csv error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

/**
 * GET /admin/fiscalite/factures-zip?year=YYYY&month=MM
 * Archive ZIP contenant le PDF de chaque facture payée du mois.
 */
router.get("/fiscalite/factures-zip", authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const year = parseYear(req.query["year"])
        const month = parseMonth(req.query["month"])
        if (month === null) {
            return res.status(400).json({ success: false, message: "Mois invalide (attendu 1–12)." })
        }

        const factures = await findPaidFacturesOfMonth(year, month)
        if (factures.length === 0) {
            return res.status(404).json({ success: false, message: "Aucune facture pour ce mois." })
        }

        const fileName = `factures_${MONTH_SLUGS[month - 1]}_${year}.zip`
        res.setHeader("Content-Type", "application/zip")
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`)

        const archive = new ZipArchive({ zlib: { level: 9 } })
        archive.on("error", (err: Error) => {
            console.error("[admin] fiscalite zip archive error:", err)
            // Les en-têtes sont peut-être déjà partis : on ne peut que couper le flux.
            res.end()
        })
        archive.pipe(res)

        // Régénère chaque PDF et l'ajoute à l'archive.
        const subscriptionService = new Subscription()
        for (const facture of factures) {
            const pdf = await subscriptionService.getInvoicePdfAdmin(facture.idFacture)
            if (pdf) {
                archive.append(pdf.buffer, { name: `${pdf.invoiceNumber}.pdf` })
            }
        }

        await archive.finalize()
        return
    } catch (err) {
        console.error("[admin] fiscalite zip error:", err)
        // Si rien n'a encore été envoyé, on peut répondre proprement.
        if (!res.headersSent) {
            return res.status(500).json({ success: false, message: "Erreur serveur." })
        }
        return res.end()
    }
})

export default router
