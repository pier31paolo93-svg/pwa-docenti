import { renderHook, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { allowContextChange, useUnsavedChanges } from "./unsaved";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});
it("protects unsaved student/workspace changes and releases after saving", () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const { rerender } = renderHook(({ dirty }) => useUnsavedChanges(dirty), {
    initialProps: { dirty: true },
  });
  expect(allowContextChange()).toBe(false);
  expect(confirm).toHaveBeenCalledOnce();
  rerender({ dirty: false });
  expect(allowContextChange()).toBe(true);
});
it("allows an explicitly confirmed context change", () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  renderHook(() => useUnsavedChanges(true));
  expect(allowContextChange()).toBe(true);
});
it("cancels an anchor navigation when changes are retained", () => {
  vi.spyOn(window, "confirm").mockReturnValue(false);
  renderHook(() => useUnsavedChanges(true));
  const a = document.createElement("a");
  a.href = "#/altra-pagina";
  document.body.append(a);
  const click = new MouseEvent("click", { bubbles: true, cancelable: true });
  a.dispatchEvent(click);
  expect(click.defaultPrevented).toBe(true);
});
it("avoids a second prompt when a native dialog owns dirty changes", () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  renderHook(() => useUnsavedChanges(true));
  const dialog = document.createElement("dialog");
  dialog.setAttribute("open", "");
  document.body.append(dialog);
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
  expect(confirm).not.toHaveBeenCalled();
});
