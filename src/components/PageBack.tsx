import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { allowContextChange } from "../hooks/unsaved";

export function PageBack() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  if (pathname === "/") return null;
  const parts = pathname.split("/").filter(Boolean);
  const fallback =
    parts[0] === "archivio"
      ? "/organizzazione"
      : parts[0] === "verifiche" && parts[2] === "analisi"
        ? `/verifiche/${parts[1]}`
        : parts.length > 1
          ? `/${parts[0]}`
          : ["griglie", "orario", "passaggio-anno"].includes(parts[0])
            ? "/organizzazione"
            : pathname === "/importa-avanzato"
              ? "/importa"
              : "/";
  function back() {
    // Router-owned history avoids taking a directly opened PWA back to another site.
    if (
      typeof window.history.state?.idx === "number" &&
      window.history.state.idx > 0
    )
      navigate(-1);
    else if (allowContextChange()) navigate(fallback, { replace: true });
  }
  return (
    <button
      type="button"
      className="button page-back"
      aria-label="Torna alla pagina precedente"
      onClick={back}
    >
      <ArrowLeft size={18} aria-hidden="true" />
      Indietro
    </button>
  );
}
