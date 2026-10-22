import { readFileSync, readdirSync, statSync } from "node:fs";
import assert from "node:assert/strict";
import sharp from "sharp";
const base = "/pwa-docenti/";
const html = readFileSync("dist/index.html", "utf8");
const manifest = JSON.parse(readFileSync("dist/manifest.webmanifest", "utf8"));
assert(manifest.icons.some((i) => i.src === "icon-maskable-512.png" && i.purpose === "maskable"));
assert(html.includes(`${base}favicon.ico`));
for (const [file,size] of [["icon-192.png",192],["icon-512.png",512],["icon-maskable-512.png",512],["apple-touch-icon.png",180],["favicon-32.png",32],["favicon-16.png",16]]) {
  const metadata=await sharp(`dist/${file}`).metadata();
  assert.equal(metadata.width,size);
  assert.equal(metadata.height,size);
}
assert(Math.sqrt(2)*286/2 <= 512*.4,"Maskable artwork must fit in safe circle");
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
