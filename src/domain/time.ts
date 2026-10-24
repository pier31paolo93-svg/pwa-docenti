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
