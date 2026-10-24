import { useState } from "react";
import {
  criterion,
  exercise,
  distributePoints,
  sumPoints,
  levels,
  type Grid,
  type Section,
  type Exercise,
  type Criterion,
} from "../domain/grids";
type Props = { grid: Grid; change: (grid: Grid) => void };
export function GridStructureEditor({ grid, change }: Props) {
  function section(id: string, patch: Partial<Section>) {
    change({
      ...grid,
      sections: grid.sections.map((s) =>
        s.id === id ? { ...s, ...patch } : s,
      ),
    });
  }
  function editExercise(s: Section, e: Exercise, patch: Partial<Exercise>) {
    const next = { ...e, ...patch };
    if (patch.criteria)
      try {
        next.maximum = sumPoints(next.criteria.map((c) => c.maximum));
      } catch {
        /* Keep invalid input visible for correction. */
      }
    const exercises = s.exercises.map((x) => (x.id === e.id ? next : x));
    section(s.id, { exercises });
  }
  function editCriterion(
    s: Section,
    e: Exercise,
    c: Criterion,
    patch: Partial<Criterion>,
  ) {
    editExercise(s, e, {
      criteria: e.criteria.map((x) => (x.id === c.id ? { ...x, ...patch } : x)),
    });
  }
  function recalculate() {
    try {
      const sections = grid.sections
        .map((s) => ({
          ...s,
          exercises: s.exercises.map((e) => ({
            ...e,
            maximum: sumPoints(e.criteria.map((c) => c.maximum)),
          })),
        }))
        .map((s) => ({
          ...s,
          maximum: sumPoints(s.exercises.map((e) => e.maximum)),
        }));
      change({
        ...grid,
        sections,
        maximum: sumPoints(sections.map((s) => s.maximum)),
      });
    } catch {
      /* Inline validation reports invalid numbers. */
    }
  }
  return (
    <>
      <div className="form-grid">
        <label>
          Titolo modello
          <input
            value={grid.title}
            onChange={(e) => change({ ...grid, title: e.target.value })}
          />
        </label>
        <label>
          Punteggio massimo della prova
          <input
            type="number"
            min="0.001"
            step="any"
            value={grid.maximum}
            onChange={(e) => change({ ...grid, maximum: e.target.value })}
          />
        </label>
        <label>
          Precisione punti
          <select
            value={grid.precision}
            onChange={(e) =>
              change({ ...grid, precision: Number(e.target.value) })
            }
          >
            {[0, 1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n} decimali
              </option>
            ))}
          </select>
        </label>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={grid.argumentation}
            onChange={(e) =>
              change({ ...grid, argumentation: e.target.checked })
            }
          />
          Argomentazione prevista
        </label>
      </div>
      <details>
        <summary>Competenze e massimali ({grid.competencies.length})</summary>
        <p>
          Le ripartizioni dei quattro modelli matematici sono preimpostate; puoi
          personalizzarle. I descrittori originali non sono stati forniti: i
          campi restano vuoti finché non li inserisci.
        </p>
        {grid.competencies.map((s, i) => (
          <div className="card" key={s.id}>
            <div className="form-grid">
              <label>
                Competenza {i + 1}
                <input
                  value={s.label}
                  onChange={(e) =>
                    change({
                      ...grid,
                      competencies: grid.competencies.map((x) =>
                        x.id === s.id ? { ...x, label: e.target.value } : x,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Massimo competenza {i + 1}
                <input
                  type="number"
                  step="any"
                  value={s.maximum}
                  onChange={(e) =>
                    change({
                      ...grid,
                      competencies: grid.competencies.map((x) =>
                        x.id === s.id ? { ...x, maximum: e.target.value } : x,
                      ),
                    })
                  }
                />
              </label>
            </div>
            <label>
              Descrittore competenza {i + 1}
              <textarea
                value={s.description}
                placeholder="Descrittore da fornire / testo personale"
                onChange={(e) =>
                  change({
                    ...grid,
                    competencies: grid.competencies.map((x) =>
                      x.id === s.id ? { ...x, description: e.target.value } : x,
                    ),
                  })
                }
              />
            </label>
            <button
              className="button danger"
              onClick={() =>
                change({
                  ...grid,
                  competencies: grid.competencies.filter((x) => x.id !== s.id),
                })
              }
            >
              Rimuovi competenza {i + 1}
            </button>
          </div>
        ))}
        <button
          className="button"
          onClick={() =>
            change({
              ...grid,
              competencies: [
                ...grid.competencies,
                {
                  id: crypto.randomUUID(),
                  label: "Nuova competenza",
                  maximum: "1",
                  description: "",
                },
              ],
            })
          }
        >
          Aggiungi competenza
        </button>
      </details>
      {grid.sections.map((s, si) => (
        <section className="card section-card" key={s.id}>
          <h3>Sezione {si + 1}</h3>
          <div className="form-grid">
            <label>
              Nome sezione {si + 1}
              <input
                value={s.label}
                onChange={(e) => section(s.id, { label: e.target.value })}
              />
            </label>
            <label>
              Totale sezione {si + 1}
              <input
                type="number"
                step="any"
                value={s.maximum}
                onChange={(e) => section(s.id, { maximum: e.target.value })}
              />
            </label>
          </div>
          <Distribution
            section={s}
            grid={grid}
            apply={(exercises) => section(s.id, { exercises })}
          />
          {s.exercises.map((e, ei) => (
            <details key={e.id}>
              <summary>
                {e.label} · massimo {e.maximum}
              </summary>
              <div className="form-grid">
                <label>
                  Esercizio {si + 1}.{ei + 1}
                  <input
                    value={e.label}
                    onChange={(v) =>
                      editExercise(s, e, { label: v.target.value })
                    }
                  />
                </label>
                <label>
                  Massimo esercizio {si + 1}.{ei + 1}
                  <input
                    type="number"
                    step="any"
                    value={e.maximum}
                    onChange={(v) =>
                      editExercise(s, e, { maximum: v.target.value })
                    }
                  />
                </label>
              </div>
              {e.criteria.map((c, ci) => (
                <div className="criterion" key={c.id}>
                  <div className="form-grid">
                    <label>
                      Sottocriterio {si + 1}.{ei + 1}.{ci + 1}
                      <input
                        value={c.label}
                        onChange={(v) =>
                          editCriterion(s, e, c, { label: v.target.value })
                        }
                      />
                    </label>
                    <label>
                      Punti sottocriterio {si + 1}.{ei + 1}.{ci + 1}
                      <input
                        type="number"
                        step="any"
                        min="0.001"
                        value={c.maximum}
                        onChange={(v) =>
                          editCriterion(s, e, c, { maximum: v.target.value })
                        }
                      />
                    </label>
                    <label>
                      Competenza del sottocriterio
                      <select
                        value={c.competency_id ?? ""}
                        onChange={(v) =>
                          editCriterion(s, e, c, {
                            competency_id: v.target.value || undefined,
                          })
                        }
                      >
                        <option value="">Senza associazione</option>
                        {grid.competencies.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <details>
                    <summary>Descrittori e livelli</summary>
                    <label>
                      Descrizione sottocriterio
                      <textarea
                        value={c.description}
                        placeholder="Testo personale o descrittore originale da fornire"
                        onChange={(v) =>
                          editCriterion(s, e, c, {
                            description: v.target.value,
                          })
                        }
                      />
                    </label>
                    <p>
                      Intervalli da «Da» incluso a «A» escluso; l’ultimo include
                      il massimo. I testi vuoti non sono descrittori originali.
                    </p>
                    {c.levels.map((l, li) => (
                      <div className="card" key={li}>
                        <div className="form-grid">
                          <label>
                            Livello
                            <input
                              value={l.label}
                              onChange={(v) =>
                                editCriterion(s, e, c, {
                                  levels: c.levels.map((x, i) =>
                                    i === li
                                      ? { ...x, label: v.target.value }
                                      : x,
                                  ),
                                })
                              }
                            />
                          </label>
                          <label>
                            Da
                            <input
                              type="number"
                              step="any"
                              value={l.from}
                              onChange={(v) =>
                                editCriterion(s, e, c, {
                                  levels: c.levels.map((x, i) =>
                                    i === li
                                      ? { ...x, from: v.target.value }
                                      : x,
                                  ),
                                })
                              }
                            />
                          </label>
                          <label>
                            A
                            <input
                              type="number"
                              step="any"
                              value={l.to}
                              onChange={(v) =>
                                editCriterion(s, e, c, {
                                  levels: c.levels.map((x, i) =>
                                    i === li ? { ...x, to: v.target.value } : x,
                                  ),
                                })
                              }
                            />
                          </label>
                        </div>
                        <label>
                          Descrittore livello
                          <textarea
                            value={l.description}
                            onChange={(v) =>
                              editCriterion(s, e, c, {
                                levels: c.levels.map((x, i) =>
                                  i === li
                                    ? { ...x, description: v.target.value }
                                    : x,
                                ),
                              })
                            }
                          />
                        </label>
                      </div>
                    ))}
                    <button
                      className="button"
                      onClick={() => {
                        try {
                          editCriterion(s, e, c, {
                            levels: levels(c.maximum).map((l, i) => ({
                              ...l,
                              description: c.levels[i]?.description ?? "",
                            })),
                          });
                        } catch {
                          /* Keep invalid maxima visible. */
                        }
                      }}
                    >
                      Proponi intervalli dei quattro livelli
                    </button>
                  </details>
                  <button
                    className="button danger"
                    onClick={() =>
                      editExercise(s, e, {
                        criteria: e.criteria.filter((x) => x.id !== c.id),
                      })
                    }
                  >
                    Rimuovi sottocriterio {ci + 1}
                  </button>
                </div>
              ))}
              <div className="form-actions">
                <button
                  className="button"
                  onClick={() =>
                    editExercise(s, e, {
                      criteria: [...e.criteria, criterion("1")],
                    })
                  }
                >
                  Aggiungi sottocriterio
                </button>
                <button
                  className="button danger"
                  onClick={() =>
                    section(s.id, {
                      exercises: s.exercises.filter((x) => x.id !== e.id),
                    })
                  }
                >
                  Rimuovi esercizio {ei + 1}
                </button>
              </div>
            </details>
          ))}
          <div className="form-actions">
            <button
              className="button"
              onClick={() =>
                section(s.id, {
                  exercises: [
                    ...s.exercises,
                    exercise("1", `Esercizio ${s.exercises.length + 1}`),
                  ],
                })
              }
            >
              Aggiungi esercizio
            </button>
            <button
              className="button danger"
              onClick={() =>
                change({
                  ...grid,
                  sections: grid.sections.filter((x) => x.id !== s.id),
                })
              }
            >
              Rimuovi sezione {si + 1}
            </button>
          </div>
        </section>
      ))}
      <div className="form-actions">
        <button
          className="button"
          onClick={() =>
            change({
              ...grid,
              sections: [
                ...grid.sections,
                {
                  id: crypto.randomUUID(),
                  label: `Sezione ${grid.sections.length + 1}`,
                  maximum: "1",
                  exercises: [exercise()],
                },
              ],
            })
          }
        >
          Aggiungi sezione
        </button>
        <button className="button" onClick={recalculate}>
          Ricalcola massimi da tutti i sottocriteri
        </button>
      </div>
    </>
  );
}
function Distribution({
  section,
  grid,
  apply,
}: {
  section: Section;
  grid: Grid;
  apply: (exercises: Exercise[]) => void;
}) {
  const [count, setCount] = useState(3),
    [total, setTotal] = useState(section.maximum),
    [skill, setSkill] = useState(""),
    [error, setError] = useState("");
  return (
    <details>
      <summary>Distribuzione automatica punti della sezione</summary>
      <div className="form-grid">
        <label>
          Numero esercizi da generare
          <input
            type="number"
            min="1"
            max="200"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </label>
        <label>
          Punti da distribuire
          <input
            type="number"
            step="any"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
          />
        </label>
        <label>
          Competenza iniziale
          <select value={skill} onChange={(e) => setSkill(e.target.value)}>
            <option value="">Scegli / senza competenza</option>
            {grid.competencies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p>
        Il comando sostituisce gli esercizi di questa bozza, distribuisce ogni
        unità residua e lascia modificabili i sottocriteri. Ricalcola poi i
        totali della struttura.
      </p>
      <button
        className="button"
        onClick={() => {
          try {
            setError("");
            apply(
              distributePoints(total, count, grid.precision).map((p, i) =>
                exercise(p, `Esercizio ${i + 1}`, skill || undefined),
              ),
            );
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        Sostituisci esercizi con distribuzione uniforme
      </button>
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
