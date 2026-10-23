import { useState } from "react";
import { Link } from "react-router-dom";
import { useData, useRows } from "../state/data";
import { useCapabilities } from "../hooks/capabilities";
import { usePermissions } from "../hooks/permissions";
import { teachingEvents, calendarRange, dayShift } from "../domain/teaching";
import { today, type Row, type TableName } from "../types/model";
import { PageTitle, Modal, ErrorBox } from "../components/ui";
import { EntityForm } from "../components/EntityForm";
export function Calendar() {
  const { data, filters } = useData(),
    caps = useCapabilities(),
    { writable } = usePermissions(),
    recovery = useRows("recovery_activities", !!caps.data?.recovery);
  const [day, setDay] = useState(today()),
    [mode, setMode] = useState("week"),
    [kind, setKind] = useState(""),
    [editing, setEditing] = useState<{
      table: TableName;
      row?: Row;
      kind?: string;
    }>();
  const [first, last] = calendarRange(day, mode),
    events = teachingEvents(data, filters, recovery.data ?? []).filter(
      (e) => e.day >= first && e.day <= last && (!kind || e.kind === kind),
    );
  const days = Array.from(
    {
      length:
        Math.round(
          (Date.parse(last + "T12:00:00Z") - Date.parse(first + "T12:00:00Z")) /
            86400000,
        ) + 1,
    },
    (_, i) => dayShift(first, i),
  );
  return (
    <>
      <PageTitle
        title="Calendario"
        subtitle="Europe/Rome · lezioni con orario locale, verifiche e scadenze come date senza orario."
      />
      <ErrorBox error={recovery.error} />
      <div className="card form-grid">
        <label>
          Data calendario
          <input
            type="date"
            value={day}
            onChange={(e) => {
              if (e.target.value) setDay(e.target.value);
            }}
          />
        </label>
        <label>
          Vista
          <select
            aria-label="Vista calendario"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            {[
              ["day", "Giorno"],
              ["week", "Settimana"],
              ["month", "Mese"],
              ["list", "Elenco"],
            ].map(([v, n]) => (
              <option value={v} key={v}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tipologia
          <select
            aria-label="Tipologia calendario"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {[
              ["", "Tutte"],
              ["lesson", "Lezioni"],
              ["assessment", "Verifiche"],
              ["oral", "Interrogazioni"],
              ["homework", "Compiti"],
              ["recovery", "Recupero"],
            ].map(([v, n]) => (
              <option value={v} key={v}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p>
        I filtri scuola, anno, classe e materia sono quelli generali del
        quaderno. Gli eventi personali non sono presenti nello schema: nessun
        calendario esterno collegato.
      </p>
      <div className="form-actions">
        {[
          ["lessons", "Lezione"],
          ["assessments", "Verifica"],
          ["assessments", "Interrogazione"],
          ["assignments", "Compito"],
        ].map(([table, name]) => (
          <button
            className="button"
            disabled={!writable(table as TableName)}
            key={name}
            onClick={() =>
              setEditing({
                table: table as TableName,
                kind: name === "Interrogazione" ? "oral" : undefined,
              })
            }
          >
            Crea {name.toLocaleLowerCase()}
          </button>
        ))}
        <Link className="button" to="/recupero">
          Pianifica recupero
        </Link>
      </div>
      <div
        className={
          "calendar-days " + (mode === "month" ? "calendar-month" : "")
        }
      >
        {(mode === "list" ? [first] : days).map((d) => (
          <section className="card" key={d}>
            <h2>
              {mode === "list"
                ? `${first} — ${last}`
                : new Intl.DateTimeFormat("it-IT", {
                    dateStyle: "full",
                    timeZone: "Europe/Rome",
                  }).format(new Date(d + "T12:00:00Z"))}
            </h2>
            {events
              .filter((e) => mode === "list" || e.day === d)
              .map((e) => (
                <article className="calendar-event" key={e.kind + e.id}>
                  <Link to={e.route}>
                    {mode === "list" ? e.day + " · " : ""}
                    {e.time ? e.time + " · " : ""}
                    {e.title}
                  </Link>
                  <small>
                    {e.kind === "oral"
                      ? "Interrogazione"
                      : e.kind === "recovery"
                        ? "Recupero"
                        : e.kind === "homework"
                          ? "Scadenza compito"
                          : e.kind === "lesson"
                            ? "Lezione"
                            : "Verifica"}
                  </small>
                  {e.kind !== "recovery" &&
                    writable(
                      e.kind === "lesson"
                        ? "lessons"
                        : e.kind === "homework"
                          ? "assignments"
                          : "assessments",
                      e.row,
                    ) && (
                      <button
                        className="button"
                        onClick={() =>
                          setEditing({
                            table:
                              e.kind === "lesson"
                                ? "lessons"
                                : e.kind === "homework"
                                  ? "assignments"
                                  : "assessments",
                            row: e.row,
                          })
                        }
                      >
                        Modifica evento
                      </button>
                    )}
                </article>
              ))}
            {!events.some((e) => mode === "list" || e.day === d) && (
              <p className="muted">Nessun evento.</p>
            )}
          </section>
        ))}
      </div>
      {editing && (
        <Modal
          title={
            editing.row ? "Modifica evento originale" : "Crea evento didattico"
          }
          close={() => setEditing(undefined)}
        >
          <EntityForm
            table={editing.table}
            row={editing.row}
            initial={{
              assessed_on: day,
              assigned_on: day,
              due_on: day,
              starts_at: day + "T09:00",
              ends_at: day + "T10:00",
              ...(editing.kind ? { kind: editing.kind } : {}),
            }}
            done={() => setEditing(undefined)}
          />
        </Modal>
      )}
    </>
  );
}
