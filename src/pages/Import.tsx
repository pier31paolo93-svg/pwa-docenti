import { useState } from "react";
import {Link} from 'react-router-dom';
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../state/auth";
import { useData } from "../state/data";
import { supabase } from "../services/supabase";
import { pull } from "../services/api";
import { PageTitle, ErrorBox } from "../components/ui";
import { text, today, type Row } from "../types/model";
import type { Json } from "../types/database";
import { usePermissions } from "../hooks/permissions";
export function ImportPage() {
  const { workspace, role } = useAuth();
  const { writable } = usePermissions();
  const canImport = writable("import_batches");
  const { data, save, notice, online } = useData();
  const qc = useQueryClient();
  const [rows, setRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [map, setMap] = useState({
    first_name: "",
    last_name: "",
    external_code: "",
  });
  const [batch, setBatch] = useState<Row>();
  const [preview, setPreview] = useState<Row[]>([]);
  const [cls, setCls] = useState("");
  const [date, setDate] = useState(today());
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<"students" | "enrollments">("students");
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function read(file: File) {
    if (file.size > 5 * 1024 * 1024)
      throw new Error("Dimensione massima 5 MB.");
    let values: string[][] = [];
    if (/\.csv$/i.test(file.name)) {
      const Papa = (await import("papaparse")).default;
      const parsed = Papa.parse<string[]>(await file.text(), {
        skipEmptyLines: "greedy",
      });
      if (parsed.errors.length) throw new Error(parsed.errors[0].message);
      values = parsed.data;
    } else if (/\.xlsx$/i.test(file.name)) {
      const ExcelJS = await import("exceljs");
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(await file.arrayBuffer());
      const sheet = book.worksheets[0];
      if (!sheet) throw new Error("File senza fogli.");
      sheet.eachRow((row) => {
        values.push(
          Array.from(
            { length: sheet.columnCount },
            (_, i) => row.getCell(i + 1).text,
          ),
        );
      });
    } else throw new Error("Scegli un file CSV oppure XLSX.");
    if (values.length < 2 || values.length > 1001)
      throw new Error("Inserisci intestazione e da 1 a 1000 righe.");
    const h = values.shift()!.map((v, i) => v.trim() || "Colonna " + (i + 1));
    if (new Set(h).size !== h.length)
      throw new Error("Le intestazioni devono essere univoche.");
    setHeaders(h);
    setRows(values);
    setBatch(undefined);
    setPreview([]);
    setMap({
      first_name: h.find((v) => /^nome$|first.?name/i.test(v)) ?? "",
      last_name: h.find((v) => /^cognome$|last.?name/i.test(v)) ?? "",
      external_code: h.find((v) => /codice|external.?code/i.test(v)) ?? "",
    });
  }
  async function makePreview(
    kind: "students" | "enrollments",
    payload: Json[],
  ) {
    const { data: id, error } = await supabase.rpc("preview_import", {
      p_workspace: workspace,
      p_kind: kind,
      p_rows: payload,
    });
    if (error) throw error;
    const [bs, rs] = await Promise.all([
      pull("import_batches", workspace),
      pull("import_rows", workspace),
    ]);
    setStage(kind);
    setBatch(bs.find((b) => b.id === id));
    setPreview(
      rs
        .filter((r) => r.batch_id === id)
        .sort((a, b) => Number(a.row_number) - Number(b.row_number)),
    );
  }
  async function apply() {
    if (!batch) return;
    if (preview.some((r) => r.resolution === "pending"))
      throw new Error("Risolvi ogni riga prima di applicare.");
    if (
      !window.confirm(
        "Confermi l’importazione delle righe selezionate nel workspace corrente?",
      )
    )
      return;
    const { data: count, error } = await supabase.rpc("frontend_apply_import", {
      p_batch: batch.id,
      p_expected_version: batch.version!,
    });
    if (error) throw error;
    notice(count + " righe importate.");
    await qc.invalidateQueries({ queryKey: ["data"] });
    setBatch({ ...batch, status: "applied" });
  }
  return (
    <>
      <PageTitle
        eyebrow="IMPORTAZIONE CONTROLLATA"
        title="Importa studenti"
        subtitle="CSV e XLSX, massimo 1000 righe. Il server controlla i duplicati prima della conferma."
      />
      <ErrorBox error={error} />
      <Link className="button" to="/importa-avanzato">Importazione avanzata con riconciliazione e registro</Link>
      {role === "viewer" || !canImport ? (
        <p>Il tuo ruolo consente solo la consultazione.</p>
      ) : (
        <>
          <section className="card">
            <label>
              File CSV o XLSX
              <input
                type="file"
                accept=".csv,.xlsx"
                disabled={busy || !online}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void run(() => read(f));
                }}
              />
            </label>
            {headers.length > 0 && (
              <>
                <div className="form-grid">
                  {Object.entries({
                    first_name: "Nome",
                    last_name: "Cognome",
                    external_code: "Codice locale stabile",
                  }).map(([key, title]) => (
                    <label key={key}>
                      {title}
                      <select
                        value={map[key as keyof typeof map]}
                        onChange={(e) =>
                          setMap({ ...map, [key]: e.target.value })
                        }
                      >
                        <option value="">
                          {key === "external_code"
                            ? "Genera un codice UUID"
                            : "Scegli colonna"}
                        </option>
                        {headers.map((h) => (
                          <option key={h}>{h}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <p>
                  {rows.length} righe lette. Il codice locale permette di
                  riconoscere i duplicati; conserva i codici generati per
                  importazioni future.
                </p>
                <button
                  className="button primary"
                  disabled={
                    busy || !online || !map.first_name || !map.last_name
                  }
                  onClick={() =>
                    void run(async () => {
                      const get = (r: string[], key: keyof typeof map) =>
                        r[headers.indexOf(map[key])]?.trim() ?? "";
                      await makePreview(
                        "students",
                        rows.map((r) => ({
                          first_name: get(r, "first_name"),
                          last_name: get(r, "last_name"),
                          external_code:
                            get(r, "external_code") ||
                            "LOC-" + crypto.randomUUID(),
                        })),
                      );
                    })
                  }
                >
                  Genera anteprima server
                </button>
              </>
            )}
          </section>
          {batch && (
            <section className="card">
              <h2>
                {stage === "students"
                  ? "Anteprima studenti"
                  : "Anteprima iscrizioni"}
              </h2>
              <p>
                Batch {batch.id.slice(0, 8)} · {text(batch, "status")}
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Riga</th>
                      <th>Dati</th>
                      <th>Validazione</th>
                      <th>Decisione</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r) => (
                      <tr key={r.id}>
                        <td>{text(r, "row_number")}</td>
                        <td>
                          {Object.entries(
                            r.payload as Record<string, string>,
                          ).map(([k, v]) => (
                            <div key={k}>
                              {k}: {v}
                            </div>
                          ))}
                        </td>
                        <td>{JSON.stringify(r.validation_errors)}</td>
                        <td>
                          <select
                            aria-label={"Decisione riga " + r.row_number}
                            value={text(r, "resolution")}
                            disabled={busy || batch.status === "applied"}
                            onChange={(e) =>
                              void run(async () => {
                                const saved = await save(
                                  "import_rows",
                                  { resolution: e.target.value },
                                  r,
                                );
                                setPreview((old) =>
                                  old.map((x) => (x.id === r.id ? saved : x)),
                                );
                              })
                            }
                          >
                            <option value="pending">Da decidere</option>
                            <option
                              value="insert"
                              disabled={
                                JSON.stringify(r.validation_errors) !== "[]"
                              }
                            >
                              Inserisci
                            </option>
                            <option value="skip">Salta</option>
                            <option value="reject">Rifiuta</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="button primary"
                disabled={busy || !online || batch.status === "applied"}
                onClick={() => void run(apply)}
              >
                Applica importazione
              </button>
              {stage === "students" && batch.status === "applied" && (
                <>
                  <h3>Iscrivi gli studenti importati</h3>
                  <label>
                    Classe
                    <select
                      value={cls}
                      onChange={(e) => setCls(e.target.value)}
                    >
                      <option value="">Scegli…</option>
                      {data.classes?.map((c) => (
                        <option key={c.id} value={c.id}>
                          {text(c, "name")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Data iscrizione
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </label>
                  <button
                    className="button"
                    disabled={busy || !cls || !date}
                    onClick={() =>
                      void run(async () => {
                        const students = await pull("students", workspace);
                        const codes = preview
                          .filter((r) => r.resolution === "insert")
                          .map(
                            (r) =>
                              (r.payload as Record<string, string>)
                                .external_code,
                          );
                        await makePreview(
                          "enrollments",
                          students
                            .filter((s) =>
                              codes.includes(text(s, "external_code")),
                            )
                            .map((s) => ({
                              student_id: s.id,
                              class_id: cls,
                              starts_on: date,
                            })),
                        );
                      })
                    }
                  >
                    Controlla iscrizioni
                  </button>
                </>
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}
