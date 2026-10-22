import { afterEach, it, expect } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { TeacherPicker } from "./TeacherPicker";
import {
  filterTeachers,
  validTeacher,
  teacherChoices,
  type TeacherOption,
} from "../domain/teachers";
const teachers: TeacherOption[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Anna Fittizia",
    role: "owner",
    email: "anna@example.invalid",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Anna Fittizia",
    role: "teacher",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Bruno Fittizio",
    role: "teacher",
  },
];
afterEach(cleanup);
it("searches names and authorized emails, keeps UUID only as option value", () => {
  function Form() {
    const [value, setValue] = useState("");
    return (
      <TeacherPicker teachers={teachers} value={value} onChange={setValue} />
    );
  }
  render(<Form />);
  fireEvent.change(screen.getByLabelText("Cerca docente per nome o email"), {
    target: { value: "ANNA@EXAMPLE" },
  });
  const select = screen.getByLabelText("Docente *") as HTMLSelectElement;
  expect(select.options.length).toBe(2);
  expect(select.options[1].text).toContain("Anna Fittizia");
  expect(select.options[1].text).not.toContain(teachers[0].id);
  fireEvent.change(select, { target: { value: teachers[0].id } });
  expect(select.value).toBe(teachers[0].id);
  expect(filterTeachers(teachers, "bruno")).toHaveLength(1);
});
it("distinguishes duplicate names and validates only known UUIDs", () => {
  const labels = teacherChoices(teachers).map((t) => t.label);
  expect(new Set(labels).size).toBe(3);
  expect(labels[0]).toContain("omonimo");
  expect(validTeacher(teachers[0].id, teachers)).toBe(true);
  expect(validTeacher("44444444-4444-4444-8444-444444444444", teachers)).toBe(
    false,
  );
  expect(validTeacher("Anna Fittizia", teachers)).toBe(false);
});
it("preserves an existing unavailable teacher without showing their identifier", () => {
  render(
    <TeacherPicker
      teachers={[]}
      value={teachers[0].id}
      disabled
      onChange={() => {}}
    />,
  );
  const select = screen.getByLabelText("Docente *") as HTMLSelectElement;
  expect(select.disabled).toBe(true);
  expect(select.value).toBe(teachers[0].id);
  expect(select.textContent).toContain("riferimento conservato");
  expect(select.textContent).not.toContain(teachers[0].id);
});
it("blocks selection and reports an unavailable directory", () => {
  render(<TeacherPicker teachers={[]} value="" error onChange={() => {}} />);
  expect(
    (screen.getByLabelText("Docente *") as HTMLSelectElement).disabled,
  ).toBe(true);
  expect(screen.getByRole("alert").textContent).toContain(
    "Elenco docenti non disponibile",
  );
});
