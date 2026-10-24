import { useData, useRows } from "../state/data";
import { inContext } from "../domain/context";
import { text } from "../types/model";
export function TeachingSummary({
  student,
  from = "",
  to = "",
}: {
  student?: string;
  from?: string;
  to?: string;
}) {
  const { data, filters } = useData(),
    completion = useRows("v_homework_completion");
  const within = (date: string) =>
      (!from || date >= from) && (!to || date <= to),
    counts: Record<string, number> = {
      complete: 0,
      partial: 0,
      not_done: 0,
      unchecked: 0,
      excused: 0,
    };
  for (const assignment of (data.assignments ?? []).filter(
    (a) => inContext(a, data, filters) && within(text(a, "due_on")),
  )) {
    const roster = (data.enrollments ?? []).filter(
      (e) =>
        e.class_id === assignment.class_id &&
        (!student || e.student_id === student) &&
        text(e, "starts_on") <= text(assignment, "due_on") &&
        (!e.ends_on || text(e, "ends_on") >= text(assignment, "due_on")),
    );
    for (const e of roster) {
      const check = data.homework_checks?.find(
          (h) => h.assignment_id === assignment.id && h.enrollment_id === e.id,
        ),
        status =
          text(
            completion.data?.find((c) => c.id === check?.id),
            "completion_status",
          ) || "unchecked";
      counts[status] = (counts[status] ?? 0) + 1;
    }
  }
  const participation = (data.observations ?? []).filter(
    (o) =>
      o.participation &&
      inContext(o, data, filters) &&
      within(text(o, "observed_on")) &&
      (!student ||
        data.enrollments?.some(
          (e) => e.id === o.enrollment_id && e.student_id === student,
        )),
  );
  const trend = Object.entries(
    participation.reduce<Record<string, number>>((all, o) => {
      const day = text(o, "observed_on");
      all[day] = (all[day] ?? 0) + 1;
      return all;
    }, {}),
  ).sort(([a], [b]) => a.localeCompare(b));
  if (completion.isPending)
    return <p role="status">Caricamento riepilogo compiti…</p>;
  if (completion.error)
    return (
      <p role="alert">
        Riepilogo compiti non disponibile: riprova dalla sincronizzazione.
      </p>
    );
  return (
    <section className="card">
      <h2>Compiti e partecipazione nel periodo</h2>
      {[
        ["complete", "Compiti fatti"],
        ["partial", "Compiti parziali"],
        ["not_done", "Compiti non fatti"],
        ["unchecked", "Non controllati"],
        ["excused", "Giustificati"],
      ].map(([key, name]) => (
        <p key={key}>
          {name}: {counts[key]}
        </p>
      ))}
      <p>
        Partecipazione: {participation.length} annotazioni osservabili. La
        frequenza delle annotazioni non misura automaticamente capacità o
        impegno.
      </p>
      {trend.length < 2 ? (
        <p>Dati insufficienti per descrivere un andamento nel tempo.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Giorno</th>
                <th>Annotazioni</th>
              </tr>
            </thead>
            <tbody>
              {trend.map(([day, n]) => (
                <tr key={day}>
                  <td>{day}</td>
                  <td>{n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
