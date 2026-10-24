import type { Row } from "../types/model";
export type Level = {
  label: string;
  from: string;
  to: string;
  description: string;
};
export type Criterion = {
  id: string;
  label: string;
  maximum: string;
  competency_id?: string;
  description: string;
  levels: Level[];
};
export type Exercise = {
  id: string;
  label: string;
  maximum: string;
  criteria: Criterion[];
};
export type Section = {
  id: string;
  label: string;
  maximum: string;
  exercises: Exercise[];
};
export type Skill = {
  id: string;
  label: string;
  maximum: string;
  description: string;
};
export type Grid = {
  schema: 1;
  title: string;
  maximum: string;
  precision: number;
  argumentation: boolean;
  subject_id?: string;
  competencies: Skill[];
  sections: Section[];
  rule?: Row;
  template_version?: number;
};
export const units = (value: unknown): number => {
  const s = String(value ?? "")
    .trim()
    .replace(",", ".");
  if (!/^\d+(\.\d{1,3})?$/.test(s))
    throw Error("Usa un numero positivo o zero, con massimo tre decimali.");
  const [whole, decimal = ""] = s.split(".");
  const result = Number(whole) * 1000 + Number(decimal.padEnd(3, "0"));
  if (!Number.isSafeInteger(result) || result > 1_000_000_000)
    throw Error("Punteggio troppo grande.");
  return result;
};
export const points = (value: number) => String(value / 1000);
export const sumPoints = (values: unknown[]) =>
  points(values.reduce<number>((n, v) => n + units(v), 0));
