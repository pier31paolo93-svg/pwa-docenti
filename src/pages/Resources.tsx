import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus, Pencil, Archive, ArrowRight } from "lucide-react";
import { catalog, label, tr } from "../domain/catalog";
import { useRows, useData } from "../state/data";
import { usePermissions } from "../hooks/permissions";
import type { Row, TableName, Patch } from "../types/model";
import { text } from "../types/model";
import {
  PageTitle,
  Empty,
  ErrorBox,
  Modal,
  Spinner,
  Badge,
} from "../components/ui";
import { EntityForm } from "../components/EntityForm";
import { ExportMenu } from "../components/ExportMenu";
import { GradeEditor } from "../components/GradeEditor";
export function Organization() {
  const { admin } = usePermissions();
  return (
    <>
      <PageTitle
        eyebrow="LE FONDAMENTA DEL TUO LAVORO"
        title="Organizza il quaderno"
        subtitle="Scuole, classi e strumenti didattici. Ogni anno mantiene il suo storico."
      />
      <div className="resource-groups">
        {[
          "Organizzazione",
          "Programmazione",
          "Valutazione",
          "Configurazione",
        ].map((group) => (
          <section key={group}>
            <h2>{group}</h2>
            <div className="resource-grid">
              {Object.entries(catalog)
                .filter(([, c]) => c.group === group && (!c.admin || admin))
                .map(([key, c]) => (
                  <Link
                    className="resource-card"
                    key={key}
                    to={"/archivio/" + key}
                  >
                    <span>{c.title}</span>
                    <ArrowRight size={17} />
                  </Link>
                ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
export function ResourcePage({ resource }: { resource?: TableName }) {
  const params = useParams();
  const table = (resource ?? params.resource) as TableName;
  if (!catalog[table])
    return (
      <Empty
        title="Pagina non trovata"
        description="Questa risorsa non è disponibile."
        to="/"
      />
    );
  return <ResourceTable key={table} table={table} />;
}
function ResourceTable({ table }: { table: TableName }) {
  const spec = catalog[table];
  const query = useRows(table);
  const { data, filters, save } = useData();
  const { writable } = usePermissions();
  const [editing, setEditing] = useState<Row | null | undefined>();
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const [error, setError] = useState<unknown>();
  const [initial, setInitial] = useState<Patch>({});
  const [grading, setGrading] = useState<Row>();
  if (!spec)
    return (
      <Empty
        title="Pagina non trovata"
        description="Questa risorsa non è disponibile."
        to="/"
      />
    );
  const rows = (query.data ?? [])
    .filter(
      (r) =>
        !r.deleted_at &&
        (archived || !r.archived_at) &&
        Object.values(r).some((v) =>
          String(v ?? "")
            .toLocaleLowerCase()
            .includes(search.toLocaleLowerCase()),
        ),
    )
    .filter((r) => {
      if (table === "classes")
        return (
          (!filters.year || r.school_year_id === filters.year) &&
          (!filters.school || r.school_id === filters.school)
        );
      if (r.class_id && filters.classId && r.class_id !== filters.classId)
        return false;
      if (r.subject_id && filters.subject && r.subject_id !== filters.subject)
        return false;
      if (r.teaching_assignment_id) {
        const ta = data.teaching_assignments?.find(
          (a) => a.id === r.teaching_assignment_id,
        );
        const cs = data.class_subjects?.find(
          (a) => a.id === ta?.class_subject_id,
        );
        if (filters.classId && ta?.class_id !== filters.classId) return false;
        if (filters.subject && cs?.subject_id !== filters.subject) return false;
      }
      return true;
    });
  const fields = spec.fields.slice(0, 4);
  const exports = rows.map((row) =>
    Object.fromEntries(
      spec.fields.map((f) => [
        f.label,
        f.ref
          ? label(
              f.ref,
              (data[f.ref as TableName] ?? []).find(
                (x) => x.id === row[f.name],
              ) ?? { id: text(row, f.name) },
              data,
            )
          : f.type === "checkbox"
            ? row[f.name]
              ? "Sì"
              : "No"
            : text(row, f.name),
      ]),
    ),
  );
  async function archive(row: Row) {
    if (!writable(table, row)) return;
    if (
      [
        "school_years",
        "schools",
        "subjects",
        "classes",
        "teaching_assignments",
        "assessments",
      ].includes(table) &&
      Object.values(data).some((rs) =>
        rs?.some(
          (r) =>
            r.id !== row.id &&
            Object.entries(r).some(
              ([k, v]) => k.endsWith("_id") && v === row.id,
            ),
        ),
      )
    ) {
      setError(
        new Error(
          "Sono presenti dati collegati. Conserva questo elemento per mantenere consultabile lo storico.",
        ),
      );
      return;
    }
    if (
      !window.confirm(
        table === "grade_entries"
          ? "Annullare questo voto? Verrà escluso dalla media e conservato nello storico."
          : "Archiviare questo elemento? I dati rimangono nel database. Gli elementi dipendenti potrebbero non essere più visibili.",
      )
    )
      return;
    try {
      await save(
        table,
        table === "grade_entries"
          ? { status: "cancelled" }
          : table === "students"
            ? { archived_at: row.archived_at ? null : new Date().toISOString() }
            : { deleted_at: new Date().toISOString() },
        row,
      );
    } catch (e) {
      setError(e);
    }
  }
  const route = (row: Row) =>
    table === "lessons"
      ? "/registro/" + row.id
      : table === "assignments"
        ? "/compiti/" + row.id
        : table === "assessments"
          ? "/verifiche/" + row.id
          : table === "students"
            ? "/studenti/" + row.id
            : "";
  return (
    <>
      <PageTitle
        eyebrow={spec.group.toUpperCase()}
        title={spec.title}
        subtitle="Dati del workspace corrente. Le modifiche rispettano i permessi del tuo ruolo."
        action={
          writable(table) && (
            <button
              className="button primary"
              onClick={() => {
                setInitial({});
                setEditing(null);
              }}
            >
              <Plus size={17} /> Nuov
              {[
                "scuola",
                "classe",
                "materia",
                "lezione",
                "consegna",
                "osservazione",
                "prova",
                "categoria",
                "regola",
                "rubrica",
                "competenza",
              ].includes(spec.singular)
                ? "a"
                : "o"}{" "}
              {spec.singular}
            </button>
          )
        }
      />
      <ErrorBox error={query.error ?? error} />
      <div className="section-toolbar">
        <input
          type="search"
          aria-label="Cerca nell’elenco"
          placeholder="Cerca nell’elenco…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {table === "students" && (
          <label className="inline-check">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
            />
            Includi archiviati
          </label>
        )}
        <ExportMenu title={spec.title} rows={exports} />
      </div>
      {query.isPending ? (
        <Spinner />
      ) : !rows.length ? (
        <Empty
          title="Il quaderno parte da qui"
          description={
            "Non ci sono " +
            spec.title.toLowerCase() +
            " per i filtri selezionati."
          }
          action={writable(table) ? () => setEditing(null) : undefined}
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {fields.map((f) => (
                  <th key={f.name}>{f.label}</th>
                ))}
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {fields.map((f, i) => (
                    <td key={f.name}>
                      {i === 0 && route(row) ? (
                        <Link className="table-link" to={route(row)}>
                          {f.ref
                            ? label(
                                f.ref,
                                (data[f.ref as TableName] ?? []).find(
                                  (x) => x.id === row[f.name],
                                ) ?? { id: text(row, f.name) },
                                data,
                              )
                            : text(row, f.name)}
                        </Link>
                      ) : f.ref ? (
                        label(
                          f.ref,
                          (data[f.ref as TableName] ?? []).find(
                            (x) => x.id === row[f.name],
                          ) ?? { id: text(row, f.name) },
                          data,
                        )
                      ) : f.type === "select" ? (
                        <Badge>{tr(text(row, f.name))}</Badge>
                      ) : (
                        text(row, f.name)
                      )}
                    </td>
                  ))}
                  <td>
                    <div className="row-actions">
                      {route(row) && (
                        <Link
                          className="icon-button"
                          aria-label="Apri dettaglio"
                          to={route(row)}
                        >
                          <ArrowRight size={17} />
                        </Link>
                      )}
                      {table === "observations" &&
                        row.mode === "GRADED" &&
                        writable("grade_entries") && (
                          <button
                            className="button"
                            onClick={() => setGrading(row)}
                          >
                            Voto
                          </button>
                        )}
                      {writable(table, row) && (
                        <>
                          <button
                            className="icon-button"
                            onClick={() => setEditing(row)}
                            aria-label="Modifica"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="icon-button"
                            onClick={() => archive(row)}
                            aria-label={
                              table === "grade_entries"
                                ? "Annulla voto"
                                : "Archivia"
                            }
                          >
                            <Archive size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing !== undefined && (
        <Modal
          title={(editing ? "Modifica " : "Nuovo elemento · ") + spec.singular}
          close={() => setEditing(undefined)}
        >
          <EntityForm
            key={editing?.id ?? "new"}
            table={table}
            row={editing ?? undefined}
            initial={initial}
            done={() => setEditing(undefined)}
            onSaved={(r) => {
              if (table === "observations" && r.mode === "GRADED")
                setGrading(r);
            }}
          />
        </Modal>
      )}
      {grading && (
        <Modal
          title="Valutazione dell’osservazione"
          close={() => setGrading(undefined)}
        >
          <GradeEditor
            source={grading}
            origin="observation"
            enrollment={text(grading, "enrollment_id")}
            assignment={text(grading, "teaching_assignment_id")}
          />
        </Modal>
      )}
    </>
  );
}
