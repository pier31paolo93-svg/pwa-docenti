import { italianDate } from "../domain/time";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useData, useRows } from "../state/data";
import { useCapabilities } from "../hooks/capabilities";
import { usePermissions } from "../hooks/permissions";
import { label } from "../domain/catalog";
import { inContext } from "../domain/context";
import { text, type Row } from "../types/model";
import { PageTitle, ErrorBox, Modal } from "../components/ui";
import { EntityForm } from "../components/EntityForm";
import { ExportMenu } from "../components/ExportMenu";
import { useUnsavedChanges, allowContextChange } from "../hooks/unsaved";
export function Recovery() {
  const { data, filters, save } = useData(),
    caps = useCapabilities(),
    { writable } = usePermissions(),
    qc = useQueryClient(),
    [params] = useSearchParams();
  const activities = useRows("recovery_activities", !!caps.data?.recovery),
    targets = useRows("recovery_students", !!caps.data?.recovery);
  const [edit, setEdit] = useState<Row | null | undefined>(),
    [selected, setSelected] = useState(params.get("activity") ?? ""),
    [chosen, setChosen] = useState<string[]>([]),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false);
  useUnsavedChanges(chosen.length > 0);
  const rows = (activities.data ?? []).filter(
      (r) => !r.deleted_at && inContext(r, data, filters),
    ),
    activity = rows.find((r) => r.id === selected) ?? rows[0];
  async function assign() {
    if (!activity) return;
    setBusy(true);
    try {
      for (const id of chosen) {
        const existing = targets.data?.find(
          (t) => t.activity_id === activity.id && t.enrollment_id === id,
        );
        if (existing && !existing.deleted_at) continue;
        await save(
          "recovery_students",
          {
            activity_id: activity.id,
            class_id: activity.class_id as string,
            enrollment_id: id,
            status: "planned",
            visibility: activity.visibility as string,
            ...(existing ? { deleted_at: null } : {}),
          },
          existing,
        );
      }
      setChosen([]);
      await targets.refetch();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        title="Recupero"
        subtitle="Attività e assegnazioni decise dal docente; nessuna attribuzione automatica dalle statistiche."
        action={
          <button
            className="button primary"
            disabled={!caps.data?.recovery || !writable("recovery_activities")}
            onClick={() => setEdit(null)}
          >
            Nuova attività
          </button>
        }
      />
      <ErrorBox error={error ?? activities.error ?? targets.error} />
      {!caps.data?.recovery ? (
        <p>È necessaria la migrazione V1.3/V1.4 24 per il recupero.</p>
      ) : (
        <>
          <ExportMenu
            title="Attività di recupero"
            rows={rows.flatMap((r) => {
              const students =
                targets.data?.filter(
                  (t) => t.activity_id === r.id && !t.deleted_at,
                ) ?? [];
              return (students.length ? students : [undefined]).map((t) => ({
                Titolo: text(r, "title"),
                Obiettivo: text(r, "objective"),
                Scadenza: text(r, "due_on"),
                Stato: text(r, "status"),
                Studente: t
                  ? label(
                      "enrollments",
                      data.enrollments?.find((e) => e.id === t.enrollment_id) ??
                        t,
                      data,
                    )
                  : "Nessuna assegnazione",
                StatoStudente: text(t, "status"),
                Esito: text(t, "outcome"),
                Classe: label(
                  "classes",
                  data.classes?.find((c) => c.id === r.class_id) ?? r,
                  data,
                ),
              }));
            })}
          />
          <label>
            Attività
            <select
              aria-label="Attività di recupero"
              value={activity?.id ?? ""}
              onChange={(e) => {
                if (!allowContextChange()) return;
                setSelected(e.target.value);
                setChosen([]);
              }}
            >
              {rows.map((r) => (
                <option key={r.id} value={r.id}>
                  {text(r, "title")}
                </option>
              ))}
            </select>
          </label>
          {activity && (
            <section className="card">
              <h2>{text(activity, "title")}</h2>
              <p>
                {text(activity, "objective")} ·{" "}
                {italianDate(text(activity, "due_on")) || "Senza scadenza"}
              </p>
              {!!activity.assessment_id && (
                <Link to={"/verifiche/" + activity.assessment_id}>
                  Apri verifica di origine
                </Link>
              )}
              <button
                className="button"
                disabled={!writable("recovery_activities", activity)}
                onClick={() => setEdit(activity)}
              >
                Modifica attività
              </button>
              <h3>Assegna agli studenti della classe</h3>
              {data.enrollments
                ?.filter(
                  (e) =>
                    e.class_id === activity.class_id &&
                    !targets.data?.some(
                      (t) =>
                        t.activity_id === activity.id &&
                        t.enrollment_id === e.id &&
                        !t.deleted_at,
                    ),
                )
                .map((e) => (
                  <label className="inline-check" key={e.id}>
                    <input
                      type="checkbox"
                      checked={chosen.includes(e.id)}
                      onChange={(v) =>
                        setChosen(
                          v.target.checked
                            ? [...chosen, e.id]
                            : chosen.filter((x) => x !== e.id),
                        )
                      }
                    />
                    {label("enrollments", e, data)}
                  </label>
                ))}
              <button
                className="button"
                disabled={
                  busy ||
                  !chosen.length ||
                  !writable("recovery_activities", activity)
                }
                onClick={() => void assign()}
              >
                Assegna ai selezionati
              </button>
              {targets.data
                ?.filter((t) => t.activity_id === activity.id && !t.deleted_at)
                .map((t) => (
                  <RecoveryTarget
                    key={t.id + ":" + t.version}
                    target={t}
                    save={async (patch) => {
                      try {
                        await save("recovery_students", patch, t);
                        await targets.refetch();
                      } catch (e) {
                        setError(e);
                      }
                    }}
                    disabled={!writable("recovery_activities", activity)}
                    name={label(
                      "enrollments",
                      data.enrollments?.find((e) => e.id === t.enrollment_id) ??
                        t,
                      data,
                    )}
                  />
                ))}
            </section>
          )}
        </>
      )}
      {edit !== undefined && (
        <Modal
          title={edit ? "Modifica recupero" : "Nuova attività di recupero"}
          close={() => setEdit(undefined)}
        >
          <EntityForm
            table="recovery_activities"
            row={edit ?? undefined}
            done={() => {
              setEdit(undefined);
              void activities.refetch();
              void qc.invalidateQueries({ queryKey: ["data"] });
            }}
          />
        </Modal>
      )}
    </>
  );
}
function RecoveryTarget({
  target,
  save,
  disabled,
  name,
}: {
  target: Row;
  save: (patch: { status: string; outcome: string }) => Promise<void>;
  disabled: boolean;
  name: string;
}) {
  const [status, setStatus] = useState(text(target, "status")),
    [outcome, setOutcome] = useState(text(target, "outcome")),
    [busy, setBusy] = useState(false);
  useUnsavedChanges(
    status !== text(target, "status") || outcome !== text(target, "outcome"),
  );
  return (
    <article className="card">
      <h3>{name}</h3>
      <label>
        Stato del recupero
        <select
          disabled={disabled || busy}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="planned">Pianificato</option>
          <option value="in_progress">In corso</option>
          <option value="completed">Completato</option>
        </select>
      </label>
      <label>
        Esito del recupero
        <textarea
          disabled={disabled || busy}
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
        />
      </label>
      <button
        className="button"
        disabled={disabled || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await save({ status, outcome });
          } finally {
            setBusy(false);
          }
        }}
      >
        Salva recupero
      </button>
    </article>
  );
}
