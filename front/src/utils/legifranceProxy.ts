// Frontend client for the local Node proxy that securely calls Légifrance via PISTE
// Never exposes secrets; talks to http://localhost:4000

import type { CanLiiCase } from '../types';


const PROXY_BASE = 'http://localhost:4000';

function withTimeout<T>(p: Promise<T>, ms = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(to);
        resolve(v);
      },
      (e) => {
        clearTimeout(to);
        reject(e);
      }
    );
  });
}

export async function pingLegiProxy(): Promise<boolean> {
  try {
    const res = await withTimeout(fetch(`${PROXY_BASE}/api/health`, { method: 'GET' }), 3000);
    return res.ok;
  } catch {
    return false;
  }
}

// Robust extraction of a JURITEXT id through heterogeneous JSON
function findJuriId(obj: any): string | null {
  const re = /JURITEXT\w+/i;
  try {
    if (!obj) return null;
    if (typeof obj === 'string') {
      const m = obj.match(re);
      return m ? m[0].toUpperCase() : null;
    }
    if (Array.isArray(obj)) {
      for (const el of obj) {
        const rid = findJuriId(el);
        if (rid) return rid;
      }
      return null;
    }
    if (typeof obj === 'object') {
      const keys = ['id', 'cid', 'documentId', 'identifiant', 'numero', 'title', 'titre'];
      for (const k of keys) {
        const v = (obj as any)[k];
        if (typeof v === 'string') {
          const m = v.match(re);
          if (m) return m[0].toUpperCase();
        }
      }
      for (const v of Object.values(obj)) {
        const rid = findJuriId(v);
        if (rid) return rid;
      }
    }
  } catch {}
  return null;
}

// Exported: extract id from a Legifrance juri URL
export function extractJuriIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/legifrance\.gouv\.fr$/i.test(u.hostname) && !/\.legifrance\.gouv\.fr$/i.test(u.hostname)) return null;
    const m = u.pathname.match(/\/id\/(JURITEXT\w+)/i);
    return m ? m[1].toUpperCase() : null;
  } catch {
    return null;
  }
}

