import { useState } from "react";
import { ArrowRight, LockKeyhole, WifiOff } from "lucide-react";
import { supabase, configured, recoveryUrl } from "../services/supabase";
import { ErrorBox } from "../components/ui";
export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [notice, setNotice] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error)
        throw new Error(
          error.code === "invalid_credentials"
            ? "Email o password non corrette."
            : error.message,
        );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
      setPassword("");
    }
  }
  async function recover() {
    if (!email.includes("@")) {
      setError(new Error("Inserisci prima il tuo indirizzo email."));
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: recoveryUrl(),
    });
    if (error) setError(error);
    else
      setNotice(
        "Se l’indirizzo è associato a un account, riceverai le istruzioni per recuperare la password.",
      );
    setBusy(false);
  }
  return (
    <main className="login-shell">
      <section className="login-story">
        <div className="brand">
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
        </div>
        <div>
          <span className="eyebrow">MENO BUROCRAZIA. PIÙ DIDATTICA.</span>
          <h1>
            Ogni lezione
            <br />
            lascia un segno.
          </h1>
          <p>
            Osservazioni, compiti e valutazioni.
            <br />
            Il tuo lavoro quotidiano, in un unico spazio.
          </p>
          <div className="notebook-art" aria-hidden="true">
            <div className="paper-line" />
            <div className="paper-line short" />
            <div className="paper-chart">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <span>Spazio ai progressi.</span>
          </div>
        </div>
        <small>Uno spazio personale. Una visione d’insieme.</small>
      </section>
      <section className="login-panel">
        <div className="login-form">
          <span className="eyebrow">IL TUO SPAZIO DI LAVORO</span>
          <h2>Bentornata, bentornato.</h2>
          <p>Accedi con il tuo account docente.</p>
          {!configured && (
            <div className="error">
              Configurazione Supabase mancante: imposta URL e chiave publishable
              nell’ambiente di build.
            </div>
          )}
          {!navigator.onLine && (
            <p className="banner">
              <WifiOff size={16} /> Per un nuovo accesso serve una connessione.
            </p>
          )}
          <form onSubmit={submit}>
            <label>
              Email
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@scuola.it"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <ErrorBox error={error} />
            {notice && (
              <p role="status" className="banner">
                {notice}
              </p>
            )}
            <button
              className="button primary full"
              disabled={busy || !configured}
            >
              {busy ? "Accesso…" : "Entra nel quaderno"}
              <ArrowRight size={18} />
            </button>
            <button
              type="button"
              className="text-button"
              disabled={busy || !configured}
              onClick={recover}
            >
              Hai dimenticato la password?
            </button>
          </form>
          <div className="login-security">
            <LockKeyhole size={17} />
            <p>
              Accesso riservato ai docenti invitati.
              <br />I tuoi dati restano nel tuo workspace.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
