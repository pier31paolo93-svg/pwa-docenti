// Deterministic resize/padding only: preserve the supplied artwork, never crop.
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
const source = "assets/branding/quaderno-docenti-original.png";
const background = "#bbd9f3";
for (const [file, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
  ["favicon-32.png", 32],
  ["favicon-16.png", 16],
]) {
  await sharp(source)
    .resize(size, size, { fit: "contain", background })
    .png()
    .toFile(`public/${file}`);
}
// A square at 56% of the canvas fits inside the central 80%-diameter safe circle.
const inner = 286;
const artwork = await sharp(source)
  .resize(inner, inner, { fit: "contain", background })
  .png()
  .toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background } })
  .composite([{ input: artwork, left: 113, top: 113 }])
  .png()
  .toFile("public/icon-maskable-512.png");
const png = readFileSync("public/favicon-32.png");
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = 32;
header[7] = 32;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);
writeFileSync("public/favicon.ico", Buffer.concat([header, png]));
console.log(
  "Generated original-artwork PWA, maskable, Apple and favicon assets without cropping.",
);