function extractKeywordsForSearch(text: string): string {
  // Nettoyer le texte
  const cleaned = text.replace(/[^\w\s'-]/g, ' ').toLowerCase();
  // Extraire quelques nombres/années/mois pour spécialiser la requête
  const month = cleaned.match(/(\d{1,2})\s*(mois|month|mensuel)/i)?.[1];
  const yearDur = cleaned.match(/(\d{1,2})\s*(ans?|years?)/i)?.[1];
  const durationHint = month ? `${month} mois` : (yearDur ? `${yearDur} ans` : '');
  
  // Détecter le type de clause et utiliser des mots-clés spécialisés
  if (/responsabilité|limitation.*responsabilité|dommages.*indirects/.test(cleaned)) {
    return `limitation responsabilité dommages indirects ${durationHint}`.trim();
  }
  if (/confidentialité|secret|informations.*confidentielles/.test(cleaned)) {
    return `confidentialité secret des affaires divulgation ${durationHint}`.trim();
  }
  if (/non.?concurrence|concurrence|interdiction.*activité/.test(cleaned)) {
    const scope = /territoire|géograph/i.test(cleaned) ? 'territorialité' : '';
    const post = /post.?contractu/i.test(cleaned) ? 'post-contractuelle' : '';
    return ['clause non-concurrence', 'validité', durationHint, scope, post].filter(Boolean).join(' ').trim();
  }
  if (/résiliation|préavis|rupture/.test(cleaned)) {
    return `résiliation contrat préavis délai ${durationHint}`.trim();
  }
  if (/clause.*pénale|pénalité|indemnité/.test(cleaned)) {
    return 'clause pénale validité plafond proportionnalité';
  }
  if (/garantie|obligation.*garantie/.test(cleaned)) {
    return 'garantie contractuelle vice caché';
  }
  
  // Mots-clés juridiques importants (ordre de priorité)
  const legalKeywords = [
    'responsabilité', 'limitation', 'dommages', 'indirects',
    'confidentialité', 'secret', 'informations', 
    'non-concurrence', 'concurrence', 'interdiction',
  'résiliation', 'préavis', 'rupture', 'post-contractuelle', 'territorialité',
    'clause pénale', 'pénalité', 'indemnité',
    'garantie', 'obligation', 'engagement'
  ];
  
  const foundKeywords = legalKeywords.filter(keyword => 
    cleaned.includes(keyword.toLowerCase())
  );
  
  if (foundKeywords.length > 0) {
    return foundKeywords.slice(0, 3).join(' ');
  }
  
  // Fallback: prendre 1-2 mots distinctifs + 1 terme juridique courant pour éviter des résultats trop génériques
  const stop = new Set(['dans','avec','pour','cette','sont','peut','tout','tous','leur','leurs','sera','seront','faire','entre','prestataire','client','contrat','article','clause','services','service']);
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const distinctifs: string[] = [];
  for (const w of tokens) {
    if (w.length > 4 && !stop.has(w)) {
      if (!distinctifs.includes(w)) distinctifs.push(w);
      if (distinctifs.length >= 2) break;
    }
  }
  const spice = ['jurisprudence','validité','principe'];
  return [...distinctifs.slice(0,2), spice[Math.floor(Math.random()*spice.length)]].join(' ').trim();
}

export async function searchLegifranceViaProxy(query: string, limit = 3): Promise<CanLiiCase[]> {
  const keywords = extractKeywordsForSearch(query);
  const today = new Date().toISOString().slice(0, 10);
  const body = { 
    query: keywords || String(query || '').slice(0, 100), 
    pageNumber: 1, 
    pageSize: Math.max(3, Math.min(50, limit * 5)), 
    sort: 'DATE_DECROISSANT',
    dateFrom: '2019-01-01',
    dateTo: today
  };
  console.log('➡️ Proxy search Légifrance (JURI):', { originalLength: query.length, extractedKeywords: keywords, body });
  const res = await withTimeout(
    fetch(`${PROXY_BASE}/api/legi-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    10000
  );
  if (!res.ok) {
    console.warn('❌ Proxy /api/legi-search HTTP', res.status);
    return [];
  }
  const data: any = await res.json().catch(() => null);
  if (!data) return [];

  // Try to extract a proper array of result items from various possible shapes
  const pickResultArray = (root: any): any[] => {
    const candidates: any[] = [];
    const pushIfArray = (arr: any, label: string) => {
      if (Array.isArray(arr) && arr.length) candidates.push({ label, arr });
    };
    // Common known spots
    pushIfArray(root.results, 'results');
    pushIfArray(root.resultsListe, 'resultsListe');
    pushIfArray(root.resultats, 'resultats');
    pushIfArray(root.items, 'items');
    if (root && typeof root === 'object') {
      // Dive one level to find arrays named like list/array in FR/EN
      for (const [k, v] of Object.entries(root)) {
        if (Array.isArray(v) && v.length) {
          const name = String(k).toLowerCase();
          if (/result|liste|list|hits|documents|docs/.test(name)) {
            candidates.push({ label: `nested:${k}`, arr: v });
          }
        }
        // Handle nested containers
        if (v && typeof v === 'object') {
          const vv: any = (v as any).results || (v as any).resultats || (v as any).resultsListe || (v as any).items;
          if (Array.isArray(vv) && vv.length) candidates.push({ label: `sub.${String(k)}`, arr: vv });
        }
      }
    }
    if (!candidates.length) return [];
    // Score arrays: prefer those containing objects with JURITEXT-like ids or decision-like fields
    const score = (arr: any[]): number => {
      let s = 0;
      for (const it of arr.slice(0, 8)) {
        const hasId = !!findJuriId(it);
        const hasFields = it && typeof it === 'object' && (
          'titre' in it || 'title' in it || 'juridiction' in it || 'dateDecision' in it
        );
        if (hasId) s += 3;
        if (hasFields) s += 2;
      }
      return s + Math.min(arr.length, 10) * 0.1; // slight preference for longer lists
    };
    candidates.sort((a, b) => score(b.arr) - score(a.arr));
    const top = candidates[0];
    if (top) console.log('🧭 Légifrance results array picked:', top.label, 'len=', top.arr.length);
    return top ? top.arr : [];
  };

  const items: any[] = pickResultArray(data);
  if (!items.length) {
    console.warn('⚠️ Aucune liste de résultats détectée dans la réponse Légifrance.');
  }
  const pool = items && items.length > 0 ? items : [];

  const out: CanLiiCase[] = [];
  // Deduplicate by JURITEXT
  const seen = new Set<string>();
  for (const it of pool) {
    if (out.length >= limit) break;
    if (!it || typeof it !== 'object') continue;
    const juriId = findJuriId(it);
    if (!juriId) continue;
    if (seen.has(juriId)) continue;
    seen.add(juriId);

    const numero = (it as any).numeroDecision || (it as any).cid || (it as any).nor || '';
    const dateStr = (it as any).dateDecision || (it as any).datePrononcee || (it as any).datePublication || '';
    const court = (it as any).juridiction || (it as any).juridictionJudiciaire || (it as any).formation || (it as any).chambre || 'Juridiction';
    const titre = (it as any).titre || (it as any).title || (it as any).resume || numero || 'Décision';

    // Robust year/date derivation
    let year = 0;
    let dateOut: string | undefined = undefined;
    const tParsed = (typeof dateStr === 'string' && dateStr) ? Date.parse(dateStr) : NaN;
    if (!Number.isNaN(tParsed)) {
      const d = new Date(tParsed);
      year = d.getUTCFullYear();
      dateOut = d.toISOString().slice(0,10);
    }
    if (!year || year < 2020) {
      const fromTitle = extractDateFromTitleDate(String(titre || ''));
      if (fromTitle?.year && fromTitle.year >= 2020) {
        year = fromTitle.year;
        if (fromTitle.dateIso) dateOut = fromTitle.dateIso;
      }
    }
    // Filter: only keep recent decisions
    if (!year || year < 2020) {
      continue;
    }

    const url = `https://www.legifrance.gouv.fr/juri/id/${juriId}`;
    const mappedCase = {
      id: `legi_${juriId}`,
      title: String(titre).slice(0, 80),
      citation: String(numero || ''),
      court: String(court || 'Juridiction'),
      year,
      relevanceScore: 0.85,
      summary: '',
      url,
      keyPrinciples: [],
      date: dateOut,
    };
    console.log(`📋 Décision mappée ${out.length + 1}:`, { title: mappedCase.title, court: mappedCase.court, year: mappedCase.year, url: mappedCase.url });
    out.push(mappedCase);
  }
  console.log('⬅️ Proxy mapped decisions:', out.length);
  return out.slice(0, limit);
}

// Exported: consult the full text of a JURI document via our proxy
export async function consultLegifranceJuriText(juriId: string): Promise<any | null> {
  try {
    const res = await withTimeout(
      fetch(`${PROXY_BASE}/api/legi-consult-juri`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textId: juriId })
      }),
      12000
    );
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data || null;
  } catch {
    return null;
  }
}


