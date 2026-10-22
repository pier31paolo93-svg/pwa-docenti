// Installed during module loading, before HashRouter subscribes to browser history.
// A guard must run before the router can unmount an unsaved editor.
const guards: { allow: () => boolean; url: string; state: unknown }[] = [];
window.addEventListener(
  "popstate",
  (event) => {
    const guard = guards.at(-1);
    if (guard && !guard.allow()) {
      event.stopImmediatePropagation();
      history.pushState(guard.state, "", guard.url);
    }
  },
  true,
);
export function guardBack(allow: () => boolean) {
  const guard = { allow, url: location.href, state: history.state };
  guards.push(guard);
  return () => {
    const i = guards.indexOf(guard);
    if (i >= 0) guards.splice(i, 1);
  };
}
