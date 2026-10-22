import { useCapabilities, capabilityKey } from "../hooks/capabilities";
import { useState } from "react";
import { useAuth } from "../state/auth";
import { useData, baseTables, useSyncState } from "../state/data";
import { supabase } from "../services/supabase";
import { consent, seal } from "../offline/vault";
import {
  clearOffline,
  fetchRows,
  resolveOperation,
  flush,
} from "../offline/sync";
import { PageTitle, ErrorBox, Badge } from "../components/ui";
import { text, message } from "../types/model";
import { useUnsavedChanges } from "../hooks/unsaved";
export function Settings() {
  const auth = useAuth();
  const capabilities = useCapabilities();
  const { notice, online } = useData();
  const ops = useSyncState();
  const owner = auth.session!.user.id;
  const [name, setName] = useState(
    text(auth.identity.profile ?? undefined, "display_name"),
  );
  const [password, setPassword] = useState("");
  const [savedName, setSavedName] = useState(name);
  const [enabled, setEnabled] = useState(consent(owner));
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [shortcuts, setShortcuts] = useState<string>(() =>
    localStorage.getItem("quick:" + owner + ":" + auth.workspace)
      ? JSON.parse(
          localStorage.getItem(
            "quick:" + owner + ":" + auth.workspace,
          )! as string,
        ).join("\n")
      : "Partecipa con continuità\nRichiede supporto\nIntervento pertinente",
  );
  const [savedShortcuts, setSavedShortcuts] = useState(shortcuts);
  useUnsavedChanges(
    name !== savedName || shortcuts !== savedShortcuts || !!password,
  );
  async function run(fn: () => Promise<void>) {
    setError(undefined);
    setBusy(true);
    try {
      await fn();
      notice("Impostazioni aggiornate.");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function offline() {
    if (enabled) {
      if (ops.length)
        throw new Error(
          "Risolvi le modifiche in attesa prima di rimuovere i dati offline.",
        );
      await clearOffline(owner);
      setEnabled(false);
    } else {
      if (!online)
        throw new Error("Collegati prima di preparare i dati offline.");
      if (
        !window.confirm(
          "Questo è un dispositivo personale protetto? I dati saranno conservati cifrati nel browser per massimo 8 ore; le modifiche in attesa fino alla sincronizzazione. Le chiavi restano sul dispositivo: la cifratura non protegge un browser già sbloccato.",
        )
      )
        return;
      localStorage.setItem("offline:" + owner, "yes");
      await seal(owner, owner + "|identity", auth.identity);
      await seal(
        owner,
        capabilityKey(owner, auth.workspace),
        capabilities.data ?? { extendedHomework: false },
      );
      setEnabled(true);
      await Promise.all(
        baseTables.map((t) => fetchRows(t, owner, auth.workspace)),
      );
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="IL TUO QUADERNO"
        title="Impostazioni"
        subtitle="Account, dispositivo e preferenze personali."
      />
      <ErrorBox error={error} />
      <div className="dashboard-columns">
        <section className="card">
          <h2>Profilo</h2>
          <p>{auth.session?.user.email}</p>
          <label>
            Nome visualizzato
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button
            className="button"
            disabled={busy || !online}
            onClick={() =>
              void run(async () => {
                const p = auth.identity.profile;
                if (!p) throw new Error("Profilo non disponibile");
                const { error } = await supabase
                  .from("profiles")
                  .update({
                    display_name: name,
                    version: Number(p.version) + 1,
                  })
                  .eq("id", owner)
                  .eq("version", Number(p.version));
                if (error) throw error;
                await auth.reload();
                setSavedName(name);
              })
            }
          >
            Salva profilo
          </button>
          <h3>Cambia password</h3>
          <label>
            Nuova password
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={12}
            />
          </label>
          <button
            className="button"
            disabled={busy || !online}
            onClick={() =>
              void run(async () => {
                if (password.length < 12)
                  throw new Error("Usa almeno 12 caratteri.");
                const { error } = await supabase.auth.updateUser({ password });
                if (error) throw error;
                setPassword("");
              })
            }
          >
            Aggiorna password
          </button>
        </section>
        <section className="card">
          <h2>Modalità offline</h2>
          <Badge tone={enabled ? "good" : "neutral"}>
            {enabled ? "Attiva su questo dispositivo" : "Disattivata"}
          </Badge>
          <p>
            Attivala solo su un dispositivo personale. I dati sono separati per
            account e workspace. All’uscita la copia locale viene rimossa.
          </p>
          <button
            className="button"
            disabled={busy}
            onClick={() => void run(offline)}
          >
            {enabled ? "Rimuovi copia locale" : "Abilita e prepara dati"}
          </button>
          <p className="muted">
            Il logout elimina anche le modifiche non sincronizzate: verifica la
            coda prima di uscire.
          </p>
        </section>
        <section className="card">
          <h2>Pulsanti delle osservazioni</h2>
          <label>
            Un’etichetta per riga (massimo 8)
            <textarea
              rows={6}
              value={shortcuts}
              onChange={(e) => setShortcuts(e.target.value)}
            />
          </label>
          <button
            className="button"
            onClick={() =>
              void run(async () => {
                const items = shortcuts
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean);
                if (
                  !items.length ||
                  items.length > 8 ||
                  items.some((s) => s.length > 100)
                )
                  throw new Error(
                    "Inserisci da 1 a 8 etichette, massimo 100 caratteri ciascuna.",
                  );
                localStorage.setItem(
                  "quick:" + owner + ":" + auth.workspace,
                  JSON.stringify(items),
                );
                setSavedShortcuts(shortcuts);
              })
            }
          >
            Salva scorciatoie
          </button>
        </section>
        <section className="card">
          <h2>Workspace</h2>
          <p>
            {text(
              auth.identity.workspaces.find((w) => w.id === auth.workspace),
              "name",
            )}
          </p>
          <p>
            Ruolo: {auth.role}. L’applicazione non crea account e non abilita
            registrazioni pubbliche.
          </p>
          <p>
            Le categorie, le regole e le rubriche si configurano in
            Organizzazione.
          </p>
        </section>
      </div>
    </>
  );
}
export function SyncPage() {
  const ops = useSyncState();
  const { notice } = useData();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  async function action(id: string, mode: "remote" | "retry") {
    if (
      mode === "retry" &&
      !window.confirm(
        "Riapplicare esplicitamente i campi locali sulla revisione remota attuale? Controlla le differenze prima di continuare.",
      )
    )
      return;
    setBusy(true);
    try {
      await resolveOperation(id, mode);
      notice("Coda aggiornata.");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="DATI DEL DISPOSITIVO"
        title="Sincronizzazione"
        subtitle="I conflitti fermano la coda. Confronta le revisioni prima di decidere."
        action={
          <button
            className="button"
            disabled={busy}
            onClick={() => void flush().catch(setError)}
          >
            Sincronizza ora
          </button>
        }
      />
      <ErrorBox error={error} />
      {!ops.length ? (
        <section className="card">
          <h2>Nessuna modifica in attesa</h2>
          <p>Le modifiche di questo account sono sincronizzate.</p>
        </section>
      ) : (
        ops.map((op) => (
          <section className="card" key={op.operation}>
            <h3>
              {op.table} · {op.id.slice(0, 8)}
            </h3>
            <Badge tone={op.state === "pending" ? "warn" : "bad"}>
              {
                {
                  pending: "In attesa",
                  conflict: "Conflitto",
                  error: "Errore",
                }[op.state]
              }
            </Badge>
            <p>
              Revisione locale attesa: {op.expected}. {op.error}
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Campo</th>
                    <th>Modifica locale</th>
                    <th>Valore remoto</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(op.patch).map(([key, value]) => (
                    <tr key={key}>
                      <td>{key}</td>
                      <td>{JSON.stringify(value)}</td>
                      <td>{JSON.stringify(op.remote?.[key] ?? null)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {op.state !== "pending" && (
              <div className="form-actions">
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => void action(op.operation, "remote")}
                >
                  Usa dati remoti e scarta le modifiche a questa riga
                </button>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => void action(op.operation, "retry")}
                >
                  Riapplica campi locali
                </button>
              </div>
            )}
          </section>
        ))
      )}
    </>
  );
}
export function AIPage() {
  const { online } = useData();
  return (
    <>
      <PageTitle
        eyebrow="ESTENSIONI FUTURE"
        title="Assistente AI"
        subtitle="Funzione predisposta e disabilitata."
      />
      <section className="card">
        <Badge>Disabilitato</Badge>
        <h2>Il docente mantiene il controllo</h2>
        <p>
          Nessun provider è configurato. Nessun dato degli studenti viene
          inviato a servizi AI.
        </p>
        <p>
          Non sono disponibili generazioni o valutazioni automatiche.
          L’integrazione richiederà un’attivazione autorizzata, minimizzazione
          dei dati e revisione dei suggerimenti.
        </p>
        <p>{online ? "Connessione disponibile." : "Dispositivo offline."}</p>
      </section>
      <div className="resource-grid">
        {[
          "Analisi degli errori",
          "Suggerimenti didattici",
          "Esercizi di recupero",
          "Argomenti da ripassare",
          "Bozze di commenti",
        ].map((title) => (
          <section className="card" key={title}>
            <Badge>Non disponibile</Badge>
            <h3>{title}</h3>
            <p>
              Richiede un servizio autorizzato e configurato. Nessun
              suggerimento viene simulato.
            </p>
          </section>
        ))}
      </div>
    </>
  );
}
export const describeError = message;
