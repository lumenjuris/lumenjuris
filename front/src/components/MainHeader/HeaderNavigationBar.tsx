// UI //
import {
  LogInIcon,
  User,
  Bell,
  LogOutIcon,
  AlertCircleIcon,
  HandCoinsIcon,
} from "lucide-react";
import { Button } from "../ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/DropDownMenu";

import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import type { MouseEvent } from "react";

import { useUserStore } from "../../store/userStore";

type NavigationClickHandler = (
  event?: MouseEvent<HTMLElement>,
) => boolean | void;

type NotificationSeverity = "news" | "alert" | "urgent";
type NotificationBadge = "none" | NotificationSeverity;

interface NotificationItem {
  id: string;
  severity: NotificationSeverity;
  title: string;
  path: string;
  linkState?: Record<string, string>;
  buttonLabel: string;
}

interface HeaderNavBarProps {
  onNavClick?: NavigationClickHandler;
}

const SEVERITY_PRIORITY: Record<NotificationSeverity, number> = {
  news: 1,
  alert: 2,
  urgent: 3,
};

const SEVERITY_ICON_COLOR: Record<NotificationSeverity, string> = {
  news: "text-green-500",
  alert: "text-orange-400",
  urgent: "text-red-500",
};

const BADGE_DOT: Record<NotificationSeverity, string> = {
  news: "bg-green-500",
  alert: "bg-orange-400",
  urgent: "bg-red-500",
};

const NOTIFICATION_TYPES: Record<string, Omit<NotificationItem, "id">> = {
  missingEnterpriseData: {
    severity: "urgent",
    title: "Pensez à compléter les informations manquantes dans : ",
    path: "/mon-compte",
    linkState: { origin: "header-alert" },
    buttonLabel: "Mon compte > Mon entreprise",
  },
};

/**
 * Calcule la sévérité globale à afficher sur la pastille de la cloche
 * en retenant le niveau le plus critique parmi toutes les notifications actives.
 * Retourne `"none"` si le tableau est vide.
 *
 * @param tab Liste des notifications actives.
 */
function deriveOverallBadge(tab: NotificationItem[]): NotificationBadge {
  if (tab.length === 0) return "none";
  return tab.reduce<NotificationSeverity>(
    (max, item) =>
      SEVERITY_PRIORITY[item.severity] > SEVERITY_PRIORITY[max]
        ? item.severity
        : max,
    "news",
  );
}

/**
 * Barre de navigation principale du header, adaptée à trois contextes :
 *
 * 1. **Utilisateur connecté** — affiche les liens de navigation (`/dashboard`,
 *    `/analyzer`), les liens admin-only (`/sandbox`, `/monitoring`), la cloche
 *    de notifications et le menu utilisateur (avatar, logout, mon compte, formules).
 *
 * 2. **Utilisateur non connecté** — affiche uniquement les liens `/souscription`
 *    et `/inscription`.
 *
 * 3. **Responsive** — deux rendus parallèles (mobile/tablette `< 768 px` vs
 *    desktop `≥ 768 px`) via Tailwind `lg:hidden` / `hidden lg:flex` :
 *    les icônes seules sur mobile, les boutons texte+icône sur desktop.
 *    Le breakpoint est également détecté via `window.innerWidth` pour adapter
 *    le trigger du dropdown utilisateur (initiales circulaires vs nom tronqué).
 *
 * **Système de notifications** :
 * Les notifications sont dérivées de l'état `userData` au montage et à chaque
 * changement. Actuellement, la seule source est `missingEnterpriseData`
 * (données entreprise absentes → sévérité `"urgent"`). La pastille de la cloche
 * reflète la sévérité maximale parmi toutes les notifications actives ;
 * le niveau `"urgent"` déclenche une animation `ping` pour attirer l'attention.
 *
 * @param onNavClick Callback optionnel exécuté avant les navigations programmées
 *                   (logout, mon compte…). Retourner `false` annule la navigation.
 */
