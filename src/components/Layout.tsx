import { useCapabilities } from "../hooks/capabilities";
import { PageBack } from "./PageBack";
import { useEffect, useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  CheckSquare,
  MessageSquare,
  ClipboardList,
  Users,
  BarChart3,
  Settings,
  Cloud,
  CloudOff,
  RefreshCw,
  Menu,
  X,
  Search,
  LogOut,
  Sun,
  Moon,
  Sparkles,
  Upload,
} from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useCompact } from "../hooks/viewport";
import { useTableLabels } from "../hooks/tableLabels";
import { allowContextChange } from "../hooks/unsaved";
import { useAuth } from "../state/auth";
import { useData, useSyncState } from "../state/data";
import { label, tr } from "../domain/catalog";
const nav = [
  ["/", "La mia giornata", LayoutDashboard],
  ["/registro-rapido", "Registro rapido", ClipboardList],
  ["/calendario", "Calendario", CalendarDays],
  ["/registro", "Registro lezioni", CalendarDays],
  ["/compiti", "Compiti a casa", CheckSquare],
  ["/osservazioni", "Osservazioni", MessageSquare],
  ["/verifiche", "Verifiche e orali", ClipboardList],
  ["/studenti", "Studenti", Users],
  ["/statistiche", "Statistiche", BarChart3],
] as const;
const mobileNav = [
  ["/", "Home", LayoutDashboard],
  ["/archivio/classes", "Classi", Users],
  ["/registro-rapido", "Registro", CalendarDays],
  ["/verifiche", "Valutazioni", ClipboardList],
] as const;
export function Layout() {
  useTableLabels();
  const capabilities = useCapabilities();
  const auth = useAuth();
  const { data, filters, setFilters, online } = useData();
  const ops = useSyncState();
  const [open, setOpen] = useState(false);
  const compact = useCompact();
  const narrowSidebar = useCompact(850);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dark, setDark] = useState(localStorage.getItem("theme") === "dark");
  const {
    needRefresh: [update],
    updateServiceWorker,
  } = useRegisterSW();
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    const keyboard = () =>
      document.documentElement.classList.toggle(
        "keyboard-open",
        window.innerHeight -
          (window.visualViewport?.height ?? window.innerHeight) >
          150,
      );
    window.visualViewport?.addEventListener("resize", keyboard);
    return () => {
      window.visualViewport?.removeEventListener("resize", keyboard);
      document.documentElement.classList.remove("keyboard-open");
    };
  }, []);
  useEffect(() => {
    if (!open || !narrowSidebar) return;
    const previous = document.activeElement as HTMLElement | null;
    const menu = document.querySelector<HTMLElement>(".sidebar");
    const elements = () =>
      Array.from(menu?.querySelectorAll<HTMLElement>("a,button") ?? []).filter(
        (e) => e.getClientRects().length > 0,
      );
    elements()[0]?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const trap = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
      if (e.key === "Tab") {
        const items = elements();
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      document.body.style.overflow = overflow;
      previous?.focus({ preventScroll: true });
    };
  }, [open, narrowSidebar]);
  const classes = (data.classes ?? []).filter(
    (r) =>
      (!filters.year || r.school_year_id === filters.year) &&
      (!filters.school || r.school_id === filters.school),
  );
  return (
    <div className="app-shell">
      <a
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
        className="skip-link"
      >
        Vai al contenuto
      </a>
      <aside
        aria-label="Menu completo"
        role={narrowSidebar && open ? "dialog" : undefined}
        aria-modal={narrowSidebar && open ? true : undefined}
        aria-hidden={narrowSidebar && !open}
        inert={narrowSidebar && !open}
        className={"sidebar " + (open ? "open" : "")}
      >
        <Link to="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-icon brand-art">
            <img
              src={import.meta.env.BASE_URL + "icon-192.png"}
              alt=""
              width={44}
              height={44}
            />
          </span>
          <span>
            quaderno<span className="brand-sub">DOCENTI</span>
          </span>
        </Link>
        <button
          className="sidebar-close icon-button"
          onClick={() => setOpen(false)}
          aria-label="Chiudi menu"
        >
          <X />
        </button>
        <span className="nav-label">IL TUO QUADERNO</span>
        <nav aria-label="Navigazione principale">
          {nav.map(([to, title, Icon]) => (
            <NavLink
              to={to}
              key={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
            >
              <Icon size={19} />
              {title}
            </NavLink>
          ))}
        </nav>
        <span className="nav-label">VALUTAZIONI</span>
        <nav>
          <NavLink to="/griglie" onClick={() => setOpen(false)}>
            Griglie universali
          </NavLink>
          <NavLink to="/analisi-verifiche" onClick={() => setOpen(false)}>
            Analisi verifiche
          </NavLink>
          <NavLink to="/recupero" onClick={() => setOpen(false)}>
            Recupero
          </NavLink>
        </nav>
        <span className="nav-label">ORGANIZZA</span>
        <nav>
          <NavLink to="/organizzazione" onClick={() => setOpen(false)}>
            <Users size={19} />
            Scuole e classi
          </NavLink>
          <NavLink to="/importa" onClick={() => setOpen(false)}>
            <Upload size={19} />
            Importa studenti
          </NavLink>
          <NavLink to="/ai" onClick={() => setOpen(false)}>
            <Sparkles size={19} />
            Supporto didattico <span className="nav-tag">AI</span>
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <NavLink to="/impostazioni" onClick={() => setOpen(false)}>
            <Settings size={18} />
            Impostazioni
          </NavLink>
          <button onClick={auth.logout}>
            <LogOut size={18} />
            Esci in sicurezza
          </button>
          <small>Dati protetti · {tr(auth.role ?? "viewer")}</small>
        </div>
      </aside>
      {open && (
        <button
          className="overlay"
          onClick={() => setOpen(false)}
          aria-label="Chiudi menu"
        />
      )}
      <div className="app-body" inert={open && narrowSidebar}>
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            onClick={() => setOpen(true)}
            aria-label="Apri menu"
          >
            <Menu />
          </button>
          <div className="workspace-select">
            <span className="workspace-dot" />
            <select
              aria-label="Workspace corrente"
              value={auth.workspace}
              onChange={(e) => {
                if (allowContextChange()) auth.setWorkspace(e.target.value);
              }}
            >
              {auth.identity.workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {String(w.name)}
                </option>
              ))}
            </select>
          </div>
          <div className="topbar-right">
            <Link
              to="/sincronizzazione"
              className={"sync-status " + (!online ? "offline" : "")}
            >
              {online ? <Cloud size={17} /> : <CloudOff size={17} />}
              <span>
                {ops.length
                  ? ops.length + " in coda"
                  : online
                    ? "Online"
                    : "Offline"}
              </span>
            </Link>
            <button
              className="icon-button"
              onClick={() => setDark(!dark)}
              aria-label={dark ? "Attiva tema chiaro" : "Attiva tema scuro"}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <Link
              to="/impostazioni"
              className="avatar"
              aria-label="Profilo docente"
            >
              {String(
                auth.identity.profile?.display_name ||
                  auth.session?.user.email ||
                  "D",
              )
                .slice(0, 1)
                .toUpperCase()}
            </Link>
          </div>
        </header>
        {update && (
          <div className="banner update">
            <RefreshCw size={17} /> È disponibile una nuova versione.{" "}
            <button
              onClick={() => {
                if (
                  !ops.length ||
                  window.confirm(
                    "Ci sono modifiche in coda. Rimarranno sul dispositivo dopo l’aggiornamento. Continuare?",
                  )
                )
                  void updateServiceWorker(true);
              }}
            >
              Aggiorna
            </button>
          </div>
        )}
        <details
          className="context-filters"
          open={!compact || filtersOpen}
          onToggle={(e) => {
            if (compact) setFiltersOpen(e.currentTarget.open);
          }}
        >
          <summary>
            Filtri classe e materia{" "}
            {filters.classId ? "· Classe selezionata" : "· Tutte le classi"}
          </summary>
          <div className="context-bar">
            <span className="context-label">Stai lavorando su</span>
            <select
              aria-label="Anno scolastico"
              value={filters.year}
              onChange={(e) => setFilters({ year: e.target.value })}
            >
              <option value="">Tutti gli anni</option>
              {data.school_years?.map((r) => (
                <option key={r.id} value={r.id}>
                  {String(r.label)}
                </option>
              ))}
            </select>
            <select
              aria-label="Scuola"
              value={filters.school}
              onChange={(e) => setFilters({ school: e.target.value })}
            >
              <option value="">Tutte le scuole</option>
              {data.schools?.map((r) => (
                <option key={r.id} value={r.id}>
                  {String(r.name)}
                </option>
              ))}
            </select>
            <select
              aria-label="Classe"
              value={filters.classId}
              onChange={(e) => setFilters({ classId: e.target.value })}
            >
              <option value="">Tutte le classi</option>
              {classes.map((r) => (
                <option key={r.id} value={r.id}>
                  {String(r.name)}
                </option>
              ))}
            </select>
            <select
              aria-label="Materia"
              value={filters.subject}
              onChange={(e) => setFilters({ subject: e.target.value })}
            >
              <option value="">Tutte le materie</option>
              {data.subjects?.map((r) => (
                <option key={r.id} value={r.id}>
                  {String(r.name)}
                </option>
              ))}
            </select>
          </div>
        </details>
        <main tabIndex={-1} id="main-content" className="main-content">
          <PageBack />
          {capabilities.data && !capabilities.data.extendedHomework && (
            <div className="banner">
              Backend in sola lettura: la migrazione frontend 18 richiede
              approvazione prima del deploy cloud. Nessuna migrazione viene
              applicata automaticamente.
            </div>
          )}
          <Outlet />
        </main>
        <footer className="app-footer">
          Quaderno Docenti{" "}
          <span>Uno spazio per osservare, capire, accompagnare.</span>
        </footer>
      </div>
      <nav
        className="bottom-nav"
        aria-label="Navigazione mobile"
        inert={open && narrowSidebar}
      >
        {mobileNav.map(([to, title, Icon]) => (
          <NavLink key={to} to={to} end={to === "/"}>
            <Icon size={21} />
            <span>{title}</span>
          </NavLink>
        ))}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <Menu size={21} />
          <span>Altro</span>
        </button>
      </nav>
      <div className="student-search">
        <label>
          <Search size={16} />
          <input
            aria-label="Cerca studente rapidamente"
            placeholder="Cerca uno studente…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {search.length > 1 && (
          <div className="search-results">
            {data.students
              ?.filter((s) =>
                label("students", s, data)
                  .toLocaleLowerCase()
                  .includes(search.toLocaleLowerCase()),
              )
              .slice(0, 7)
              .map((s) => (
                <Link
                  key={s.id}
                  to={"/studenti/" + s.id}
                  onClick={() => setSearch("")}
                >
                  {label("students", s, data)}
                </Link>
              ))}
            {!data.students?.some((s) =>
              label("students", s, data)
                .toLowerCase()
                .includes(search.toLowerCase()),
            ) && <p>Nessuno studente trovato.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
