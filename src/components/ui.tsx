import {
  createContext,
  useContext,
  useId,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X, ArrowRight, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { guardBack } from "../hooks/navigationGuard";
export function PageTitle({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
export function Empty({
  title,
  description,
  to,
  action,
}: {
  title: string;
  description: string;
  to?: string;
  action?: () => void;
}) {
  return (
    <div className="empty">
      <div className="empty-mark">↗</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {to && (
        <Link className="button primary" to={to}>
          Inizia da qui <ArrowRight size={16} />
        </Link>
      )}
      {action && (
        <button className="button primary" onClick={action}>
          <Plus size={16} /> Aggiungi
        </button>
      )}
    </div>
  );
}
export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div role="alert" className="error">
      {error instanceof Error
        ? error.message
        : typeof error === "object" && error && "message" in error
          ? String(error.message)
          : String(error)}
    </div>
  );
}
const ModalContext = createContext<{
  close: () => void;
  clean: () => void;
  footer: HTMLDivElement | null;
} | null>(null);
export const useModalClose = () => useContext(ModalContext)?.close;
export const useModalClean = () => useContext(ModalContext)?.clean;
export function ModalActions({ children }: { children: ReactNode }) {
  const ctx = useContext(ModalContext);
  const actions = <div className="form-actions">{children}</div>;
  return ctx?.footer ? createPortal(actions, ctx.footer) : actions;
}
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef(document.activeElement as HTMLElement | null);
  const heading = useRef<HTMLHeadingElement>(null);
  const dirty = useRef(false);
  const id = useId();
  const [footer, setFooter] = useState<HTMLDivElement | null>(null);
  const requestClose = () => {
    if (
      !dirty.current ||
      window.confirm("Ci sono modifiche non salvate. Vuoi abbandonarle?")
    )
      close();
  };
  useEffect(() => {
    const previous = opener.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    heading.current?.focus();
    const resize = () => {
      const v = window.visualViewport;
      dialog.current?.style.setProperty(
        "--visual-height",
        `${v?.height ?? window.innerHeight}px`,
      );
      dialog.current?.style.setProperty(
        "--visual-top",
        `${v?.offsetTop ?? 0}px`,
      );
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        dialog.current?.contains(active) &&
        /INPUT|TEXTAREA|SELECT/.test(active.tagName)
      )
        active.scrollIntoView({ block: "nearest" });
    };
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const removeBack = guardBack(() => {
      if (
        dirty.current &&
        !window.confirm("Ci sono modifiche non salvate. Vuoi abbandonarle?")
      )
        return false;
      close();
      return true;
    });
    resize();
    window.visualViewport?.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("scroll", resize);
    window.addEventListener("beforeunload", unload);
    return () => {
      dialog.current?.close();
      document.body.style.overflow = overflow;
      window.visualViewport?.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("scroll", resize);
      window.removeEventListener("beforeunload", unload);
      removeBack();
      requestAnimationFrame(() => {
        if (previous?.isConnected && !document.querySelector("dialog[open]"))
          previous.focus({ preventScroll: true });
      });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={id}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
    >
      <div className="modal-head">
        <h2 ref={heading} tabIndex={-1} id={id}>
          {title}
        </h2>
        <button
          type="button"
          onClick={requestClose}
          className="icon-button"
          aria-label="Chiudi"
        >
          <X size={20} />
        </button>
      </div>
      <ModalContext.Provider
        value={{
          close: requestClose,
          clean: () => {
            dirty.current = false;
          },
          footer,
        }}
      >
        <div
          className="modal-content"
          onInputCapture={() => {
            dirty.current = true;
          }}
          onChangeCapture={() => {
            dirty.current = true;
          }}
        >
          {children}
        </div>
        <div className="modal-footer" ref={setFooter} />
      </ModalContext.Provider>
    </dialog>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  return <span className={"badge " + tone}>{children}</span>;
}
export function Spinner() {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      Caricamento…
    </div>
  );
}
export function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: string;
}) {
  return (
    <article className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </article>
  );
}