// Helper: extract ISO date and year from a title string (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, or French textual dates)
function extractDateFromTitleDate(title: string): { dateIso?: string; year?: number } {
  if (!title) return {};
  // YYYY-MM-DD
  const m1 = title.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m1) {
    const y = parseInt(m1[1], 10), mo = parseInt(m1[2], 10) - 1, d = parseInt(m1[3], 10);
    const dt = new Date(Date.UTC(y, mo, d));
    if (!Number.isNaN(dt.getTime())) return { dateIso: dt.toISOString().slice(0,10), year: y };
  }
  // DD/MM/YYYY or DD-MM-YYYY
  const m2 = title.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m2) {
    let day = parseInt(m2[1], 10);
    let month = parseInt(m2[2], 10) - 1;
    let year = parseInt(m2[3], 10);
    if (year < 100) year += 2000;
    const dt = new Date(Date.UTC(year, month, day));
    if (!Number.isNaN(dt.getTime())) return { dateIso: dt.toISOString().slice(0,10), year };
  }
  // French textual date (e.g., 2 mars 1967, 12 mai 2021)
  const months = '(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)';
  const m3 = title.match(new RegExp(`(\\d{1,2})\\s+${months}\\s+(\\d{4})`, 'i'));
  if (m3) {
    const map: Record<string, number> = { 'janvier':0,'février':1,'fevrier':1,'mars':2,'avril':3,'mai':4,'juin':5,'juillet':6,'août':7,'aout':7,'septembre':8,'octobre':9,'novembre':10,'décembre':11,'decembre':11 };
    const day = parseInt(m3[1], 10);
    const mon = map[m3[2].toLowerCase()] ?? 0;
    const year = parseInt(m3[3], 10);
    const dt = new Date(Date.UTC(year, mon, day));
    if (!Number.isNaN(dt.getTime())) return { dateIso: dt.toISOString().slice(0,10), year };
  }
  return {};
}

