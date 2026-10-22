import { useEffect, useRef, type ReactNode } from "react";
import { X, ArrowRight, Plus } from "lucide-react";
import { Link } from "react-router-dom";
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
  useEffect(() => {
    dialog.current?.showModal();
    return () => {
      dialog.current?.close();
    };
  }, []);
  return (
    <dialog ref={dialog} className="modal" onCancel={close}>
      <div className="modal-head">
        <h2>{title}</h2>
        <button onClick={close} className="icon-button" aria-label="Chiudi">
          <X size={20} />
        </button>
      </div>
      {children}
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
