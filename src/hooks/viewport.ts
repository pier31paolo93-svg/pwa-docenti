import { useEffect, useState } from "react";
export function useCompact(max = 640) {
  const [compact, setCompact] = useState(
    () => window.matchMedia(`(max-width: ${max}px)`).matches,
  );
  useEffect(() => {
    const q = window.matchMedia(`(max-width: ${max}px)`);
    const change = () => setCompact(q.matches);
    change();
    q.addEventListener("change", change);
    return () => q.removeEventListener("change", change);
  }, [max]);
  return compact;
}
