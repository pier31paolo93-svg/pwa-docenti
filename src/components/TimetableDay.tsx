import { Link } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../state/auth";
import { useData } from "../state/data";
import { useTimetable } from "../hooks/timetable";
import {
  occurrences,
  occurrenceRoute,
  type Occurrence,
} from "../domain/timetable";
import { label } from "../domain/catalog";
import type { Row } from "../types/model";
import { today } from "../types/model";
export function TimetableLookup() {
  const [day, setDay] = useState(today());
  return (
    <section>
      <label>
        Giornata prevista
        <input
          type="date"
          value={day}
          onChange={(e) => {
            if (e.target.value) setDay(e.target.value);
          }}
        />
      </label>
      <TimetableDay day={day} />
    </section>
  );
}
export function TimetableDay({
  day,
  onChoose,
  title = "Lezioni previste",
  hideRegistered = false,
}: {
  day: string;
  onChoose?: (o: Occurrence) => void;
  title?: string;
  hideRegistered?: boolean;
}) {
  const t = useTimetable(),
    { data, filters } = useData(),
    auth = useAuth();
  const items = occurrences(
    t.timetable,
    data,
    day,
    auth.session!.user.id,
    filters.year,
    filters.school,
  ).filter((o) => {
    const a = data.teaching_assignments?.find((a) => a.id === o.assignment),
      cs = data.class_subjects?.find((c) => c.id === a?.class_subject_id);
    return (
      (!hideRegistered || !o.lesson) &&
      (!filters.classId || a?.class_id === filters.classId) &&
      (!filters.subject || cs?.subject_id === filters.subject)
    );
  });
  if (!t.available && !t.cached) return null;
  return (
    <section className="card">
      <h2>{title}</h2>
      {(t.cached || !t.online) && (
        <p role="status">Copia offline: potrebbe non essere aggiornata.</p>
      )}
      {items.map((o) => (
        <article className="timetable-occurrence" key={o.id}>
          <strong>
            {o.start}–{o.end}
          </strong>{" "}
          ·{" "}
          {label(
            "teaching_assignments",
            data.teaching_assignments?.find((a) => a.id === o.assignment) ??
              ({ id: o.assignment } as Row),
            data,
          )}{" "}
          <span>
            {o.lesson
              ? "Registrata"
              : o.cancelled
                ? "Annullata"
                : o.variation
                  ? "Variazione · da registrare"
                  : "Da registrare"}
          </span>
          {o.room && <span> · {o.room}</span>}
          {!o.cancelled &&
            (onChoose ? (
              <button className="button" onClick={() => onChoose(o)}>
                Seleziona {o.start}
              </button>
            ) : (
              <Link className="button" to={occurrenceRoute(o)}>
                Apri registro
              </Link>
            ))}
        </article>
      ))}
      {!items.length && (
        <p>Nessuno slot previsto nella data e nei filtri selezionati.</p>
      )}
    </section>
  );
}
