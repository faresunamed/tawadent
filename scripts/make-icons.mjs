// Génère les icônes PNG de l'application à partir de public/logo.svg
// Usage : node scripts/make-icons.mjs
import sharp from "sharp";
import { mkdirSync, readFileSync } from "node:fs";

mkdirSync("public/icons", { recursive: true });
const svg = readFileSync("public/logo.svg");

await sharp(svg, { density: 600 }).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(svg, { density: 600 }).resize(512, 512).png().toFile("public/icons/icon-512.png");

// Version "maskable" : le logo occupe 70 % au centre sur fond uni (zone de sécurité Android).
const inner = await sharp(svg, { density: 600 }).resize(360, 360).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#087f8c" } })
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toFile("public/icons/icon-maskable-512.png");

console.log("Icônes générées dans public/icons/");
