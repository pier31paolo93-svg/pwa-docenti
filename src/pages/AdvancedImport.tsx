import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useData, useRows } from "../state/data";
import { useAuth } from "../state/auth";
import { useCapabilities } from "../hooks/capabilities";
import { usePermissions } from "../hooks/permissions";
import { useUnsavedChanges } from "../hooks/unsaved";
import { readStudentFile, fingerprint } from "../services/importFiles";
import { exportRows } from "../services/export";
import { v12Rpc } from "../services/v12";
import { supabase } from "../services/supabase";
import { firstRegisterNumber } from "../domain/register";
import { label } from "../domain/catalog";
import { text, today } from "../types/model";
import { PageTitle, ErrorBox } from "../components/ui";
const columns = {
  last_name: "Cognome",
  first_name: "Nome",
  external_code: "Codice studente",
  class_name: "Classe",
  register_number: "Numero di registro",
};
type Choice = {
  action: string;
  student_id: string;
  class_id: string;
  register_number: string;
};
export function AdvancedImport() {
  const { data, filters, online } = useData(),
    auth = useAuth(),
    caps = useCapabilities(),
    { admin } = usePermissions(),
    qc = useQueryClient(),
    historical = useRows("enrollments");
  const [headers, setHeaders] = useState<string[]>([]),
    [rows, setRows] = useState<string[][]>([]),
    [map, setMap] = useState<Record<string, string>>({}),
    [choices, setChoices] = useState<Record<number, Choice>>({}),
    [cls, setClass] = useState(""),
    [day, setDay] = useState(today()),
    [source, setSource] = useState(""),
    [page, setPage] = useState(0),
    [preview, setPreview] = useState<Record<string, unknown>[]>(),
    [reviewed, setReviewed] = useState(false),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [report, setReport] = useState<Record<string, unknown>>();
  const operation = useRef(crypto.randomUUID());
  useUnsavedChanges(!!rows.length && !report);
  const classes = (data.classes ?? []).filter(
    (c) =>
      (!filters.year || c.school_year_id === filters.year) &&
      (!filters.school || c.school_id === filters.school),
  );
  const cell = (r: string[], key: string) =>
    (r[headers.indexOf(map[key])] ?? "").trim();
  function change() {
    setPreview(undefined);
    setReviewed(false);
    setReport(undefined);
  }
  function choice(i: number): Choice {
    const r = rows[i],
      code = cell(r, "external_code"),
      existing = code
        ? data.students?.find((s) => s.external_code === code)
        : undefined,
      classMatches = classes.filter((c) => c.name === cell(r, "class_name"));
    return (
      choices[i] ?? {
        action: existing ? "update" : "pending",
        student_id: existing?.id ?? "",
        class_id: cls || (classMatches.length === 1 ? classMatches[0].id : ""),
        register_number: cell(r, "register_number"),
      }
    );
  }
  function patch(i: number, p: Partial<Choice>) {
    change();
    setChoices((v) => ({ ...v, [i]: { ...choice(i), ...p } }));
  }
  async function plan() {
    const digest = await fingerprint(
      JSON.stringify([
        source,
        map,
        cls,
        rows.map((_, i) => choice(i).class_id),
      ]),
    );
    const used = [...(historical.data ?? [])];
    const result = rows.map((r, i) => {
      const c = choice(i),
        student = data.students?.find((s) => s.id === c.student_id);
      if (c.action === "skip") return { action: "skip", row: i + 1 };
      if (!["insert", "update"].includes(c.action))
        throw Error(
          `Riga ${i + 1}: scegli esplicitamente inserimento, riconciliazione o esclusione.`,
        );
      if (c.action === "update" && !student)
        throw Error(`Riga ${i + 1}: seleziona lo studente esistente.`);
      if (cell(r, "class_name") && !c.class_id)
        throw Error(
          `Riga ${i + 1}: classe ambigua o non riconosciuta, selezionala.`,
        );
      const enrollment = student
        ? historical.data?.find(
            (e) => e.student_id === student.id && e.class_id === c.class_id,
          )
        : undefined;
      const number = c.class_id
        ? Number(
            c.register_number ||
              enrollment?.register_number ||
              firstRegisterNumber(used, c.class_id),
          )
        : null;
      if (number != null && (!Number.isInteger(number) || number <= 0))
        throw Error(`Riga ${i + 1}: numero di registro non valido.`);
      if (c.class_id)
        used.push({
          id: "import-" + i,
          class_id: c.class_id,
          register_number: number,
        });
      return {
        action: c.action,
        row: i + 1,
        student_id: c.action === "update" ? student!.id : null,
        student_version: c.action === "update" ? student!.version : null,
        first_name: cell(r, "first_name"),
        last_name: cell(r, "last_name"),
        external_code:
          cell(r, "external_code") ||
          student?.external_code ||
          `IMPORT-${digest.slice(0, 16)}-${i + 1}`,
        class_id: c.class_id || null,
        register_number: number,
        starts_on: day,
        enrollment_version: enrollment?.version ?? null,
      };
    });
    return { digest, result };
  }
  async function review() {
    setBusy(true);
    setError(undefined);
    try {
      const digest = await fingerprint(
        JSON.stringify([
          source,
          map,
          cls,
          rows.map((_, i) => choice(i).class_id),
        ]),
      );
      const previous = await supabase
        .from("import_batches")
        .select("result_report,status")
        .eq("workspace_id", auth.workspace)
        .eq("created_by", auth.session!.user.id)
        .eq("source_fingerprint", digest)
        .maybeSingle();
      if (previous.error) throw previous.error;
      if (previous.data?.status === "applied") {
        setReport({
          ...(previous.data.result_report as Record<string, unknown>),
          already_applied: true,
        });
        return;
      }
      const p = await plan();
      await v12Rpc("preview_student_import", {
        p_workspace: auth.workspace,
        p_plan: p.result,
      });
      setPreview(p.result);
      setReviewed(false);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    if (!preview || !reviewed) return;
    setBusy(true);
    setError(undefined);
    try {
      const p = await plan();
      const result = await v12Rpc<Record<string, unknown>>(
        "apply_student_import",
        {
          p_workspace: auth.workspace,
          p_operation: operation.current,
          p_source: p.digest,
          p_plan: preview,
        },
      );
      setReport(result);
      await qc.invalidateQueries({ queryKey: ["data"] });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        title="Importazione avanzata"
        subtitle="CSV/XLSX con riconciliazione esplicita, numeri di registro e anteprima server. Nessuna sovrascrittura silenziosa."
      />
      <ErrorBox error={error} />
      {!admin ? (
        <p>Importazione anagrafiche riservata a Owner/Admin.</p>
      ) : !caps.data?.advancedImport ? (
        <p>
          È necessaria la migrazione V1.3/V1.4 25. L’importazione precedente
          resta disponibile.
        </p>
      ) : (
        <>
          <div className="form-actions">
            {(["csv", "xlsx"] as const).map((format) => (
              <button
                className="button"
                key={format}
                onClick={() =>
                  void exportRows(format, "Modello importazione studenti", [
                    {
                      Cognome: "EsempioDaRimuovere",
                      Nome: "NomeFittizio",
                      "Codice studente": "",
                      Classe: "",
                      "Numero di registro": 1,
                    },
                  ]).catch(setError)
                }
              >
                Scarica modello {format.toUpperCase()}
              </button>
            ))}
          </div>
          <p>
            Rimuovi la riga di esempio prima di compilare il modello. Il codice
            è facoltativo nel file: viene creato un codice tecnico stabile per i
            nuovi studenti. Nome e cognome non vengono usati come unica
            identità.
          </p>
          <section className="card">
            <label>
              File da riconciliare
              <input
                type="file"
                accept=".csv,.xlsx"
                disabled={busy || !online}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setBusy(true);
                  setError(undefined);
                  try {
                    const parsed = await readStudentFile(file);
                    setHeaders(parsed.headers);
                    setRows(parsed.rows);
                    setPage(0);
                    setMap(
                      Object.fromEntries(
                        Object.keys(columns).map((k) => [
                          k,
                          parsed.headers.find((h) =>
                            k === "first_name"
                              ? /^nome$|first.?name/i.test(h)
                              : k === "last_name"
                                ? /cognome|last.?name/i.test(h)
                                : k === "external_code"
                                  ? /codice|external.?code/i.test(h)
                                  : k === "class_name"
                                    ? /classe|class/i.test(h)
                                    : /numero|register/i.test(h),
                          ) ?? "",
                        ]),
                      ),
                    );
                    setChoices({});
                    setSource(await fingerprint(JSON.stringify(parsed)));
                    operation.current = crypto.randomUUID();
                    change();
                  } catch (e) {
                    setError(e);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </label>
            {headers.length > 0 && (
              <>
                <div className="form-grid">
                  {Object.entries(columns).map(([key, name]) => (
                    <label key={key}>
                      Colonna {name}
                      <select
                        aria-label={"Colonna " + name}
                        value={map[key] ?? ""}
                        onChange={(e) => {
                          change();
                          setMap({ ...map, [key]: e.target.value });
                          setChoices({});
                        }}
                      >
                        <option value="">Non presente</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                  <label>
                    Classe predefinita
                    <select
                      aria-label="Classe predefinita"
                      value={cls}
                      onChange={(e) => {
                        change();
                        setClass(e.target.value);
                        setChoices({});
                      }}
                    >
                      <option value="">Da file o senza iscrizione</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {label("classes", c, data)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Data ingresso nuove iscrizioni
                    <input
                      type="date"
                      value={day}
                      onChange={(e) => {
                        change();
                        setDay(e.target.value);
                      }}
                    />
                  </label>
                </div>
              </>
            )}
          </section>
          {rows.slice(page * 50, page * 50 + 50).map((r, offset) => {
            const i = page * 50 + offset;
            const c = choice(i),
              student = data.students?.find((s) => s.id === c.student_id),
              names = (data.students ?? []).filter(
                (s) =>
                  text(s, "first_name").toLocaleLowerCase() ===
                    cell(r, "first_name").toLocaleLowerCase() &&
                  text(s, "last_name").toLocaleLowerCase() ===
                    cell(r, "last_name").toLocaleLowerCase(),
              );
            return (
              <article className="card" key={i}>
                <h2>
                  Riga {i + 1}: {cell(r, "last_name")} {cell(r, "first_name")}
                </h2>
                <p>
                  Codice file: {cell(r, "external_code") || "Assente"} ·
                  Candidati omonimi: {names.length}, da confermare manualmente.
                </p>
                <div className="form-grid">
                  <label>
                    Azione riga {i + 1}
                    <select
                      value={c.action}
                      onChange={(e) => patch(i, { action: e.target.value })}
                    >
                      <option value="pending">Da riconciliare</option>
                      <option value="insert">
                        Inserisci nuova persona (conferma identità distinta)
                      </option>
                      <option value="update">
                        Aggiorna studente selezionato
                      </option>
                      <option value="skip">Escludi</option>
                    </select>
                  </label>
                  {c.action === "update" && (
                    <label>
                      Studente esistente riga {i + 1}
                      <select
                        value={c.student_id}
                        onChange={(e) =>
                          patch(i, { student_id: e.target.value })
                        }
                      >
                        <option value="">Seleziona identità</option>
                        {data.students?.map((s) => (
                          <option key={s.id} value={s.id}>
                            {label("students", s, data)} ·{" "}
                            {text(s, "external_code")}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>
                    Classe riga {i + 1}
                    <select
                      value={c.class_id}
                      onChange={(e) => patch(i, { class_id: e.target.value })}
                    >
                      <option value="">Nessuna iscrizione</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {label("classes", c, data)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Numero riga {i + 1}
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={c.register_number}
                      placeholder="Primo libero suggerito in anteprima"
                      onChange={(e) =>
                        patch(i, { register_number: e.target.value })
                      }
                    />
                  </label>
                </div>
                {student && (
                  <p>
                    Prima: {text(student, "last_name")}{" "}
                    {text(student, "first_name")} ·{" "}
                    {text(student, "external_code")} · versione{" "}
                    {student.version}. Dopo: {cell(r, "last_name")}{" "}
                    {cell(r, "first_name")} ·{" "}
                    {cell(r, "external_code") || text(student, "external_code")}
                    . Iscrizione attuale: numero{" "}
                    {text(
                      historical.data?.find(
                        (e) =>
                          e.student_id === student.id &&
                          e.class_id === c.class_id,
                      ),
                      "register_number",
                    ) || "non presente"}
                    ; nuovo numero{" "}
                    {c.register_number ||
                      "esistente o primo libero, da verificare nell’anteprima"}
                    .
                  </p>
                )}
              </article>
            );
          })}
          {rows.length > 50 && (
            <nav className="form-actions" aria-label="Pagine riconciliazione">
              <button
                className="button"
                disabled={!page}
                onClick={() => setPage((p) => p - 1)}
              >
                Righe precedenti
              </button>
              <p>
                Righe {page * 50 + 1}–{Math.min(rows.length, page * 50 + 50)} di{" "}
                {rows.length}
              </p>
              <button
                className="button"
                disabled={(page + 1) * 50 >= rows.length}
                onClick={() => setPage((p) => p + 1)}
              >
                Righe successive
              </button>
            </nav>
          )}
          {rows.length > 0 && !report && (
            <button
              className="button"
              disabled={busy || !online}
              onClick={() => void review()}
            >
              Verifica anteprima avanzata
            </button>
          )}
          {preview && !report && (
            <section className="card">
              <h2>Anteprima validata</h2>
              <p>
                {preview.filter((r) => r.action === "insert").length}{" "}
                inserimenti ·{" "}
                {preview.filter((r) => r.action === "update").length}{" "}
                aggiornamenti ·{" "}
                {preview.filter((r) => r.action === "skip").length} esclusioni.
              </p>
              {preview.map((r, i) => (
                <p key={i}>
                  Riga {i + 1}: {String(r.action)} · {String(r.last_name ?? "")}{" "}
                  {String(r.first_name ?? "")} · registro{" "}
                  {String(r.register_number ?? "—")}
                </p>
              ))}
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
                Ho verificato identità, modifiche, iscrizioni e numeri
                dell’anteprima.
              </label>
              <button
                className="button primary"
                disabled={busy || !online || !reviewed}
                onClick={() => void apply()}
              >
                Conferma importazione avanzata
              </button>
            </section>
          )}
          {report && (
            <section className="card" role="status">
              <h2>Report importazione</h2>
              <p>
                {report.already_applied
                  ? "File già applicato: nessuna duplicazione."
                  : "Importazione atomica completata."}
              </p>
              <p>
                Inseriti: {String(report.created)} · Aggiornati:{" "}
                {String(report.updated)} · Iscrizioni:{" "}
                {String(report.enrollments)} · Esclusi: {String(report.skipped)}
              </p>
            </section>
          )}
        </>
      )}
    </>
  );
}
