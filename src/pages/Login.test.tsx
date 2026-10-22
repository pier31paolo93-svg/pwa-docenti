import { afterEach, describe, it, expect, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { Login } from "./Login";
const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));
vi.mock("../services/supabase", () => ({
  configured: true,
  recoveryUrl: () => "https://example.invalid/pwa-docenti/",
  supabase: { auth },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("Restricted login UI", () => {
  it("shows a readable login error and clears password after failure", async () => {
    auth.signInWithPassword.mockResolvedValue({
      error: { code: "invalid_credentials" },
    });
    render(<Login />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "fittizio@example.invalid" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "OnlyATest!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Entra nel quaderno/ }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Email o password non corrette",
      ),
    );
    expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe(
      "",
    );
    expect(screen.queryByRole("button", { name: /registrati/i })).toBeNull();
  });
  it("does not send password recovery without an email", () => {
    render(<Login />);
    fireEvent.click(screen.getByRole("button", { name: /Hai dimenticato/ }));
    expect(screen.getByRole("alert").textContent).toContain("Inserisci prima");
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});
