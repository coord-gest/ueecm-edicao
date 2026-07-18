#!/usr/bin/env node
/**
 * Auditoria WCAG 2.1 AA via axe-core + Playwright.
 *
 * Uso:
 *   BASE_URL=http://localhost:8080 node scripts/axe-audit.mjs
 *
 * Escaneia uma lista de rotas públicas e emite um relatório JSON em
 * `docs/relatorios/axe-audit.json` + resumo no stdout. Falhas de
 * severidade "critical" ou "serious" fazem o script sair com código 1
 * (útil para bloquear PRs no CI).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const ROUTES = (
  process.env.AXE_ROUTES ??
  "/,/equipe,/calendario,/galeria,/posts,/instalar,/auth,/privacidade,/termos-de-uso"
)
  .split(",")
  .map((r) => r.trim())
  .filter(Boolean);

const OUT_DIR = "docs/relatorios";
const OUT_FILE = `${OUT_DIR}/axe-audit.json`;

const SEVERITY_FAIL = new Set(["critical", "serious"]);

async function run() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1800 } });
  const report = { baseUrl: BASE_URL, generatedAt: new Date().toISOString(), routes: [] };
  let hardFail = 0;

  for (const route of ROUTES) {
    const url = `${BASE_URL}${route}`;
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const violations = results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        helpUrl: v.helpUrl,
        nodes: v.nodes.length,
      }));
      const failCount = violations.filter((v) => SEVERITY_FAIL.has(v.impact ?? "")).length;
      hardFail += failCount;
      console.log(`[${route}] ${violations.length} violações — ${failCount} bloqueantes`);
      report.routes.push({ route, url, violations });
    } catch (err) {
      console.error(`[${route}] falhou:`, err.message);
      report.routes.push({ route, url, error: err.message });
    } finally {
      await page.close();
    }
  }

  await browser.close();
  writeFileSync(OUT_FILE, JSON.stringify(report, null, 2));
  console.log(`\nRelatório salvo em ${OUT_FILE}`);
  if (hardFail > 0) {
    console.error(`\n❌ ${hardFail} violações críticas/sérias encontradas.`);
    process.exit(1);
  }
  console.log("\n✅ Nenhuma violação crítica/séria.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