const HeaderNavigationBar = ({ onNavClick }: HeaderNavBarProps) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const { userData, isConnected, userAvatarUrl, logoutUser } = useUserStore();

  const [isMobile, setIsMobile] = useState(false);
  const [notificationTab, setNotificationTab] = useState<NotificationItem[]>(
    [],
  );

  const notification: NotificationBadge = deriveOverallBadge(notificationTab);

  const fetchNotificationData = useCallback(() => {
    const tab: NotificationItem[] = [];
    if (!userData?.enterprise) {
      tab.push({
        id: "missingEnterpriseData",
        ...NOTIFICATION_TYPES.missingEnterpriseData,
      });
    }
    setNotificationTab(tab);
  }, [userData]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    fetchNotificationData();
  }, [fetchNotificationData]);

  const handleUserLogout = async () => {
    if (onNavClick?.() === false) return;

    const success = await logoutUser();
    if (success) navigate("/inscription");
  };

  return (
    <div className="flex items-center gap-1 lg:pr-2">
      {/* Menu du haut volontairement minimal : la navigation vit dans la sidebar.
          On ne garde ici que les notifications + le menu utilisateur. */}





      {isConnected ? (
        <section className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
                  <Bell className="h-5 w-5 text-gray-400" />
                  {notification !== "none" && (
                    <>
                      <span
                        className={`absolute top-1.5 right-1.5 h-2 w-2 rounded-full ${BADGE_DOT[notification]}`}
                      />
                      {notification === "urgent" && (
                        <span
                          className={`absolute top-1.5 right-1.5 h-2 w-2 animate-ping rounded-full opacity-75 ${BADGE_DOT[notification]}`}
                        />
                      )}
                    </>
                  )}
                </button>
              }
            />
            <DropdownMenuContent
              sideOffset={6}
              alignOffset={-60}
              className="min-w-64 bg-lumenjuris-sidebar ring-lumenjuris/60 font-medium text-sm px-4 text-gray-400"
            >
              {notificationTab.length === 0 ? (
                <p className="py-3 text-xs text-gray-500">
                  Aucune notification
                </p>
              ) : (
                <div className="flex flex-col gap-3 py-3">
                  {notificationTab.map((item) => (
                    <div key={item.id} className="flex items-start gap-2.5">
                      <AlertCircleIcon
                        className={`mt-0.5 h-4 w-4 shrink-0 ${SEVERITY_ICON_COLOR[item.severity]}`}
                      />
                      <div className="flex flex-col gap-1 pt-0.5">
                        <p className="text-xs text-gray-300 leading-snug">
                          {item.title}
                        </p>
                        <Link to={item.path} state={item.linkState}>
                          <button className="text-left text-xs font-semibold text-white hover:text-gray-400 transition-colors">
                            {item.buttonLabel}
                          </button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center pl-1">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  userAvatarUrl ? (
                    <button className="h-9 w-9 rounded-full overflow-hidden border border-line hover:border-brand/40 transition-all cursor-pointer">
                      <img src={userAvatarUrl} className="h-full w-full object-cover" alt="" />
                    </button>
                  ) : (
                    <button
                      className="h-9 w-9 rounded-full border border-line bg-white flex items-center justify-center text-ink-secondary hover:border-brand/40 hover:text-brand transition-all cursor-pointer"
                      title="Mon compte"
                    >
                      <User className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  )
                }
              />

              <DropdownMenuContent
                sideOffset={14}
                alignOffset={2}
                className="min-w-28 bg-lumenjuris-sidebar ring-lumenjuris/60 font-medium text-sm px-4 py-2 flex flex-col items-start gap-2"
              >
                <button
                  onClick={handleUserLogout}
                  className="cursor-pointer inline-flex justify-center items-center gap-1 py-1 text-gray-400 hover:text-white transition-all delay-100"
                >
                  <LogOutIcon size={16} />
                  Logout
                </button>
                <button
                  onClick={() => {
                    if (onNavClick?.() === false) return;
                    navigate("/mon-compte");
                  }}
                  className="cursor-pointer inline-flex justify-center items-center gap-1 py-1 text-gray-400 hover:text-white transition-all delay-100"
                >
                  <User size={16} />
                  Mon compte
                </button>
                <button
                  onClick={() => {
                    navigate("/souscription");
                  }}
                  className="cursor-pointer inline-flex justify-center items-center gap-1 py-1 text-gray-400 hover:text-white transition-all delay-100"
                >
                  <HandCoinsIcon size={16} />
                  Formules
                </button>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </section>
      ) : (
        <nav className="flex items-center gap-1 pr-2">
          {isMobile ? (
            <>
              <Link to="/souscription">
                <Button
                  variant="ghost"
                  size="icon-lg"
                  className={
                    pathname === "/souscription"
                      ? " text-gray-500 tracking-wide font-semibold hover:cursor-default"
                      : "text-gray-400 hover:bg-lumenjuris-background"
                  }
                >
                  <HandCoinsIcon
                    className={pathname === "/souscription" ? "size-6" : ""}
                  />
                </Button>
              </Link>
              <Link to="/inscription">
                <Button
                  variant="ghost"
                  size="icon-lg"
                  className={
                    pathname === "/inscription"
                      ? " text-gray-500 tracking-wide font-semibold text-[16px] hover:cursor-default"
                      : "text-gray-400 hover:bg-lumenjuris-background"
                  }
                >
                  <LogInIcon
                    className={pathname === "/inscription" ? "size-6" : ""}
                  />
                </Button>
              </Link>
            </>
          ) : (
            <>
              {" "}
              <Link to="/souscription">
                <Button
                  variant="ghost"
                  size="lg"
                  className={
                    pathname === "/souscription"
                      ? " text-gray-500 tracking-wide font-semibold text-[16px] hover:cursor-default"
                      : "text-gray-400 hover:bg-lumenjuris-background"
                  }
                >
                  <HandCoinsIcon
                    className={pathname === "/souscription" ? "size-5" : ""}
                  />
                  Tarifs
                </Button>
              </Link>
              <Link to="/inscription">
                <Button
                  variant="ghost"
                  size="lg"
                  className={
                    pathname === "/inscription"
                      ? " text-gray-500 tracking-wide font-semibold text-[16px] hover:cursor-default"
                      : "text-gray-400 hover:bg-lumenjuris-background"
                  }
                >
                  <LogInIcon
                    className={pathname === "/inscription" ? "size-5" : ""}
                  />
                  Se connecter
                </Button>
              </Link>
            </>
          )}
        </nav>
      )}
    </div>
  );
};

export default HeaderNavigationBar;
