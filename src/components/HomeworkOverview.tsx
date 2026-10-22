import { useState } from "react";
import { useData, useRows } from "../state/data";
import { usePermissions } from "../hooks/permissions";
import { label } from "../domain/catalog";
import { text, today, type Row } from "../types/model";
import { ErrorBox } from "./ui";
export function HomeworkOverview({ assignment }: { assignment: Row }) {
  const { data, save } = useData();
  const { writable } = usePermissions();
  const summary = useRows("v_homework_summary");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<unknown>();
  const students = (data.enrollments ?? []).filter(
    (e) => e.class_id === assignment.class_id && !e.ends_on,
  );
  const exercises = (data.assignment_exercises ?? []).filter(
    (e) => e.assignment_id === assignment.id,
  );
  async function all(enrollment: Row, outcome: string) {
    setBusy(enrollment.id);
    setError(undefined);
    try {
      let check = data.homework_checks?.find(
        (h) =>
          h.assignment_id === assignment.id &&
          h.enrollment_id === enrollment.id,
      );
      check ??= await save("homework_checks", {
        assignment_id: assignment.id,
        class_id: text(assignment, "class_id"),
        enrollment_id: enrollment.id,
        checked_on: today(),
        visibility: text(assignment, "visibility") || "workspace",
      });
      for (const exercise of exercises) {
        const r = data.homework_exercise_results?.find(
          (x) =>
            x.homework_check_id === check!.id && x.exercise_id === exercise.id,
        );
        await save(
          "homework_exercise_results",
          r
            ? { outcome }
            : {
                homework_check_id: check.id,
                assignment_id: assignment.id,
                exercise_id: exercise.id,
                outcome,
                visibility: text(check, "visibility") || "workspace",
              },
          r,
        );
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="card">
      <h2>Vista massiva della classe</h2>
      <ErrorBox error={error ?? summary.error} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Studente</th>
              <th>Svolti</th>
              <th>Corretti</th>
              <th>Parziali</th>
              <th>Errati</th>
              <th>Non svolti</th>
              <th>Controllo rapido</th>
            </tr>
          </thead>
          <tbody>
            {students.map((e) => {
              const check = data.homework_checks?.find(
                (c) =>
                  c.assignment_id === assignment.id && c.enrollment_id === e.id,
              );
              const s = summary.data?.find(
                (s) => s.homework_check_id === check?.id,
              );
              return (
                <tr key={e.id}>
                  <td>{label("enrollments", e, data)}</td>
                  <td>
                    {check?.excused
                      ? "Giustificato"
                      : s
                        ? text(s, "completed_percent") + "%"
                        : "Da controllare"}
                  </td>
                  {["correct", "partial", "wrong", "not_done"].map((k) => (
                    <td key={k}>{text(s, k) || "—"}</td>
                  ))}
                  <td>
                    <div className="quick-buttons">
                      <button
                        className="button"
                        disabled={
                          !!busy ||
                          !exercises.length ||
                          !writable("homework_checks", check)
                        }
                        onClick={() => void all(e, "correct")}
                      >
                        Completi
                      </button>
                      <button
                        className="button"
                        disabled={
                          !!busy ||
                          !exercises.length ||
                          !writable("homework_checks", check)
                        }
                        onClick={() => void all(e, "not_done")}
                      >
                        Non svolti
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
