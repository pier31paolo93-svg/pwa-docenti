export type TeacherOption = {
  id: string;
  name: string;
  role: string;
  email?: string;
};
const normalized = (value: string) => value.trim().toLocaleLowerCase("it");
export function teacherChoices(teachers: TeacherOption[]) {
  const sorted = [...teachers].sort(
    (a, b) => a.name.localeCompare(b.name, "it") || a.id.localeCompare(b.id),
  );
  const counts = new Map<string, number>();
  const positions = new Map<string, number>();
  for (const t of sorted)
    counts.set(normalized(t.name), (counts.get(normalized(t.name)) ?? 0) + 1);
  return sorted.map((t) => {
    const name = t.name.trim() || "Profilo senza nome";
    const key = normalized(t.name);
    const position = (positions.get(key) ?? 0) + 1;
    positions.set(key, position);
    const role =
      (
        { owner: "Owner", admin: "Admin", teacher: "Docente" } as Record<
          string,
          string
        >
      )[t.role] ?? "Docente";
    return {
      ...t,
      label: [
        name,
        t.email,
        role,
        (counts.get(key) ?? 0) > 1 ? `omonimo ${position}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
    };
  });
}
export function filterTeachers<T extends TeacherOption>(
  teachers: T[],
  search: string,
): T[] {
  const q = normalized(search);
  return teachers.filter((t) =>
    normalized(`${t.name} ${t.email ?? ""}`).includes(q),
  );
}
export function validTeacher(value: unknown, teachers: TeacherOption[]) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    ) &&
    teachers.some((t) => t.id === value)
  );
}
