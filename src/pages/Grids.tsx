import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useData, useRows } from "../state/data";
import { useAuth } from "../state/auth";
import { useCapabilities } from "../hooks/capabilities";
import { usePermissions } from "../hooks/permissions";
import { useUnsavedChanges } from "../hooks/unsaved";
import { GridStructureEditor } from "../components/GridStructureEditor";
import { PageTitle, ErrorBox } from "../components/ui";
import {
  gridErrors,
  mathematicalGrid,
  emptyGrid,
  duplicateGrid,
  eightyBands,
  type Grid,
} from "../domain/grids";
import { text, today, type Row } from "../types/model";
import { label } from "../domain/catalog";
import { friendlyError } from "../domain/friendlyErrors";
import { v12Rpc } from "../services/v12";
import type { Json } from "../types/database";
export function Grids() {
  const { data, save, online, filters } = useData(),
    auth = useAuth(),
    caps = useCapabilities(),
    { admin, writable } = usePermissions(),
    qc = useQueryClient(),
    navigate = useNavigate(),
    templates = useRows("assessment_rubrics");
  const [grid, setGrid] = useState<Grid>(),
    [template, setTemplate] = useState<Row>(),
    [step, setStep] = useState(0),
    [dirty, setDirty] = useState(false),
    [archived, setArchived] = useState(false),
    [shared, setShared] = useState(false);
  const [assignment, setAssignment] = useState(""),
    [title, setTitle] = useState(""),
    [date, setDate] = useState(today()),
    [kind, setKind] = useState("written"),
    [ruleId, setRuleId] = useState("");
  const [mode, setMode] = useState("linear"),
    [min, setMin] = useState("0"),
    [max, setMax] = useState("10"),
    [rounding, setRounding] = useState("0.1"),
    [pass, setPass] = useState("6"),
    [bands, setBands] = useState(JSON.stringify(eightyBands, null, 2)),
    [base, setBase] = useState("80");
  const [approved, setApproved] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(),
    [feedback, setFeedback] = useState("");
  const operation = useRef(crypto.randomUUID());
  useUnsavedChanges(dirty);
  const errors = grid ? gridErrors(grid) : [];
  const assignments = (data.teaching_assignments ?? []).filter(
    (a) =>
      !a.deleted_at &&
      (!filters.classId || a.class_id === filters.classId) &&
      (admin || a.teacher_id === auth.session?.user.id),
  );
  function begin(g: Grid, t?: Row) {
    setGrid(g);
    setTemplate(t);
    setTitle(g.title);
    setStep(0);
    setDirty(false);
    setApproved(false);
    setError(undefined);
    setFeedback("");
    setShared(t?.visibility === "workspace");
    operation.current = crypto.randomUUID();
  }
  function change(g: Grid) {
    setGrid(g);
    setDirty(true);
    setApproved(false);
    operation.current = crypto.randomUUID();
  }
  async function saveTemplate(copy = false) {
    if (!grid) return;
    setBusy(true);
    setError(undefined);
    try {
      if (errors.length) throw Error(errors.join(" "));
      const existing = copy ? undefined : template;
      const saved = await save(
        "assessment_rubrics",
        {
          name: grid.title,
          description:
            "Griglia universale V1.2; descrittori personali/originali da completare se assenti.",
          grid_definition: grid as unknown as Json,
          ...(!existing
            ? { visibility: shared ? "workspace" : "private" }
            : {}),
        },
        existing,
      );
      setTemplate(saved);
      setDirty(false);
      setFeedback(
        online
          ? "Modello salvato. Le verifiche precedenti restano invariate."
          : "Modello salvato nella coda cifrata.",
      );
      await templates.refetch();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  async function createAssessment() {
    if (!grid) return;
    setBusy(true);
    setError(undefined);
    try {
      if (!online || !approved || errors.length || !assignment || !title.trim())
        throw Error(
          "Completa i dati, correggi la griglia e approva il riepilogo online.",
        );
      let rule = data.evaluation_rules?.find((r) => r.id === ruleId);
      if (!rule) {
        if (!admin)
          throw Error("Scegli una regola configurata da Owner/Admin.");
        let parsed: unknown = [];
        try {
          parsed = JSON.parse(bands);
        } catch {
          throw Error("Fasce non valide: usa una lista di soglie e voti.");
        }
        rule = await save("evaluation_rules", {
          name: `${title} · ${mode === "bands" ? "fasce" : "lineare"}`,
          minimum: Number(min),
          maximum: Number(max),
          rounding_step: Number(rounding),
          pass_mark: Number(pass),
          conversion_mode: mode,
          band_maximum: Number(base),
          bands: parsed as Json,
          conversion_points: [
            [0, 0],
            [1, 1],
          ],
          visibility: "workspace",
        });
        setRuleId(rule.id);
      }
      const id = await v12Rpc<string>("create_grid_assessment", {
        p_workspace: auth.workspace,
        p_operation: operation.current,
        p_template: template?.id ?? null,
        p_template_version: template?.version ?? null,
        p_definition: grid,
        p_assignment: assignment,
        p_title: title,
        p_date: date,
        p_kind: kind,
        p_rule: rule.id,
        p_rule_version: rule.version,
      });
      setDirty(false);
      await qc.invalidateQueries({ queryKey: ["data"] });
      navigate("/verifiche/" + id);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  async function archiveTemplate(t: Row) {
    setError(undefined);
    try {
      await save(
        "assessment_rubrics",
        { archived_at: t.archived_at ? null : new Date().toISOString() },
        t,
      );
      await templates.refetch();
    } catch (e) {
      setError(friendlyError(e));
    }
  }
  return (
    <div className="v12-editor">
      <PageTitle
        title="Griglie di valutazione"
        subtitle="Modelli personali o condivisi, sottocriteri e conversione nel registro canonico. Nessun descrittore mancante viene inventato."
      />
      <ErrorBox error={error ?? templates.error} />
      <p role="status" aria-live="polite">
        {feedback}
      </p>
      {!caps.data?.universalGrids ? (
        <p role="alert">
          Le griglie universali richiedono la migrazione V1.2 23 autorizzata sul
          cloud. Le verifiche e le rubriche precedenti restano disponibili.
        </p>
      ) : (
        <>
          {!grid ? (
            <>
              <section className="card">
                <h2>Quattro modelli matematici</h2>
                <p>
                  Ripartizioni 20/30/30/20 oppure 20/30/30. Per il Biennio la
                  competenza Comprendere riguarda testi e rappresentazioni
                  grafiche. I descrittori originali devono essere forniti dalla
                  docente; puoi inserire testi personali senza presentarli come
                  originali.
                </p>
                <div className="v12-grid">
                  {(["algebra", "biennio"] as const).flatMap((type) =>
                    [true, false].map((arg) => (
                      <button
                        className="button"
                        key={type + arg}
                        onClick={() => begin(mathematicalGrid(type, arg))}
                      >
                        Matematica {type === "algebra" ? "Algebra" : "Biennio"}{" "}
                        {arg ? "con" : "senza"} argomentazione ·{" "}
                        {arg ? "100" : "80"} punti
                      </button>
                    )),
                  )}
                </div>
                <button
                  className="button primary"
                  onClick={() => begin(emptyGrid())}
                >
                  Crea griglia universale personalizzata
                </button>
              </section>
              <section className="card">
                <h2>I modelli disponibili nel workspace</h2>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={archived}
                    onChange={(e) => setArchived(e.target.checked)}
                  />
                  Includi modelli archiviati
                </label>
                <div className="v12-grid">
                  {templates.data
                    ?.filter(
                      (t) =>
                        !!t.grid_definition &&
                        !t.deleted_at &&
                        (archived || !t.archived_at),
                    )
                    .map((t) => (
                      <article className="card" key={t.id}>
                        <h3>{text(t, "name")}</h3>
                        <p>
                          Versione {t.version} ·{" "}
                          {t.visibility === "private"
                            ? "Personale"
                            : "Condiviso"}{" "}
                          · {t.archived_at ? "Archiviato" : "Disponibile"}
                        </p>
                        <div className="form-actions">
                          <button
                            className="button"
                            disabled={!!t.archived_at}
                            onClick={() =>
                              begin(
                                duplicateGrid(
                                  t.grid_definition as unknown as Grid,
                                ),
                                t,
                              )
                            }
                          >
                            Usa / modifica modello
                          </button>
                          <button
                            className="button"
                            onClick={() => {
                              const g = duplicateGrid(
                                t.grid_definition as unknown as Grid,
                              );
                              g.title += " · copia";
                              begin(g);
                            }}
                          >
                            Duplica modello
                          </button>
                          {writable("assessment_rubrics", t) && (
                            <button
                              className="button"
                              onClick={() => void archiveTemplate(t)}
                            >
                              {t.archived_at
                                ? "Ripristina modello"
                                : "Archivia modello"}
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                </div>
              </section>
            </>
          ) : (
            <>
              <nav className="wizard-steps" aria-label="Passaggi griglia">
                {[
                  "Prova e modello",
                  "Struttura e competenze",
                  "Conversione",
                  "Riepilogo",
                ].map((s, i) => (
                  <span key={s} aria-current={step === i ? "step" : undefined}>
                    {i + 1}. {s}
                  </span>
                ))}
              </nav>
              {step === 0 && (
                <section className="card">
                  <h2>Dati della prova</h2>
                  <p>
                    Puoi salvare soltanto il modello senza creare una verifica;
                    classe e data saranno richieste quando lo utilizzi.
                  </p>
                  <div className="form-grid">
                    <label>
                      Titolo verifica
                      <input
                        value={title}
                        onChange={(e) => {
                          setTitle(e.target.value);
                          setDirty(true);
                          setApproved(false);
                        }}
                      />
                    </label>
                    <label>
                      Classe e materia della griglia
                      <select
                        aria-label="Classe e materia della griglia"
                        value={assignment}
                        onChange={(e) => {
                          setAssignment(e.target.value);
                          setDirty(true);
                          setApproved(false);
                        }}
                      >
                        <option value="">Scegli incarico autorizzato…</option>
                        {assignments.map((a) => (
                          <option key={a.id} value={a.id}>
                            {label("teaching_assignments", a, data)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Data verifica
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => {
                          setDate(e.target.value);
                          setDirty(true);
                          setApproved(false);
                        }}
                      />
                    </label>
                    <label>
                      Tipologia
                      <select
                        aria-label="Tipologia"
                        value={kind}
                        onChange={(e) => {
                          setKind(e.target.value);
                          setDirty(true);
                          setApproved(false);
                        }}
                      >
                        <option value="written">Scritta</option>
                        <option value="oral">Orale</option>
                        <option value="practical">Pratica</option>
                        <option value="graded_exercise">
                          Esercitazione valutata
                        </option>
                      </select>
                    </label>
                    <label className="inline-check">
                      <input
                        type="checkbox"
                        checked={shared}
                        disabled={!!template}
                        onChange={(e) => {
                          setShared(e.target.checked);
                          setDirty(true);
                        }}
                      />
                      Modello condiviso nel workspace (altrimenti personale)
                    </label>
                  </div>
                </section>
              )}
              {step === 1 && (
                <GridStructureEditor grid={grid} change={change} />
              )}
              {step === 2 && (
                <section className="card">
                  <h2>Conversione del punteggio</h2>
                  <label>
                    Regola di conversione
                    <select
                      aria-label="Regola di conversione"
                      value={ruleId}
                      onChange={(e) => {
                        setRuleId(e.target.value);
                        setApproved(false);
                        setDirty(true);
                      }}
                    >
                      <option value="">
                        {admin ? "Crea una nuova regola" : "Scegli una regola"}
                      </option>
                      {data.evaluation_rules
                        ?.filter((r) => !r.deleted_at)
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {text(r, "name")}
                          </option>
                        ))}
                    </select>
                  </label>
                  {!ruleId && admin && (
                    <>
                      <div className="form-grid">
                        <label>
                          Metodo
                          <select
                            aria-label="Metodo"
                            value={mode}
                            onChange={(e) => setMode(e.target.value)}
                          >
                            <option value="linear">
                              Lineare: punti / massimo × voto massimo
                            </option>
                            <option value="bands">
                              Fasce con soglie inferiori inclusive
                            </option>
                          </select>
                        </label>
                        <label>
                          Voto minimo
                          <input
                            type="number"
                            step="any"
                            value={min}
                            onChange={(e) => setMin(e.target.value)}
                          />
                        </label>
                        <label>
                          Voto massimo
                          <input
                            type="number"
                            step="any"
                            value={max}
                            onChange={(e) => setMax(e.target.value)}
                          />
                        </label>
                        <label>
                          Sufficienza
                          <input
                            type="number"
                            step="any"
                            value={pass}
                            onChange={(e) => setPass(e.target.value)}
                          />
                        </label>
                        <label>
                          Arrotondamento
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            value={rounding}
                            onChange={(e) => setRounding(e.target.value)}
                          />
                        </label>
                      </div>
                      {mode === "bands" && (
                        <>
                          <label>
                            Base punti delle fasce
                            <input
                              type="number"
                              min="0.001"
                              step="any"
                              value={base}
                              onChange={(e) => setBase(e.target.value)}
                            />
                          </label>
                          <label>
                            Fasce configurabili
                            <textarea
                              rows={10}
                              spellCheck={false}
                              value={bands}
                              onChange={(e) => setBands(e.target.value)}
                            />
                          </label>
                          <p>
                            Ogni soglia è inclusiva fino alla soglia successiva
                            esclusa. Quindi 37,999 resta nella fascia da 30; 38
                            entra nella successiva. Le soglie sono espresse
                            sulla base indicata; per totali diversi il punteggio
                            è riportato proporzionalmente a quella base, senza
                            buchi tra decimali.
                          </p>
                        </>
                      )}
                    </>
                  )}
                  <p>
                    La regola e la versione sono catturate nella verifica:
                    modificare il modello o la regola generale non riscrive le
                    prove precedenti.
                  </p>
                </section>
              )}
              {errors.length > 0 && (
                <div role="alert" className="error">
                  <strong>Da correggere prima del salvataggio:</strong>
                  <ul>
                    {errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
              {step === 3 && (
                <section className="card">
                  <h2>Riepilogo della griglia</h2>
                  <p>
                    {title || grid.title} · {date} ·{" "}
                    {label(
                      "teaching_assignments",
                      data.teaching_assignments?.find(
                        (a) => a.id === assignment,
                      ) ?? { id: "" },
                      data,
                    )}
                  </p>
                  <p>
                    Massimo {grid.maximum} · {grid.sections.length} sezioni ·{" "}
                    {grid.sections.reduce((n, s) => n + s.exercises.length, 0)}{" "}
                    esercizi · {grid.competencies.length} competenze. La
                    creazione non pubblica alcun voto.
                  </p>
                  {grid.sections.map((s) => (
                    <p key={s.id}>
                      {s.label}:{" "}
                      {s.exercises
                        .map((e) => `${e.label} (${e.maximum})`)
                        .join(", ")}{" "}
                      · Totale {s.maximum}
                    </p>
                  ))}
                  <label className="inline-check">
                    <input
                      type="checkbox"
                      checked={approved}
                      onChange={(e) => setApproved(e.target.checked)}
                    />
                    Approvo struttura, massimali e conversione e creo lo
                    snapshot della verifica.
                  </label>
                </section>
              )}
              <div className="wizard-actions">
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      !dirty ||
                      window.confirm(
                        "Abbandonare le modifiche non salvate della griglia?",
                      )
                    ) {
                      setGrid(undefined);
                      setDirty(false);
                    }
                  }}
                >
                  Chiudi editor griglia
                </button>
                <button
                  className="button"
                  disabled={step === 0 || busy}
                  onClick={() => {
                    setStep(step - 1);
                    setApproved(false);
                  }}
                >
                  Indietro
                </button>
                {step < 3 ? (
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() => setStep(step + 1)}
                  >
                    Continua
                  </button>
                ) : (
                  <button
                    className="button primary"
                    disabled={
                      busy ||
                      !online ||
                      !approved ||
                      !!errors.length ||
                      !assignment ||
                      !title.trim()
                    }
                    onClick={() => void createAssessment()}
                  >
                    Crea verifica con griglia
                  </button>
                )}
              </div>
              <div className="form-actions">
                <button
                  className="button"
                  disabled={
                    busy ||
                    !!errors.length ||
                    (!!template && !writable("assessment_rubrics", template))
                  }
                  onClick={() => void saveTemplate()}
                >
                  Salva modello{template ? " aggiornato" : ""}
                </button>
                <button
                  className="button"
                  disabled={busy || !!errors.length}
                  onClick={() => void saveTemplate(true)}
                >
                  Salva come nuovo modello
                </button>
                <button
                  className="button"
                  onClick={() => {
                    void import("../services/gridReports")
                      .then((m) =>
                        m.exportBlankGrid(grid, {
                          title: title || grid.title,
                          context: label(
                            "teaching_assignments",
                            data.teaching_assignments?.find(
                              (a) => a.id === assignment,
                            ) ?? { id: "" },
                            data,
                          ),
                          date,
                        }),
                      )
                      .catch(setError);
                  }}
                >
                  PDF A4 griglia vuota
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