// New: global Top3 with full pagination and sorting handled server-side
export async function top3LegifranceGlobal(query: string, typeRecherche: 'EXACTE' | 'UN_DES_MOTS' | 'TOUS_LES_MOTS' = 'UN_DES_MOTS'): Promise<CanLiiCase[]> {
  const today = new Date().toISOString().slice(0, 10);
  const dateFrom = '2020-01-01';
  const dateTo = today;
  try {
    const res = await withTimeout(
      fetch(`${PROXY_BASE}/api/legi-top3`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, typeRecherche, dateFrom, dateTo })
      }),
      20000
    );
    if (!res.ok) {
      // Fallback to legacy search when server fails
      const alt = await searchLegifranceViaProxy(query, 15);
      const yNow = new Date().getFullYear();
      const filtered = alt
        .map((c) => {
          let year = 0;
          let ts = 0;
          if (typeof c.date === 'string' && !Number.isNaN(Date.parse(c.date))) {
            ts = Date.parse(c.date);
            year = new Date(ts).getUTCFullYear();
          } else if (typeof (c as any).year === 'number') {
            year = (c as any).year;
            ts = year ? Date.UTC(year,0,1) : 0;
          } else if (c.title) {
            const t = extractDateFromTitleDate(String(c.title));
            if (t?.year) { year = t.year; ts = t.dateIso ? Date.parse(t.dateIso) : Date.UTC(year,0,1); }
          }
          return { c, year, ts };
        })
        .filter(({ year }) => year >= 2020 && year <= yNow)
        .sort((a,b) => b.ts - a.ts)
        .slice(0,3)
        .map(({ c }) => c);
      return filtered;
    }
    const arr: any[] = await res.json().catch(() => []);
    if (!Array.isArray(arr)) return [];
    const yNow = new Date().getFullYear();
    const out: CanLiiCase[] = arr
      .map((r, i) => {
        const id = String(r?.idDecision || '').toUpperCase();
        const url = id ? `https://www.legifrance.gouv.fr/juri/id/${id}` : '';
        const titre = String(r?.titre || r?.title || '') || 'Décision';
        // Year and date derivation
        let ts = NaN;
        if (typeof r?.dateDecision === 'string' && r.dateDecision) ts = Date.parse(r.dateDecision);
        if (Number.isNaN(ts) && typeof r?.datePublication === 'string' && r.datePublication) ts = Date.parse(r.datePublication);
        let year = Number.isNaN(ts) ? 0 : new Date(ts).getUTCFullYear();
        if (!year || year < 2020) {
          const t = extractDateFromTitleDate(titre);
          if (t?.year && t.year >= 2020) { year = t.year; if (Number.isNaN(ts) && t.dateIso) ts = Date.parse(t.dateIso); }
        }
        if (!year || year < 2020 || year > yNow) return null;
        const dateOut = !Number.isNaN(ts) ? new Date(ts).toISOString().slice(0,10) : (typeof r?.dateDecision === 'string' ? r.dateDecision : undefined);
        return {
          id: `legi_${id || i}`,
          title: titre.slice(0, 120),
          citation: String(r?.numeroDecision || ''),
          court: String(r?.juridiction || 'Juridiction'),
          year,
          relevanceScore: 0.95,
          summary: String(r?.resumeVulgarise || r?.resumePrincipal || ''),
          url,
          keyPrinciples: Array.isArray(r?.motsCles) ? r.motsCles : [],
          date: dateOut,
        } as CanLiiCase;
      })
      .filter((x): x is CanLiiCase => x !== null)
      .sort((a,b) => {
        const ad = a.date ? Date.parse(a.date) : Date.UTC(a.year || 0, 0, 1);
        const bd = b.date ? Date.parse(b.date) : Date.UTC(b.year || 0, 0, 1);
        return bd - ad;
      })
      .slice(0,3);
    return out;
  } catch (e) {
    console.error('❌ top3LegifranceGlobal error:', e);
    return [];
  }
}
