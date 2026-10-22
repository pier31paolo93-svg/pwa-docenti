import type { TableName, Row, Patch } from "../types/model";
import { text, today } from "../types/model";
export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "datetime-local"
  | "select"
  | "checkbox"
  | "json";
export type Field = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  ref?: TableName | "members";
  options?: string[];
  default?: unknown;
  min?: number;
  max?: number;
};
export type Entity = {
  title: string;
  singular: string;
  fields: Field[];
  admin?: boolean;
  group: string;
};
const f = (
  name: string,
  label: string,
  type: FieldType = "text",
  extra: Partial<Field> = {},
): Field => ({ name, label, type, ...extra });
const req = (
  name: string,
  label: string,
  type: FieldType = "text",
  extra: Partial<Field> = {},
) => f(name, label, type, { required: true, ...extra });
const ref = (
  name: string,
  label: string,
  table: Field["ref"],
  required = true,
) => f(name, label, "select", { ref: table, required });
const choice = (name: string, label: string, options: string[], def?: string) =>
  req(name, label, "select", { options, default: def ?? options[0] });
const date = (name: string, label: string) =>
  req(name, label, "date", { default: today() });
const num = (name: string, label: string, def = 1, min = 0) =>
  req(name, label, "number", { default: def, min });
const ta = () =>
  ref("teaching_assignment_id", "Classe e materia", "teaching_assignments");
