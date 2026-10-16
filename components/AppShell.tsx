"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  BookOpen,
  Briefcase,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  TrendingUp,
  Trophy,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { formatPoints } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { Tooltip } from "./Tooltip";

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Markten", icon: TrendingUp },
  { href: "/activity", label: "Logboek", icon: Activity },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase },
  { href: "/leaderboard", label: "Klassement", icon: Trophy },
  { href: "/profile", label: "Profiel", icon: User },
  { href: "/regels", label: "Spelregels", icon: BookOpen },
];

const ADMIN_NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/markets", label: "Markten beheren", icon: Settings },
  { href: "/admin/users", label: "Gebruikers", icon: Users },
  { href: "/admin/log", label: "Auditlog", icon: History },
  { href: "/admin/stats", label: "Statistieken", icon: BarChart3 },
];

const STORAGE_KEY = "campusmarkt-sidebar-collapsed";

// Kleine externe store rond localStorage, zodat de ingeklapt-voorkeur hydratie-veilig is:
// de server (en de eerste hydratie-pas) zien altijd "uitgeklapt", en pas daarna syncen we naar
// de echte, eventueel opgeslagen voorkeur uit de browser.
let collapsedSnapshot = false;
let collapsedLoaded = false;
const collapsedListeners = new Set<() => void>();

function loadCollapsed(): boolean {
  if (!collapsedLoaded) {
    try {
      collapsedSnapshot = localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      collapsedSnapshot = false;
    }
    collapsedLoaded = true;
  }
  return collapsedSnapshot;
}

function setCollapsedStore(value: boolean) {
  collapsedSnapshot = value;
  collapsedLoaded = true;
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // voorkeur wordt dan niet onthouden, maar de knop blijft werken.
  }
  collapsedListeners.forEach((listener) => listener());
}

function subscribeCollapsed(callback: () => void) {
  collapsedListeners.add(callback);
  return () => collapsedListeners.delete(callback);
}

function getCollapsedServerSnapshot() {
  return false;
}

