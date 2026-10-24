export async function readStudentFile(file: File) {
  if (file.size > 5 * 1024 * 1024) throw Error("Dimensione massima 5 MB.");
  let rows: string[][] = [];
  if (/\.csv$/i.test(file.name)) {
    const { default: Papa } = await import("papaparse");
    const parsed = Papa.parse<string[]>(await file.text(), {
      skipEmptyLines: "greedy",
    });
    if (parsed.errors.length) throw Error(parsed.errors[0].message);
    rows = parsed.data;
  } else if (/\.xlsx$/i.test(file.name)) {
    const Excel = await import("exceljs");
    const book = new Excel.Workbook();
    await book.xlsx.load(await file.arrayBuffer());
    const sheet = book.worksheets[0];
    if (!sheet) throw Error("File senza fogli.");
    sheet.eachRow((row) =>
      rows.push(
        Array.from(
          { length: sheet.columnCount },
          (_, i) => row.getCell(i + 1).text,
        ),
      ),
    );
  } else throw Error("Scegli un CSV o XLSX.");
  if (rows.length < 2 || rows.length > 1001)
    throw Error("Sono richieste intestazione e da 1 a 1000 righe.");
  const headers = rows.shift()!.map((h, i) => h.trim() || "Colonna " + (i + 1));
  if (new Set(headers).size !== headers.length)
    throw Error("Intestazioni duplicate: rinominale prima di importare.");
  return { headers, rows };
}
export async function fingerprint(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
