import { useData } from "../state/data";
import { text, type Row } from "../types/model";
import { Badge } from "./ui";
import { tr } from "../domain/catalog";
export function CorrectionSummary({
  assessment,
  result,
}: {
  assessment: Row;
  result?: Row;
}) {
  const { data } = useData();
  const questions = (data.assessment_questions ?? []).filter(
    (q) => q.assessment_id === assessment.id,
  );
  const leaves = questions.filter(
    (q) => !questions.some((c) => c.parent_question_id === q.id),
  );
  const criteria = (data.rubric_criteria ?? []).filter(
    (c) => c.rubric_id === assessment.rubric_id,
  );
  const rubric = assessment.correction_mode === "rubric";
  const rows = rubric
    ? (data.rubric_scores ?? []).filter(
        (r) => r.assessment_result_id === result?.id,
      )
    : (data.question_results ?? []).filter(
        (r) => r.assessment_result_id === result?.id,
      );
  const expected = rubric ? criteria.length : leaves.length;
  const total = rows.reduce(
    (n, r) =>
      n +
      Number(
        r.score ??
          (r.quick_result === "good"
            ? r.max_score_snapshot
            : r.quick_result === "partial"
              ? Number(r.max_score_snapshot) / 2
              : 0),
      ),
    0,
  );
  const maximum = rows.reduce((n, r) => n + Number(r.max_score_snapshot), 0);
  return (
    <div className="correction-summary">
      <Badge tone={expected > 0 && rows.length === expected ? "good" : "warn"}>
        {expected > 0 && rows.length === expected
          ? "Correzione completa"
          : "Correzione in corso"}
      </Badge>
      <p>
        {rows.length} / {expected} {rubric ? "criteri" : "quesiti"} corretti ·
        Punteggio registrato: {total} / {maximum}
      </p>
      {rubric && (
        <small>
          I pesi dei criteri e la conversione in voto sono applicati dal
          database.
        </small>
      )}
      <p className="muted">
        Modalità: {tr(text(assessment, "correction_mode"))}. I massimi delle
        correzioni già salvate restano quelli fotografati al momento della
        registrazione.
      </p>
    </div>
  );
}