export function distributePoints(
  total: unknown,
  count: number,
  precision = 2,
): string[] {
  if (!Number.isInteger(precision) || precision < 0 || precision > 3)
    throw Error("Precisione consentita da zero a tre decimali.");
  const n = units(total),
    step = 10 ** (3 - precision);
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > 200 ||
    n % step ||
    n / step < count
  )
    throw Error(
      "La distribuzione richiede almeno un’unità di precisione per esercizio (massimo 200).",
    );
  const chunks = n / step,
    base = Math.floor(chunks / count),
    extra = chunks % count;
  return Array.from({ length: count }, (_, i) =>
    points((base + (i < extra ? 1 : 0)) * step),
  );
}
export function levels(maximum: string): Level[] {
  const n = units(maximum);
  const thresholds = [
    0,
    Math.round((n * 0.5) / 10) * 10,
    Math.round((n * 0.7) / 10) * 10,
    Math.round((n * 0.9) / 10) * 10,
    n,
  ];
  if (thresholds.some((v, i) => i > 0 && v <= thresholds[i - 1])) return [];
  return ["Scarso", "Sufficiente", "Buono", "Ottimo"].map((label, i) => ({
    label,
    from: points(thresholds[i]),
    to: points(thresholds[i + 1]),
    description: "",
  }));
}
export function criterion(maximum = "1", competency_id?: string): Criterion {
  return {
    id: crypto.randomUUID(),
    label: "Procedimento",
    maximum,
    competency_id,
    description: "",
    levels: levels(maximum),
  };
}
export function exercise(
  maximum = "1",
  label = "Esercizio",
  competency_id?: string,
): Exercise {
  return {
    id: crypto.randomUUID(),
    label,
    maximum,
    criteria: [criterion(maximum, competency_id)],
  };
}
export function emptyGrid(): Grid {
  return {
    schema: 1,
    title: "Nuova griglia",
    maximum: "10",
    precision: 2,
    argumentation: false,
    competencies: [],
    sections: [
      {
        id: crypto.randomUUID(),
        label: "Prova",
        maximum: "10",
        exercises: [exercise("10", "Esercizio 1")],
      },
    ],
  };
}
export function mathematicalGrid(
  kind: "algebra" | "biennio",
  argumentation: boolean,
): Grid {
  const names = [
    "Comprendere",
    "Individuare",
    "Sviluppare il processo risolutivo",
    ...(argumentation ? ["Argomentare"] : []),
  ];
  const maxima = ["20", "30", "30", ...(argumentation ? ["20"] : [])];
  const competencies = names.map((label, i) => ({
    id: crypto.randomUUID(),
    label,
    maximum: maxima[i],
    description: "",
  }));
  return {
    schema: 1,
    title: `Matematica ${kind === "algebra" ? "Algebra" : "Biennio"} ${argumentation ? "con" : "senza"} argomentazione`,
    maximum: argumentation ? "100" : "80",
    precision: 2,
    argumentation,
    competencies,
    sections: [
      {
        id: crypto.randomUUID(),
        label: "Prova",
        maximum: argumentation ? "100" : "80",
        exercises: competencies.map((s, i) =>
          exercise(s.maximum, `Esercizio ${i + 1} · ${s.label}`, s.id),
        ),
      },
    ],
  };
}
export function duplicateGrid(g: Grid): Grid {
  const clone = structuredClone(g),
    ids = new Map<string, string>();
  const id = (old: string) => {
    if (!ids.has(old)) ids.set(old, crypto.randomUUID());
    return ids.get(old)!;
  };
  for (const skill of clone.competencies) skill.id = id(skill.id);
  for (const s of clone.sections) {
    s.id = id(s.id);
    for (const e of s.exercises) {
      e.id = id(e.id);
      for (const c of e.criteria) {
        c.id = id(c.id);
        if (c.competency_id) c.competency_id = id(c.competency_id);
      }
    }
  }
  delete clone.rule;
  delete clone.template_version;
  return clone;
}
export function gridErrors(g: Grid): string[] {
  try {
    const errors: string[] = [],
      seen = new Set<string>();
    const id = (value: string) => {
      if (!value || seen.has(value))
        errors.push("Identificativi duplicati nella struttura.");
      seen.add(value);
    };
    const positive = (v: unknown) => {
      const n = units(v);
      if (n <= 0 || n % 10 ** (3 - g.precision))
        errors.push("Massimi positivi coerenti con la precisione scelta.");
      return n;
    };
    if (
      !g.title.trim() ||
      !g.sections.length ||
      !Number.isInteger(g.precision) ||
      g.precision < 0 ||
      g.precision > 3
    )
      errors.push("Completa titolo, sezioni e precisione (0–3).");
    const budgets = new Map<string, number>();
    let total = 0;
    for (const s of g.sections) {
      id(s.id);
      let sectionTotal = 0;
      if (!s.label.trim() || !s.exercises.length)
        errors.push("Ogni sezione richiede nome ed esercizi.");
      for (const e of s.exercises) {
        id(e.id);
        let exerciseTotal = 0;
        if (!e.label.trim() || !e.criteria.length)
          errors.push("Ogni esercizio richiede nome e sottocriteri.");
        for (const c of e.criteria) {
          id(c.id);
          const max = positive(c.maximum);
          exerciseTotal += max;
          if (!c.label.trim())
            errors.push("Descrizione sottocriterio obbligatoria.");
          if (c.competency_id) {
            if (!g.competencies.some((x) => x.id === c.competency_id))
              errors.push("Competenza non disponibile.");
            budgets.set(
              c.competency_id,
              (budgets.get(c.competency_id) ?? 0) + max,
            );
          }
          let previous = 0;
          for (const l of c.levels) {
            if (
              !l.label.trim() ||
              units(l.from) !== previous ||
              units(l.to) <= previous ||
              units(l.to) > max
            )
              errors.push("Livelli: intervalli contigui da zero al massimo.");
            previous = units(l.to);
          }
          if (c.levels.length && previous !== max)
            errors.push("Livelli incompleti.");
        }
        if (exerciseTotal !== positive(e.maximum))
          errors.push(`Sottocriteri di «${e.label}» diversi dal suo massimo.`);
        sectionTotal += exerciseTotal;
      }
      if (sectionTotal !== positive(s.maximum))
        errors.push(
          `Esercizi di «${s.label}» diversi dal totale della sezione.`,
        );
      total += sectionTotal;
    }
    if (total !== positive(g.maximum))
      errors.push("Totale delle sezioni diverso dal massimo della prova.");
    let skillTotal = 0;
    for (const s of g.competencies) {
      id(s.id);
      const max = positive(s.maximum);
      if (!s.label.trim() || (budgets.get(s.id) ?? 0) !== max)
        errors.push(
          `Ripartizione della competenza «${s.label}» non rispettata.`,
        );
      skillTotal += max;
    }
    if (g.competencies.length && skillTotal !== total)
      errors.push("Tutti i punti devono essere ripartiti nelle competenze.");
    return [...new Set(errors)];
  } catch (e) {
    return [(e as Error).message];
  }
}
export function provisionalGrade(
  score: string,
  maximum: string,
  rule: Row,
): string {
  const earned = units(score),
    max = units(maximum);
  if (!max || earned > max) throw Error("Punteggio fuori dai limiti.");
  let value: number;
  const min = Number(rule.minimum),
    high = Number(rule.maximum),
    step = Number(rule.rounding_step);
  if (rule.conversion_mode === "bands") {
    const bands = rule.bands as { from: number; grade: number }[];
    value = NaN;
    for (const b of bands)
      if (
        BigInt(earned) * BigInt(units(rule.band_maximum)) >=
        BigInt(units(b.from)) * BigInt(max)
      )
        value = b.grade;
  } else if (rule.conversion_mode === "linear") {
    value = (earned / max) * high;
  } else {
    const curve = rule.conversion_points as number[][];
    const ratio = earned / max;
    let normalized = 0;
    for (let i = 1; i < curve.length; i++) {
      const [x, y] = curve[i],
        [px, py] = curve[i - 1];
      if (ratio >= px && ratio <= x)
        normalized = py + ((y - py) * (ratio - px)) / (x - px);
    }
    value = min + normalized * (high - min);
  }
  if (!Number.isFinite(value) || !step)
    throw Error("Configura la regola di conversione.");
  return String(
    Number(
      Math.max(
        min,
        Math.min(high, Math.round((value + Number.EPSILON) / step) * step),
      ).toFixed(3),
    ),
  );
}
export function gridSummary(g: Grid, rows: Row[], resultId?: string) {
  const results = rows.filter(
    (r) => r.assessment_result_id === resultId && !r.deleted_at,
  );
  const scores = new Map(results.map((r) => [r.question_id, r]));
  let obtained = 0,
    completed = 0;
  const skills = new Map(
    g.competencies.map((s) => [
      s.id,
      { ...s, obtained: 0, available: 0, missing: 0 },
    ]),
  );
  const sections = g.sections.map((s) => {
    let total = 0;
    const exercises = s.exercises.map((e) => {
      const row = scores.get(e.id);
      const detail = row?.criterion_scores as
        Record<string, number> | null | undefined;
      const value = row?.score == null ? null : units(row.score);
      if (value != null) {
        total += value;
        obtained += value;
        if (!detail || Object.keys(detail).length === e.criteria.length)
          completed++;
      }
      for (const c of e.criteria) {
        const skill = c.competency_id ? skills.get(c.competency_id) : undefined;
        if (skill) {
          skill.available += units(c.maximum);
          if (detail && detail[c.id] != null)
            skill.obtained += units(detail[c.id]);
          else skill.missing++;
        }
      }
      return {
        ...e,
        row,
        obtained: value == null ? null : points(value),
        analytical: !!detail,
      };
    });
    return { ...s, obtained: points(total), exercises };
  });
  const expected = g.sections.reduce((n, s) => n + s.exercises.length, 0);
  return {
    obtained: points(obtained),
    maximum: g.maximum,
    completed,
    expected,
    complete: completed === expected && expected > 0,
    sections,
    skills: [...skills.values()].map((s) => ({
      ...s,
      obtained: points(s.obtained),
      available: points(s.available),
    })),
  };
}
export const eightyBands = [
  { from: 0, grade: 3 },
  { from: 30, grade: 4 },
  { from: 38, grade: 5 },
  { from: 46, grade: 6 },
  { from: 54, grade: 7 },
  { from: 62, grade: 8 },
  { from: 70, grade: 9 },
  { from: 78, grade: 10 },
];