function isActivePath(pathname: string, href: string) {
  // "/" en "/admin" zijn zelf ook het voorvoegsel van andere routes (bijv. "/admin/markets"),
  // dus die mogen alleen bij een exacte match actief zijn, anders lichten meteen twee navitems op.
  if (href === "/" || href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  label,
  icon: Icon,
  collapsed,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  collapsed: boolean;
  active: boolean;
  onNavigate?: () => void;
}) {
  const link = (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
        active ? "bg-sunk font-semibold text-ink" : "text-muted hover:bg-sunk hover:text-ink"
      } ${collapsed ? "justify-center" : ""}`}
    >
      <Icon className="h-5 w-5 flex-none" aria-hidden="true" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip label={label} side="right">
        {link}
      </Tooltip>
    );
  }
  return link;
}

export function AppShell({
  displayName,
  balance,
  isAdmin,
  children,
}: {
  displayName: string;
  balance: number;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    loadCollapsed,
    getCollapsedServerSnapshot,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  function toggleCollapsed() {
    setCollapsedStore(!collapsed);
  }

  function closeDrawer() {
    setMobileOpen(false);
  }

  // Zet de focus terug op de menuknop zodra de lade sluit (niet tijdens render: dit loopt in een
  // effect, nadat de sluiting daadwerkelijk is gecommit).
  useEffect(() => {
    if (wasOpenRef.current && !mobileOpen) {
      menuButtonRef.current?.focus();
    }
    wasOpenRef.current = mobileOpen;
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;

    const focusables = drawerRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled])',
    );
    focusables?.[0]?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeDrawer();
        return;
      }
      if (e.key !== "Tab" || !focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function renderNav(collapsedMode: boolean, onNavigate?: () => void) {
    return (
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            collapsed={collapsedMode}
            active={isActivePath(pathname, item.href)}
            onNavigate={onNavigate}
          />
        ))}
        {isAdmin && (
          <>
            <p
              className={`mt-4 px-3 text-xs font-semibold uppercase tracking-wide text-muted ${
                collapsedMode ? "sr-only" : ""
              }`}
            >
              Beheer
            </p>
            {ADMIN_NAV_ITEMS.map((item) => (
              <NavLink
                key={item.href}
                {...item}
                collapsed={collapsedMode}
                active={isActivePath(pathname, item.href)}
                onNavigate={onNavigate}
              />
            ))}
          </>
        )}
      </nav>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg lg:flex-row">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-accent-ink"
      >
        Direct naar inhoud
      </a>
      {/* Mobiele topbar */}
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <button
          type="button"
          ref={menuButtonRef}
          onClick={() => setMobileOpen(true)}
          aria-label="Menu openen"
          className="rounded-md p-2 hover:bg-sunk"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <Link href="/" className="font-display text-lg font-bold text-ink">
          Campusmarkt
        </Link>
        <span className="whitespace-nowrap rounded-full bg-sunk px-3 py-1 font-mono text-sm text-ink">
          {formatPoints(balance)}
        </span>
      </div>

      {/* Desktop zijbalk */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-line bg-surface lg:flex ${
          collapsed ? "w-[72px]" : "w-[240px]"
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-4">
          {!collapsed && (
            <Link href="/" className="font-display text-lg font-bold text-ink">
              Campusmarkt
            </Link>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Zijbalk uitklappen" : "Zijbalk inklappen"}
            className="rounded-md p-1.5 text-muted hover:bg-sunk hover:text-ink"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>

        {renderNav(collapsed)}

        <div
          className={`flex flex-col gap-2 border-t border-line px-3 py-3 ${
            collapsed ? "items-center" : ""
          }`}
        >
          {!collapsed && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="truncate font-mono text-sm text-ink">{displayName}</span>
                {isAdmin && (
                  <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                    Beheerder
                  </span>
                )}
              </span>
              <span className="whitespace-nowrap rounded-full bg-sunk px-3 py-1 text-center font-mono text-sm text-ink">
                {formatPoints(balance)}
              </span>
            </>
          )}
          {collapsed ? (
            <Tooltip label="Uitloggen" side="right">
              <button
                type="button"
                onClick={handleSignOut}
                aria-label="Uitloggen"
                className="rounded-md p-2 text-muted hover:bg-sunk hover:text-ink"
              >
                <LogOut className="h-5 w-5" aria-hidden="true" />
              </button>
            </Tooltip>
          ) : (
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted hover:bg-sunk hover:text-ink"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Uitloggen
            </button>
          )}
        </div>
      </aside>

      {/* Mobiele lade (altijd in de DOM, zodat openen/sluiten kan animeren; uitgeschakeld bij
          prefers-reduced-motion en volledig inert wanneer gesloten). */}
      <div className="fixed inset-0 z-50 lg:hidden" aria-hidden={!mobileOpen}>
        <div
          onClick={closeDrawer}
          className={`fixed inset-0 bg-ink/50 transition-opacity motion-reduce:transition-none ${
            mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        />
        <div
          ref={drawerRef}
          role="dialog"
          aria-modal={mobileOpen}
          aria-label="Navigatie"
          inert={!mobileOpen}
          className={`fixed inset-y-0 left-0 flex w-[260px] flex-col bg-surface shadow-lg transition-transform motion-reduce:transition-none ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between px-4 py-4">
            <span className="font-display text-lg font-bold text-ink">Campusmarkt</span>
            <button
              type="button"
              onClick={closeDrawer}
              aria-label="Menu sluiten"
              className="rounded-md p-2 hover:bg-sunk"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          {renderNav(false, closeDrawer)}
          <div className="flex flex-col gap-2 border-t border-line px-3 py-3">
            <span className="flex items-center gap-1.5">
              <span className="truncate font-mono text-sm text-ink">{displayName}</span>
              {isAdmin && (
                <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                  Beheerder
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted hover:bg-sunk hover:text-ink"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Uitloggen
            </button>
          </div>
        </div>
      </div>

      <main id="main-content" className="min-w-0 flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
