import { useEffect } from "react";
import { guardBack } from "./navigationGuard";
export function allowContextChange() {
  return window.dispatchEvent(
    new Event("before-context-change", { cancelable: true }),
  );
}
// HashRouter uses browser history; block a deliberate navigation before its listener runs.
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const confirm = () =>
      window.confirm("Ci sono modifiche non salvate. Vuoi abbandonarle?");
    const click = (e: MouseEvent) => {
      if (document.querySelector("dialog[open]")) return;
      const a = (e.target as Element).closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (a && a.href !== location.href && !confirm()) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const removeBack = guardBack(
      () => !!document.querySelector("dialog[open]") || confirm(),
    );
    const unload = (e: BeforeUnloadEvent) => {
      if (document.querySelector("dialog[open]")) return;
      e.preventDefault();
      e.returnValue = "";
    };
    const context = (e: Event) => {
      if (!confirm()) e.preventDefault();
    };
    window.addEventListener("before-context-change", context);
    document.addEventListener("click", click, true);
    window.addEventListener("beforeunload", unload);
    return () => {
      document.removeEventListener("click", click, true);
      removeBack();
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("before-context-change", context);
    };
  }, [dirty]);
}
