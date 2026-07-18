#!/usr/bin/env node
/**
 * Sincroniza fingerprints SHA-256 do ZIP do PWABuilder com
 * public/.well-known/assetlinks.json.
 *
 * Uso:
 *   bun run sync:assetlinks <caminho-do-zip>
 *   bun run sync:assetlinks ~/Downloads/conectaueecm.zip
 *
 * O script:
 *  1. Abre o ZIP (sem extrair no disco).
 *  2. Localiza qualquer arquivo `assetlinks.json` dentro dele.
 *  3. Extrai package_name + sha256_cert_fingerprints.
 *  4. Faz merge (união, sem duplicados) com o arquivo atual.
 *  5. Grava public/.well-known/assetlinks.json formatado.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const TARGET = resolve("public/.well-known/assetlinks.json");

function die(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

const zipPath = process.argv[2];
if (!zipPath) die("Informe o caminho do ZIP: bun run sync:assetlinks <arquivo.zip>");
if (!existsSync(zipPath)) die(`ZIP não encontrado: ${zipPath}`);
if (!existsSync(TARGET)) die(`Arquivo alvo não existe: ${TARGET}`);

// Lista os arquivos do ZIP e escolhe o primeiro assetlinks.json.
const listing = execSync(`unzip -Z1 "${zipPath}"`, { encoding: "utf8" });
const candidate = listing.split("\n").find((line) => line.trim().endsWith("assetlinks.json"));
if (!candidate) die("Nenhum assetlinks.json encontrado dentro do ZIP.");

// Extrai o conteúdo para stdout.
const raw = execSync(`unzip -p "${zipPath}" "${candidate}"`, { encoding: "utf8" });
let incoming;
try {
  incoming = JSON.parse(raw);
} catch (err) {
  die(`assetlinks.json do ZIP não é JSON válido: ${err.message}`);
}

const incomingEntry = Array.isArray(incoming) ? incoming[0] : incoming;
const incomingPkg = incomingEntry?.target?.package_name;
const incomingPrints = incomingEntry?.target?.sha256_cert_fingerprints ?? [];
if (!incomingPkg || incomingPrints.length === 0)
  die("assetlinks.json do ZIP não contém package_name ou fingerprints.");

const current = JSON.parse(readFileSync(TARGET, "utf8"));
const currentEntry = current[0];
const currentPkg = currentEntry.target.package_name;

if (currentPkg !== incomingPkg) {
  console.warn(
    `⚠️  package_name divergente: atual="${currentPkg}", ZIP="${incomingPkg}". Mantendo o atual.`,
  );
}

const merged = Array.from(
  new Set([...currentEntry.target.sha256_cert_fingerprints, ...incomingPrints]),
);
const added = merged.filter((f) => !currentEntry.target.sha256_cert_fingerprints.includes(f));

currentEntry.target.sha256_cert_fingerprints = merged;
writeFileSync(TARGET, JSON.stringify(current, null, 2) + "\n");

console.log(`\n✅ assetlinks.json atualizado`);
console.log(`   Origem no ZIP : ${candidate}`);
console.log(`   Package name  : ${currentPkg}`);
console.log(`   Total prints  : ${merged.length}`);
console.log(
  added.length
    ? `   Novos (${added.length}):\n     - ${added.join("\n     - ")}`
    : `   Nenhum fingerprint novo — tudo já estava cadastrado.`,
);
console.log(`\n👉 Republique o site para os novos fingerprints entrarem no ar.\n`);
