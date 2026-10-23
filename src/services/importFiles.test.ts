import { it, expect } from "vitest";
import ExcelJS from "exceljs";
import { readStudentFile } from "./importFiles";
const csv = (content: string) =>
  ({
    name: "fittizio.csv",
    size: content.length,
    text: async () => content,
  }) as File;
it("reads custom CSV headers and quoted Italian text", async () =>
  expect(
    await readStudentFile(
      csv('Cognome personalizzato,Nome\n"Fittizio, esempio",Città'),
    ),
  ).toEqual({
    headers: ["Cognome personalizzato", "Nome"],
    rows: [["Fittizio, esempio", "Città"]],
  }));
it("rejects duplicated headers and empty files", async () => {
  await expect(readStudentFile(csv("Nome,Nome\nUno,Due"))).rejects.toThrow(
    "duplicate",
  );
  await expect(readStudentFile(csv("Nome,Cognome"))).rejects.toThrow("righe");
});
it("limits untrusted imports to 5 MB", async () => {
  await expect(
    readStudentFile({ name: "large.csv", size: 6 * 1024 * 1024 } as File),
  ).rejects.toThrow("5 MB");
});
it("reads a real XLSX without requiring a student code", async () => {
  const book = new ExcelJS.Workbook();
  book.addWorksheet("Fittizi").addRows([
    ["Cognome", "Nome", "Numero di registro"],
    ["Fittizio", "Esempio", 7],
  ]);
  const buffer = await book.xlsx.writeBuffer();
  const result = await readStudentFile({
    name: "fittizio.xlsx",
    size: buffer.byteLength,
    arrayBuffer: async () => buffer,
  } as File);
  expect(result.rows).toEqual([["Fittizio", "Esempio", "7"]]);
});
