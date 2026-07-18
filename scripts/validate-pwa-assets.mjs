#!/usr/bin/env node
/**
 * Valida manifest.json, apple-touch-startup-image e o splash in-app.
 * Falha (exit 1) se qualquer imagem referenciada não existir em /public,
 * ou se dimensões declaradas divergirem do arquivo real.
 */
import { readFileSync, statSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(process.cwd());
const PUB = join(ROOT, "public");
const errors = [];
const warnings = [];
const ok = [];

function pngSize(path) {
  const buf = readFileSync(path);
  if (buf.slice(1, 4).toString() !== "PNG") return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function checkAsset(url, expectedSize) {
  if (!url.startsWith("/")) {
    warnings.push(`URL não-absoluta ignorada: ${url}`);
    return;
  }
  const p = join(PUB, url);
  if (!existsSync(p)) {
    errors.push(`Faltando: ${url}`);
    return;
  }
  const bytes = statSync(p).size;
  let dims = "";
  if (url.endsWith(".png") && expectedSize) {
    const s = pngSize(p);
    if (s) {
      dims = ` ${s.w}x${s.h}`;
      const [ew, eh] = expectedSize.split("x").map(Number);
      if (ew && eh && (s.w !== ew || s.h !== eh)) {
        errors.push(`Dimensões divergem em ${url}: manifest=${expectedSize} real=${s.w}x${s.h}`);
      }
    }
  }
  ok.push(`${url} (${(bytes / 1024).toFixed(1)}KB${dims})`);
}

// 1) manifest.json
const manifestPath = join(PUB, "manifest.json");
if (!existsSync(manifestPath)) {
  console.error("❌ public/manifest.json não encontrado");
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

for (const icon of manifest.icons || []) checkAsset(icon.src, icon.sizes);
for (const s of manifest.screenshots || []) checkAsset(s.src, s.sizes);
for (const sc of manifest.shortcuts || [])
  for (const i of sc.icons || []) checkAsset(i.src, i.sizes);

// 2) apple-touch-startup-image e apple-touch-icon no __root.tsx
const rootTsx = readFileSync(join(ROOT, "src/routes/__root.tsx"), "utf8");
const linkRe =
  /rel:\s*"(apple-touch-startup-image|apple-touch-icon|icon|shortcut icon)"[^}]*?href:\s*"([^"]+)"/g;
let m;
while ((m = linkRe.exec(rootTsx)) !== null) checkAsset(m[2]);

// 3) splash in-app usado pelo TitinhoWelcome
const welcome = readFileSync(join(ROOT, "src/components/TitinhoWelcome.tsx"), "utf8");
const srcRe = /src=\{?"([^"]+\.(?:webp|png|jpg|svg))"/g;
while ((m = srcRe.exec(welcome)) !== null) checkAsset(m[1]);

// Cobertura mínima obrigatória
const requiredPurposes = ["any", "maskable"];
const purposesFound = new Set(
  (manifest.icons || []).flatMap((i) => (i.purpose || "any").split(/\s+/)),
);
for (const p of requiredPurposes) {
  if (!purposesFound.has(p)) errors.push(`manifest.icons não contém ícone com purpose="${p}"`);
}

// Relatório
console.log("PWA asset validation");
console.log("---------------------");
for (const line of ok) console.log("  ✓", line);
for (const w of warnings) console.log("  ⚠", w);
for (const e of errors) console.log("  ✗", e);

if (errors.length) {
  console.log(`\n❌ ${errors.length} erro(s).`);
  process.exit(1);
}
console.log(`\n✅ manifest + splash + ícones válidos (${ok.length} arquivos).`);
