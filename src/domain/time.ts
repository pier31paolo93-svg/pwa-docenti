const rome = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Rome",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
export function romeLocal(value: string) {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value;
  return rome.format(new Date(value)).replace(" ", "T");
}
export function italianDate(value: unknown): string {
  if (value == null || value === "") return "";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const day = raw.slice(0, 10);
    const parsed = new Date(day + "T12:00:00Z");
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== day
    )
      return "";
  }
  const local =
    /^\d{4}-\d{2}-\d{2}T/.test(raw) && !Number.isNaN(Date.parse(raw))
      ? romeLocal(raw)
      : raw;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(local);
  if (!m) return raw;
  const date = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== `${m[1]}-${m[2]}-${m[3]}`
  )
    return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}
export function italianDateTime(value: unknown): string {
  if (value == null || value === "") return "";
  const raw = String(value);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(raw) || Number.isNaN(Date.parse(raw)))
    return italianDate(raw);
  if (!italianDate(raw)) return "";
  const local = romeLocal(raw);
  return `${italianDate(local.slice(0, 10))} ${local.slice(11, 16)}`;
}
export function italianDateValue(value: unknown): string {
  return /^\d{4}-\d{2}-\d{2}T/.test(String(value ?? ""))
    ? italianDateTime(value)
    : italianDate(value);
}
export function romeInstant(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw Error("Data e ora non valide.");
  const wall = Date.parse(value + "Z");
  const matches = [1, 2]
    .map((offset) => new Date(wall - offset * 3600000))
    .filter((d) => romeLocal(d.toISOString()) === value);
  if (matches.length !== 1)
    throw Error(
      matches.length
        ? "Ora ambigua al cambio solare Europe/Rome: scegli un orario fuori dall’intervallo ripetuto."
        : "Ora inesistente al cambio legale Europe/Rome: scegli un altro orario.",
    );
  return matches[0].toISOString();
}
