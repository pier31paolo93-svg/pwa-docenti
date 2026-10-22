import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
const css = readFileSync("src/mobile.css", "utf8");
function luminance(hex: string) {
  let h = hex.slice(1);
  if (h.length === 3)
    h = h
      .split("")
      .map((x) => x + x)
      .join("");
  return h
    .match(/../g)!
    .map((x) => parseInt(x, 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
    .reduce((sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i], 0);
}
const themes = [
  ...css.matchAll(/:root(?:\[data-theme="dark"\])? \{([^}]+)\}/g),
];
test("contrast audit finds both actual CSS themes", () =>
  expect(themes).toHaveLength(2));
for (const [index, theme] of themes.entries()) {
  const colors = Object.fromEntries(
    [...theme[1].matchAll(/--([\w-]+):\s*(#[\da-f]+);/g)].map((m) => [
      m[1],
      m[2],
    ]),
  );
  for (const [fg, bg, minimum] of [
    ["ink", "surface", 4.5],
    ["muted", "surface", 4.5],
    ["primary", "surface", 4.5],
    ["on-primary", "primary", 4.5],
    ["control-border", "surface", 3],
  ] as const) {
    test(`${index ? "dark" : "light"}: contrast ${fg}/${bg}`, () => {
      const a = luminance(colors[fg]),
        b = luminance(colors[bg]);
      expect(
        (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      ).toBeGreaterThanOrEqual(minimum);
    });
  }
}
