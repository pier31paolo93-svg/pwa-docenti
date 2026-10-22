import { readFileSync, readdirSync, statSync } from "node:fs";
import assert from "node:assert/strict";
const base = "/pwa-docenti/";
const html = readFileSync("dist/index.html", "utf8");
const manifest = JSON.parse(readFileSync("dist/manifest.webmanifest", "utf8"));
assert.equal(manifest.id, base);
assert.equal(manifest.start_url, base);
assert.equal(manifest.scope, base);
assert.equal(manifest.display, "standalone");
assert(html.includes(`${base}manifest.webmanifest`));
assert(html.includes(`${base}assets/`));
assert(!/(?:src|href)=["']\/(?:assets|manifest\.webmanifest)/.test(html));
const sw = readFileSync("dist/sw.js", "utf8");
assert(sw.includes(`${base}index.html`));
assert(sw.includes("SKIP_WAITING"));
function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = `${dir}/${name}`;
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}
for (const file of files("dist").filter((p) => /\.(js|html|json|webmanifest)$/.test(p))) {
  const content = readFileSync(file, "utf8");
  assert(!/sb_secret_[A-Za-z0-9_-]+|sbp_[A-Za-z0-9]{20,}|-----BEGIN .*PRIVATE KEY-----/.test(content), `Secret-like material in ${file}`);
  assert(!/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(content), `Unexpected JWT in ${file}`);
}
console.log("PASS Pages artifact: base, manifest identity/scope, service worker update support and secret-pattern scan.");
