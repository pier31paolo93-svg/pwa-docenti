import { useEffect } from "react";
// Keep native table semantics; add visible column labels for the stacked layout.
export function useTableLabels() {
  useEffect(() => {
    let frame = 0;
    const label = () =>
      document
        .querySelectorAll<HTMLTableElement>(
          ".table-wrap:not(.resource-desktop) table",
        )
        .forEach((table) => {
          table.setAttribute("role", "table");
          const headers = Array.from(table.querySelectorAll("thead th")).map(
            (h) => h.textContent ?? "",
          );
          table.querySelectorAll("tbody tr").forEach((row) =>
            Array.from(row.children).forEach((cell, i) => {
              if (cell.getAttribute("data-label") !== headers[i])
                cell.setAttribute("data-label", headers[i] ?? "");
            }),
          );
        });
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(label);
    });
    observer.observe(document.getElementById("root")!, {
      subtree: true,
      childList: true,
    });
    label();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
}
