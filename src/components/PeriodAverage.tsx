import { useQuery } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { useAuth } from "../state/auth";
import { ErrorBox } from "./ui";
export function PeriodAverage({
  student,
  subject,
  from,
  to,
  category,
  year,
}: {
  student: string;
  subject: string;
  from: string;
  to: string;
  category: string;
  year: string;
}) {
  const { workspace, session } = useAuth();
  const query = useQuery({
    queryKey: [
      "period-average",
      session?.user.id,
      workspace,
      student,
      subject,
      from,
      to,
      category,
      year,
    ],
    enabled: !!subject && navigator.onLine,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("student_average", {
        p_workspace: workspace,
        p_student: student,
        p_subject: subject,
        p_start: from || "1900-01-01",
        p_end: to || "2999-12-31",
        ...(category ? { p_category: category } : {}),
        ...(year ? { p_year: year } : {}),
      });
      if (error) throw error;
      return data;
    },
  });
  return (
    <section className="card">
      <h2>Media canonica nel periodo</h2>
      {!subject ? (
        <p>Seleziona una materia per consultare la media del periodo.</p>
      ) : !navigator.onLine ? (
        <p>
          La media del periodo richiede una connessione. Il registro già
          caricato rimane disponibile.
        </p>
      ) : (
        <>
          <ErrorBox error={query.error} />
          <p className="period-average">
            {query.isPending
              ? "…"
              : query.data == null
                ? "—"
                : Number(query.data).toLocaleString("it-IT", {
                    maximumFractionDigits: 2,
                  })}
          </p>
        </>
      )}
    </section>
  );
}
