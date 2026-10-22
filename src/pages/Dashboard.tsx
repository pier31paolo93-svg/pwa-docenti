import { Link } from "react-router-dom";
import {
  ArrowRight,
  Plus,
  MessageSquare,
  ClipboardCheck,
  CalendarDays,
  GraduationCap,
  BookOpen,
  ArrowUpRight,
} from "lucide-react";
import { useAuth } from "../state/auth";
import { useData, useRows } from "../state/data";
import { PageTitle, Stat, Empty, Badge, ErrorBox } from "../components/ui";
import { today, text } from "../types/model";
import { inContext } from "../domain/context";
export function Dashboard() {
  const { identity, role } = useAuth();
  const { data, filters } = useData();
  const stats = useRows("v_class_dashboard");
  const now = today();
  const lessons = (data.lessons ?? [])
    .filter(
      (l) =>
        inContext(l, data, filters) && text(l, "starts_at").startsWith(now),
    )
    .sort((a, b) => text(a, "starts_at").localeCompare(text(b, "starts_at")));
  const assessments = (data.assessments ?? [])
    .filter((a) => inContext(a, data, filters) && text(a, "assessed_on") >= now)
    .sort((a, b) =>
      text(a, "assessed_on").localeCompare(text(b, "assessed_on")),
    )
    .slice(0, 4);
  const observations = (data.observations ?? [])
    .filter((o) => inContext(o, data, filters))
    .sort((a, b) =>
      text(b, "observed_on").localeCompare(text(a, "observed_on")),
    )
    .slice(0, 3);
  const assignments = (data.assignments ?? [])
    .filter((a) => inContext(a, data, filters))
    .sort((a, b) => text(b, "due_on").localeCompare(text(a, "due_on")))
    .slice(0, 3);
  const avg =
    filters.classId && filters.subject
      ? stats.data?.find(
          (s) =>
            s.class_id === filters.classId && s.subject_id === filters.subject,
        )
      : undefined;
  const date = new Date().toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const first = text(identity.profile ?? undefined, "display_name").split(
    " ",
  )[0];
  return (
    <>
      <PageTitle
        eyebrow={date.toUpperCase()}
        title={first ? "Buongiorno, " + first + "." : "Il tuo quaderno, oggi."}
        subtitle="Tutto ciò che serve per accompagnare i progressi, una lezione alla volta."
        action={
          <Link to="/registro" className="button primary">
            <Plus size={18} />
            Nuova lezione
          </Link>
        }
      />
      <div className="stat-grid">
        <Stat
          label="Lezioni di oggi"
          value={lessons.length}
          note="Nel contesto selezionato"
        />
        <Stat
          label="Studenti"
          value={
            filters.classId
              ? (data.enrollments?.filter(
                  (e) => e.class_id === filters.classId && !e.ends_on,
                ).length ?? 0)
              : (data.students?.filter((s) => !s.archived_at).length ?? 0)
          }
          note={filters.classId ? "Iscritti nella classe" : "Nel workspace"}
        />
        <Stat
          label="Media disciplinare"
          value={avg ? Number(avg.weighted_average).toFixed(2) : "—"}
          note={avg ? "Dal registro canonico" : "Seleziona classe e materia"}
        />
        <Stat
          label="Prossime verifiche"
          value={assessments.length}
          note="Prove programmate"
        />
      </div>
      <div className="dashboard-columns">
        <div>
          <section className="card today-card">
            <div className="section-head">
              <h2>
                <CalendarDays size={19} /> Il programma di oggi
              </h2>
              <Link to="/registro">
                Registro <ArrowRight size={15} />
              </Link>
            </div>
            {!data.schools?.length ? (
              <Empty
                title="Diamo forma al tuo quaderno"
                description="Inizia dalla tua scuola, poi aggiungi anno scolastico, classi e studenti. Questo spazio seguirà il tuo lavoro."
                to="/organizzazione"
              />
            ) : !lessons.length ? (
              <Empty
                title="La giornata è da scrivere"
                description="Non ci sono lezioni registrate per oggi. Puoi aggiungerne una o cambiare i filtri."
                to="/registro"
              />
            ) : (
              <div className="agenda">
                {lessons.map((l) => (
                  <Link
                    to={"/registro/" + l.id}
                    className="agenda-row"
                    key={l.id}
                  >
                    <span className="agenda-time">
                      {new Date(text(l, "starts_at")).toLocaleTimeString(
                        "it-IT",
                        { hour: "2-digit", minute: "2-digit" },
                      )}
                    </span>
                    <div>
                      <strong>{text(l, "title")}</strong>
                      <span>
                        {
                          data.classes?.find(
                            (c) =>
                              c.id ===
                              data.teaching_assignments?.find(
                                (t) => t.id === l.teaching_assignment_id,
                              )?.class_id,
                          )?.name as string
                        }
                      </span>
                    </div>
                    <ArrowUpRight size={19} />
                  </Link>
                ))}
              </div>
            )}
          </section>
          <section className="card">
            <div className="section-head">
              <h2>
                <MessageSquare size={19} /> Ultime osservazioni
              </h2>
              <Link to="/osservazioni">
                Tutte <ArrowRight size={15} />
              </Link>
            </div>
            {observations.length ? (
              observations.map((o) => (
                <div className="activity-row" key={o.id}>
                  <span className="activity-dot" />
                  <div>
                    <strong>
                      {text(o, "notes") ||
                        text(o, "strengths") ||
                        "Osservazione registrata"}
                    </strong>
                    <small>
                      {new Date(text(o, "observed_on")).toLocaleDateString(
                        "it-IT",
                      )}
                    </small>
                  </div>
                  <Badge tone={o.mode === "GRADED" ? "good" : "neutral"}>
                    {o.mode === "GRADED" ? "Valutativa" : "Descrittiva"}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="quiet-empty">
                Le tue osservazioni recenti compariranno qui.
              </p>
            )}
          </section>
        </div>
        <div>
          <section className="quick-card">
            <span className="eyebrow">DURANTE LA LEZIONE</span>
            <h2>Cogli il momento.</h2>
            <p>
              Un progresso, un ragionamento, una difficoltà. Annotali mentre
              accadono.
            </p>
            <Link className="button light" to="/osservazioni">
              <MessageSquare size={17} />
              Registra un’osservazione
            </Link>
          </section>
          <section className="card">
            <div className="section-head">
              <h2>
                <ClipboardCheck size={19} /> Da tenere a mente
              </h2>
            </div>
            {assignments.length ? (
              assignments.map((a) => (
                <Link
                  className="compact-row"
                  key={a.id}
                  to={"/compiti/" + a.id}
                >
                  <div>
                    <strong>{text(a, "title")}</strong>
                    <small>Consegna · {text(a, "due_on")}</small>
                  </div>
                  <ArrowRight size={17} />
                </Link>
              ))
            ) : (
              <p className="quiet-empty">Nessun compito da controllare.</p>
            )}
            {assessments.map((a) => (
              <Link
                className="compact-row"
                key={a.id}
                to={"/verifiche/" + a.id}
              >
                <div>
                  <strong>{text(a, "title")}</strong>
                  <small>Verifica · {text(a, "assessed_on")}</small>
                </div>
                <GraduationCap size={17} />
              </Link>
            ))}
          </section>
          <div className="note-card">
            <BookOpen size={22} />
            <p>
              Le osservazioni descrittive raccontano un percorso. I voti restano
              nel loro registro, con le loro regole.
            </p>
          </div>
        </div>
      </div>
      <div className="quick-links">
        <Link to="/compiti">
          <ClipboardCheck size={20} /> Controllo compiti{" "}
          <ArrowRight size={16} />
        </Link>
        <Link to="/verifiche">
          <GraduationCap size={20} /> Verifica o interrogazione{" "}
          <ArrowRight size={16} />
        </Link>
        <Link to="/studenti">
          <BookOpen size={20} /> Scheda studente <ArrowRight size={16} />
        </Link>
      </div>
      {role === "viewer" && (
        <p className="banner">Il tuo ruolo consente la sola consultazione.</p>
      )}
      <ErrorBox error={stats.error} />
    </>
  );
}
