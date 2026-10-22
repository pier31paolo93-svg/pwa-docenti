import { useId, useState } from "react";
import {
  filterTeachers,
  teacherChoices,
  type TeacherOption,
} from "../domain/teachers";
export function TeacherPicker({
  teachers,
  value,
  onChange,
  disabled = false,
  loading = false,
  error = false,
}: {
  teachers: TeacherOption[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  loading?: boolean;
  error?: boolean;
}) {
  const id = useId();
  const [search, setSearch] = useState("");
  const choices = teacherChoices(teachers);
  const filtered = filterTeachers(choices, search);
  const selected = choices.find((t) => t.id === value);
  return (
    <div className="teacher-picker">
      <label htmlFor={id + "-search"}>Cerca docente per nome o email</label>
      <input
        id={id + "-search"}
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        disabled={disabled || loading || error}
        placeholder="Cerca tra i docenti del workspace…"
      />
      <label htmlFor={id}>Docente *</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading || error}
      >
        <option value="">Seleziona un docente…</option>
        {value && !selected && (
          <option value={value}>
            {disabled
              ? "Docente già assegnato · riferimento conservato"
              : "Selezione non disponibile"}
          </option>
        )}
        {selected && !filtered.some((t) => t.id === selected.id) && (
          <option value={selected.id}>{selected.label}</option>
        )}
        {filtered.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
      {loading && <small role="status">Caricamento docenti…</small>}
      {error && (
        <small role="alert">
          Elenco docenti non disponibile. Verifica la connessione, i permessi e
          l'aggiornamento del backend.
        </small>
      )}
      {!loading && !error && !disabled && !filtered.length && (
        <small role="status">
          Nessun docente corrispondente nel workspace.
        </small>
      )}
      <small className="muted">
        Email disponibile solo per il tuo profilo. Gli omonimi sono distinti per
        ruolo e numero nell'elenco.
      </small>
    </div>
  );
}