export const catalog: Partial<Record<TableName, Entity>> = {
  school_years: {
    title: "Anni scolastici",
    singular: "anno scolastico",
    group: "Organizzazione",
    fields: [
      req("label", "Anno scolastico"),
      date("starts_on", "Inizio"),
      date("ends_on", "Fine"),
    ],
  },
  schools: {
    title: "Scuole",
    singular: "scuola",
    group: "Organizzazione",
    fields: [req("name", "Nome della scuola"), req("code", "Codice scuola")],
  },
  subjects: {
    title: "Materie",
    singular: "materia",
    group: "Organizzazione",
    fields: [req("name", "Nome della materia"), req("code", "Codice")],
  },
  classes: {
    title: "Classi",
    singular: "classe",
    group: "Organizzazione",
    fields: [
      req("name", "Nome classe"),
      ref("school_id", "Scuola", "schools"),
      ref("school_year_id", "Anno scolastico", "school_years"),
    ],
  },
  students: {
    title: "Studenti",
    singular: "studente",
    group: "Organizzazione",
    fields: [
      req("first_name", "Nome"),
      req("last_name", "Cognome"),
      req("external_code", "Codice locale"),
    ],
  },
  enrollments: {
    title: "Iscrizioni",
    singular: "iscrizione",
    group: "Organizzazione",
    fields: [
      ref("student_id", "Studente", "students"),
      ref("class_id", "Classe", "classes"),
      date("starts_on", "Data di ingresso"),
      f("ends_on", "Data di uscita", "date"),
      f("outcome", "Esito", "select", {
        options: ["promoted", "repeating", "transferred", "withdrawn"],
      }),
    ],
  },
  class_subjects: {
    title: "Classi / Materie",
    singular: "associazione",
    group: "Organizzazione",
    fields: [
      ref("class_id", "Classe", "classes"),
      ref("subject_id", "Materia", "subjects"),
    ],
  },
  teaching_assignments: {
    title: "Assegnazioni docenti",
    singular: "assegnazione",
    group: "Organizzazione",
    admin: true,
    fields: [
      ref("class_subject_id", "Classe / materia", "class_subjects"),
      ref("teacher_id", "Docente", "members"),
    ],
  },
  topics: {
    title: "Argomenti",
    singular: "argomento",
    group: "Programmazione",
    fields: [
      ref("subject_id", "Materia", "subjects"),
      req("name", "Argomento"),
    ],
  },
  competencies: {
    title: "Competenze",
    singular: "competenza",
    group: "Programmazione",
    fields: [
      ref("subject_id", "Materia", "subjects"),
      req("code", "Codice"),
      req("description", "Descrizione", "textarea"),
    ],
  },
  lessons: {
    title: "Registro lezioni",
    singular: "lezione",
    group: "Programmazione",
    fields: [
      ta(),
      req("title", "Argomento della lezione"),
      req("starts_at", "Inizio", "datetime-local"),
      req("ends_at", "Fine", "datetime-local"),
      f("notes", "Annotazioni", "textarea"),
      choice("status", "Stato", ["draft", "confirmed"]),
    ],
  },
  lesson_topics: {
    title: "Argomenti delle lezioni",
    singular: "argomento associato",
    group: "Programmazione",
    fields: [
      ref("lesson_id", "Lezione", "lessons"),
      ref("topic_id", "Argomento", "topics"),
    ],
  },
  lesson_activities: {
    title: "Attività delle lezioni",
    singular: "attività",
    group: "Programmazione",
    fields: [
      ref("lesson_id", "Lezione", "lessons"),
      req("description", "Attività svolta", "textarea"),
      num("position", "Ordine", 0),
    ],
  },
  error_types: {
    title: "Tipologie di errore",
    singular: "tipo di errore",
    group: "Valutazione",
    fields: [req("code", "Codice"), req("description", "Descrizione")],
  },
  assignments: {
    title: "Compiti a casa",
    singular: "consegna",
    group: "Programmazione",
    fields: [
      ta(),
      req("title", "Titolo"),
      date("assigned_on", "Assegnato il"),
      date("due_on", "Scadenza"),
    ],
  },
  assignment_topics: {
    title: "Argomenti dei compiti",
    singular: "argomento associato",
    group: "Programmazione",
    fields: [
      ref("assignment_id", "Consegna", "assignments"),
      ref("topic_id", "Argomento", "topics"),
    ],
  },
  assignment_exercises: {
    title: "Esercizi assegnati",
    singular: "esercizio",
    group: "Programmazione",
    fields: [
      ref("assignment_id", "Consegna", "assignments"),
      num("position", "Numero esercizio", 1, 1),
      req("description", "Testo / riferimento", "textarea"),
    ],
  },
  homework_checks: {
    title: "Controlli compiti",
    singular: "controllo",
    group: "Programmazione",
    fields: [
      ref("assignment_id", "Consegna", "assignments"),
      ref("enrollment_id", "Studente", "enrollments"),
      date("checked_on", "Controllato il"),
      f("autonomy", "Autonomia (1–5)", "number", { min: 1, max: 5 }),
      f("understanding", "Comprensione (1–5)", "number", { min: 1, max: 5 }),
      f("notes", "Annotazioni / giustificazione", "textarea"),
      f("suggestions", "Suggerimenti", "textarea"),
    ],
  },
  homework_exercise_results: {
    title: "Esiti degli esercizi",
    singular: "esito",
    group: "Programmazione",
    fields: [
      ref("homework_check_id", "Controllo", "homework_checks"),
      ref("exercise_id", "Esercizio", "assignment_exercises"),
      choice("outcome", "Esito", ["correct", "partial", "wrong", "not_done"]),
      f("notes", "Note", "textarea"),
    ],
  },
  homework_errors: {
    title: "Errori nei compiti",
    singular: "errore associato",
    group: "Valutazione",
    fields: [
      ref("exercise_result_id", "Esito esercizio", "homework_exercise_results"),
      ref("error_type_id", "Tipo errore", "error_types"),
    ],
  },
  observation_types: {
    title: "Tipi di osservazione",
    singular: "tipo osservazione",
    group: "Valutazione",
    fields: [
      req("code", "Codice"),
      req("description", "Descrizione"),
      f(
        "disciplinary_default",
        "Può contribuire al voto disciplinare",
        "checkbox",
        { default: false },
      ),
    ],
  },
  observations: {
    title: "Osservazioni",
    singular: "osservazione",
    group: "Valutazione",
    fields: [
      ta(),
      ref("enrollment_id", "Studente", "enrollments"),
      ref("observation_type_id", "Tipo", "observation_types"),
      date("observed_on", "Data"),
      choice("mode", "Modalità", ["DESCRIPTIVE", "GRADED"]),
      f("notes", "Note", "textarea"),
      f("participation", "Partecipazione"),
      f("observable_behaviors", "Comportamenti osservabili", "textarea"),
      f("difficulties", "Difficoltà", "textarea"),
      f("strengths", "Punti di forza", "textarea"),
    ],
  },
  observation_errors: {
    title: "Errori nelle osservazioni",
    singular: "errore associato",
    group: "Valutazione",
    fields: [
      ref("observation_id", "Osservazione", "observations"),
      ref("error_type_id", "Tipo errore", "error_types"),
    ],
  },
  observation_competencies: {
    title: "Competenze osservate",
    singular: "competenza associata",
    group: "Valutazione",
    fields: [
      ref("observation_id", "Osservazione", "observations"),
      ref("competency_id", "Competenza", "competencies"),
    ],
  },
  observation_topics: {
    title: "Argomenti osservati",
    singular: "argomento associato",
    group: "Valutazione",
    fields: [
      ref("observation_id", "Osservazione", "observations"),
      ref("topic_id", "Argomento", "topics"),
    ],
  },
  assessment_rubrics: {
    title: "Rubriche",
    singular: "rubrica",
    group: "Valutazione",
    fields: [
      req("name", "Nome rubrica"),
      f("description", "Descrizione", "textarea"),
    ],
  },
  rubric_criteria: {
    title: "Criteri delle rubriche",
    singular: "criterio",
    group: "Valutazione",
    fields: [
      ref("rubric_id", "Rubrica", "assessment_rubrics"),
      req("label", "Criterio"),
      num("weight", "Peso", 1, 0.01),
      num("max_score", "Punteggio massimo", 5, 0.01),
      req("levels", "Livelli (JSON)", "json", {
        default: [
          { label: "In via di acquisizione", score: 1 },
          { label: "Acquisito", score: 5 },
        ],
      }),
    ],
  },
  assessments: {
    title: "Verifiche e interrogazioni",
    singular: "prova",
    group: "Valutazione",
    fields: [
      ta(),
      req("title", "Titolo"),
      date("assessed_on", "Data"),
      choice("kind", "Tipo", [
        "written",
        "oral",
        "practical",
        "graded_exercise",
      ]),
      choice("correction_mode", "Correzione", ["quick", "analytic", "rubric"]),
      ref("rubric_id", "Rubrica", "assessment_rubrics", false),
    ],
  },
  assessment_questions: {
    title: "Quesiti",
    singular: "quesito",
    group: "Valutazione",
    fields: [
      ref("assessment_id", "Prova", "assessments"),
      req("label", "Testo del quesito", "textarea"),
      num("max_score", "Punteggio massimo", 10, 0.01),
      ref("parent_question_id", "Quesito padre", "assessment_questions", false),
      ref("competency_id", "Competenza", "competencies", false),
      ref("topic_id", "Argomento", "topics", false),
    ],
  },
  assessment_results: {
    title: "Risultati delle prove",
    singular: "risultato",
    group: "Valutazione",
    fields: [
      ref("assessment_id", "Prova", "assessments"),
      ref("enrollment_id", "Studente", "enrollments"),
      f("notes", "Commento finale", "textarea"),
    ],
  },
  question_results: {
    title: "Correzioni dei quesiti",
    singular: "correzione",
    group: "Valutazione",
    fields: [
      ref("assessment_result_id", "Risultato", "assessment_results"),
      ref("question_id", "Quesito", "assessment_questions"),
      f("score", "Punteggio", "number", { min: 0 }),
      f("quick_result", "Correzione rapida", "select", {
        options: ["good", "partial", "poor", "unanswered"],
      }),
      f("notes", "Commenti", "textarea"),
    ],
  },
  question_errors: {
    title: "Errori nelle prove",
    singular: "errore associato",
    group: "Valutazione",
    fields: [
      ref("question_result_id", "Correzione", "question_results"),
      ref("error_type_id", "Tipo errore", "error_types"),
    ],
  },
  rubric_scores: {
    title: "Valutazioni per criterio",
    singular: "valutazione criterio",
    group: "Valutazione",
    fields: [
      ref("assessment_result_id", "Risultato", "assessment_results"),
      ref("criterion_id", "Criterio", "rubric_criteria"),
      num("score", "Punteggio", 0),
    ],
  },
  evaluation_categories: {
    title: "Categorie di valutazione",
    singular: "categoria",
    group: "Configurazione",
    admin: true,
    fields: [
      req("code", "Codice"),
      req("name", "Nome"),
      f("contributes_to_average", "Contribuisce alla media", "checkbox", {
        default: true,
      }),
    ],
  },
  evaluation_rules: {
    title: "Regole dei voti",
    singular: "regola",
    group: "Configurazione",
    admin: true,
    fields: [
      req("name", "Nome"),
      num("minimum", "Voto minimo", 1),
      num("maximum", "Voto massimo", 10, 0.01),
      num("rounding_step", "Arrotondamento", 0.1, 0.001),
      req("conversion_points", "Curva normalizzata (JSON)", "json", {
        default: [
          [0, 0],
          [1, 1],
        ],
      }),
    ],
  },
  grade_entries: {
    title: "Registro voti",
    singular: "voto",
    group: "Valutazione",
    fields: [
      ref("enrollment_id", "Studente", "enrollments"),
      ta(),
      ref("category_id", "Categoria", "evaluation_categories"),
      ref("rule_id", "Regola", "evaluation_rules"),
      date("graded_on", "Data"),
      choice("origin", "Origine", [
        "manual",
        "assessment",
        "observation",
        "homework",
      ]),
      ref(
        "assessment_result_id",
        "Risultato prova",
        "assessment_results",
        false,
      ),
      ref("observation_id", "Osservazione", "observations", false),
      ref("homework_check_id", "Controllo compiti", "homework_checks", false),
      f("suggested_value", "Voto suggerito", "number"),
      f("confirmed_value", "Voto confermato", "number"),
      num("weight", "Peso", 1, 0.001),
      choice("status", "Stato", ["draft", "confirmed", "cancelled"]),
      f("excluded_from_average", "Escludi dalla media", "checkbox"),
      f(
        "allow_behavior_in_average",
        "Includi esplicitamente partecipazione/comportamento",
        "checkbox",
      ),
      f("change_reason", "Motivazione della modifica", "textarea"),
    ],
  },
};
export const translations: Record<string, string> = {
  draft: "Bozza",
  confirmed: "Confermata",
  cancelled: "Annullato",
  DESCRIPTIVE: "Descrittiva",
  GRADED: "Valutativa",
  written: "Scritta",
  oral: "Orale",
  practical: "Laboratorio",
  graded_exercise: "Esercitazione valutata",
  quick: "Rapida",
  analytic: "Analitica",
  rubric: "Rubrica",
  correct: "Corretto",
  partial: "Parziale",
  wrong: "Errato",
  not_done: "Non svolto",
  good: "Bene",
  poor: "Male",
  unanswered: "Non risposto",
  promoted: "Promosso",
  repeating: "Ripetente",
  transferred: "Trasferito",
  withdrawn: "Ritirato",
  manual: "Manuale",
  assessment: "Verifica",
  observation: "Osservazione",
  homework: "Compiti",
  owner: "Proprietario",
  admin: "Amministratore",
  teacher: "Docente",
  viewer: "Sola lettura",
  workspace: "Condiviso nel workspace",
  private: "Riservato a me",
};
export const tr = (value: string) => translations[value] ?? value;
export type DataMap = Partial<Record<TableName, Row[]>>;
export function label(
  table: TableName | "members",
  row: Row,
  data: DataMap,
): string {
  const find = (t: TableName, id: unknown) => data[t]?.find((r) => r.id === id);
  if (table === "members")
    return text(row, "display_name") || "Docente assegnato";
  if (table === "enrollments")
    return (
      label("students", find("students", row.student_id) ?? row, data) +
      " · " +
      text(find("classes", row.class_id), "name")
    );
  if (table === "class_subjects")
    return (
      text(find("classes", row.class_id), "name") +
      " · " +
      text(find("subjects", row.subject_id), "name")
    );
  if (table === "teaching_assignments")
    return label(
      "class_subjects",
      find("class_subjects", row.class_subject_id) ?? row,
      data,
    );
  if (table === "assessment_results")
    return (
      label(
        "enrollments",
        find("enrollments", row.enrollment_id) ?? row,
        data,
      ) +
      " · " +
      text(find("assessments", row.assessment_id), "title")
    );
  return (
    [text(row, "last_name"), text(row, "first_name")]
      .filter(Boolean)
      .join(" ") ||
    text(row, "name") ||
    text(row, "title") ||
    text(row, "label") ||
    text(row, "description") ||
    text(row, "code") ||
    text(row, "notes") ||
    String(row.id ?? "Dato non disponibile").slice(0, 24)
  );
}
export function derivePatch(table: TableName, p: Patch, data: DataMap): Patch {
  const v = { ...p };
  const find = (t: TableName, k: string) => data[t]?.find((r) => r.id === v[k]);
  if (table === "teaching_assignments")
    v.class_id = text(find("class_subjects", "class_subject_id"), "class_id");
  if (
    ["assignments", "assessments", "observations", "grade_entries"].includes(
      table,
    ) &&
    v.teaching_assignment_id
  )
    v.class_id = text(
      find("teaching_assignments", "teaching_assignment_id"),
      "class_id",
    );
  if (table === "homework_checks")
    v.class_id = text(find("assignments", "assignment_id"), "class_id");
  if (table === "assessment_results") {
    const a = find("assessments", "assessment_id");
    v.class_id = text(a, "class_id");
    v.teaching_assignment_id = text(a, "teaching_assignment_id");
  }
  if (table === "question_results") {
    v.assessment_id = text(
      find("assessment_results", "assessment_result_id"),
      "assessment_id",
    );
    v.max_score_snapshot = Number(
      find("assessment_questions", "question_id")?.max_score ?? 1,
    );
  }
  if (table === "homework_exercise_results")
    v.assignment_id = text(
      find("homework_checks", "homework_check_id"),
      "assignment_id",
    );
  if (table === "rubric_scores") {
    const c = find("rubric_criteria", "criterion_id");
    v.criterion_label_snapshot = text(c, "label");
    v.max_score_snapshot = Number(c?.max_score ?? 1);
    v.weight_snapshot = Number(c?.weight ?? 1);
    v.levels_snapshot = (c?.levels ?? []) as Patch[string];
  }
  return v;
}
export const essentialTables = Object.keys(catalog) as TableName[];
export const organizationOrder: TableName[] = [
  "school_years",
  "schools",
  "subjects",
  "classes",
  "class_subjects",
  "teaching_assignments",
  "students",
  "enrollments",
];
export function organizationEntries(group: string) {
  const entries = Object.entries(catalog);
  return (
    group === "Organizzazione"
      ? [...entries].sort(
          ([a], [b]) =>
            organizationOrder.indexOf(a as TableName) -
            organizationOrder.indexOf(b as TableName),
        )
      : entries
  ).filter(([, c]) => c.group === group);
}
