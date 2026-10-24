import type { Row } from "../types/model";
import type { DataMap } from "./catalog";
import { romeDay, dayShift } from "./teaching";
export type TimetableData = {
  versions: Row[];
  slots: Row[];
  exceptions: Row[];
};
export type Occurrence = {
  id: string;
  day: string;
  start: string;
  end: string;
  assignment: string;
  version: string;
  cancelled: boolean;
  variation: boolean;
  room: string;
  notes: string;
  lesson?: Row;
};
export const weekdays = [
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
  "Domenica",
];
export const weekday = (day: string) =>
  ((new Date(romeDay(day) + "T12:00:00Z").getUTCDay() + 6) % 7) + 1;
export const minutes = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
export const duration = (start: string, end: string) =>
  `${minutes(end) - minutes(start)} min · ${Number(((minutes(end) - minutes(start)) / 60).toFixed(2))} ore`;
export function occurrences(
  t: TimetableData,
  data: DataMap,
  day: string,
  teacher: string,
  year = "",
  school = "",
): Occurrence[] {
  const versions = t.versions.filter(
    (v) =>
      !v.deleted_at &&
      v.teacher_id === teacher &&
      v.status !== "draft" &&
      (!year || v.school_year_id === year) &&
      String(v.valid_from) <= day &&
      day <=
        String(
          v.valid_to ||
            data.school_years?.find((y) => y.id === v.school_year_id)
              ?.ends_on ||
            "",
        ),
  );
  const result: Occurrence[] = [];
  for (const v of versions) {
    const exceptions = t.exceptions.filter(
      (e) =>
        !e.deleted_at && e.timetable_version_id === v.id && e.occurs_on === day,
    );
    for (const s of t.slots.filter(
      (s) =>
        !s.deleted_at &&
        s.timetable_version_id === v.id &&
        Number(s.weekday) === weekday(day),
    )) {
      const e = exceptions.find((e) => e.slot_id === s.id);
      result.push({
        id: s.id,
        day,
        start: String(e?.starts_at || s.starts_at).slice(0, 5),
        end: String(e?.ends_at || s.ends_at).slice(0, 5),
        assignment: String(
          e?.teaching_assignment_id || s.teaching_assignment_id,
        ),
        version: v.id,
        cancelled: ["cancelled", "trip"].includes(String(e?.kind)),
        variation: !!e,
        room: String(e?.room ?? s.room ?? ""),
        notes: String(e?.notes ?? s.notes ?? ""),
      });
    }
    for (const e of exceptions.filter((e) => !e.slot_id))
      result.push({
        id: e.id,
        day,
        start: String(e.starts_at).slice(0, 5),
        end: String(e.ends_at).slice(0, 5),
        assignment: String(e.teaching_assignment_id),
        version: v.id,
        cancelled: false,
        variation: true,
        room: String(e.room ?? ""),
        notes: String(e.notes ?? ""),
      });
  }
  return result
    .filter((o) => {
      const ta = data.teaching_assignments?.find((a) => a.id === o.assignment),
        cls = data.classes?.find((c) => c.id === ta?.class_id);
      return !school || cls?.school_id === school;
    })
    .map((o) => ({
      ...o,
      lesson: data.lessons?.find(
        (l) =>
          !l.deleted_at &&
          ((l.timetable_occurrence_id === o.id &&
            l.timetable_occurs_on === day) ||
            (l.teaching_assignment_id === o.assignment &&
              romeDay(String(l.starts_at)) === day &&
              new Intl.DateTimeFormat("it-IT", {
                timeZone: "Europe/Rome",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(String(l.starts_at))) === o.start &&
              new Intl.DateTimeFormat("it-IT", {
                timeZone: "Europe/Rome",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(String(l.ends_at))) === o.end)),
      ),
    }))
    .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
}
export function timetableRange(
  t: TimetableData,
  data: DataMap,
  first: string,
  last: string,
  teacher: string,
  year = "",
  school = "",
) {
  const all: Occurrence[] = [];
  for (let day = first; day <= last; day = dayShift(day, 1))
    all.push(...occurrences(t, data, day, teacher, year, school));
  return all;
}
export const occurrenceRoute = (o: Occurrence) =>
  o.lesson
    ? `/registro/${o.lesson.id}`
    : `/registro-rapido?occurrence=${o.id}&day=${o.day}&assignment=${o.assignment}`;
