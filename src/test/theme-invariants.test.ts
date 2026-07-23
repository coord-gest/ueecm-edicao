import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Invariantes de tema Navy Trust + cantos retos.
 *
 * Este teste trava o design system contra regressões:
 *  - O reset global de border-radius (0!important) precisa existir.
 *  - O widget do Tito Assistente Virtual precisa estar isento e
 *    manter seus próprios tokens de radius.
 *  - A paleta Navy Trust (primary/accent/sidebar/gradient) precisa
 *    estar declarada em :root e em .dark.
 *  - Os utilitários de foco/hover devem apoiar-se nos tokens do tema
 *    (--ring / --shadow-ring-primary), nunca em cores hardcoded.
 */
const css = readFileSync(resolve(__dirname, "../styles.css"), "utf8");

describe("Design system — cantos retos + paleta Navy Trust", () => {
  it("aplica reset global de border-radius com !important", () => {
    expect(css).toMatch(
      /\*:not\(\[data-tito-widget\]\):not\(\[data-tito-widget\] \*\)[\s\S]{0,200}border-radius:\s*0\s*!important/,
    );
  });

  it("preserva o arredondamento próprio do widget do Tito", () => {
    expect(css).toMatch(/\[data-tito-widget\],\s*\n\s*\[data-tito-widget\] \*/);
    // Ao menos um token de raio > 0 dentro do escopo do Tito.
    const titoBlock = css.match(
      /\[data-tito-widget\],\s*\n\s*\[data-tito-widget\] \*\s*\{([\s\S]*?)\n\}/,
    );
    expect(titoBlock).not.toBeNull();
    expect(titoBlock![1]).toMatch(/--radius(?:-\w+)?:\s*\d+px/);
  });

  it("zera todos os tokens de raio no @theme inline", () => {
    const themeBlock = css.match(/@theme inline\s*\{([\s\S]*?)\n\}/);
    expect(themeBlock).not.toBeNull();
    const themeBody = themeBlock![1];
    for (const token of [
      "--radius-sm",
      "--radius-md",
      "--radius-lg",
      "--radius-xl",
      "--radius-2xl",
      "--radius-3xl",
      "--radius-4xl",
    ]) {
      expect(themeBody).toMatch(new RegExp(`${token}:\\s*0px`));
    }
  });

  it("declara a paleta Navy Trust em :root", () => {
    const rootBlock = css.match(/:root\s*\{([\s\S]*?)\n\}/);
    expect(rootBlock).not.toBeNull();
    const body = rootBlock![1];
    // Marcadores da paleta Navy Trust (#1e3a5f / #3b6fa0 / #0f1b3d).
    expect(body).toMatch(/#1e3a5f/);
    expect(body).toMatch(/#0f1b3d/);
    expect(body).toMatch(/#3b6fa0/);
    // Tokens semânticos obrigatórios.
    for (const token of [
      "--primary",
      "--accent",
      "--ring",
      "--sidebar",
      "--gradient-primary",
      "--gradient-hero",
    ]) {
      expect(body).toMatch(new RegExp(`${token}\\s*:`));
    }
  });

  it("declara variante escura da paleta Navy Trust", () => {
    const darkBlock = css.match(/\.dark\s*\{([\s\S]*?)\n\}/);
    expect(darkBlock).not.toBeNull();
    const body = darkBlock![1];
    for (const token of ["--primary", "--accent", "--ring", "--sidebar", "--gradient-primary"]) {
      expect(body).toMatch(new RegExp(`${token}\\s*:`));
    }
  });

  it("estados de foco usam token --ring do tema (não cores hardcoded)", () => {
    // A regra base de foco-visível precisa existir e apontar para var(--ring).
    expect(css).toMatch(/:focus-visible[\s\S]{0,400}outline:\s*2px\s+solid\s+var\(--ring\)/);
  });

  it("hover-lift usa a sombra do tema Navy Trust", () => {
    const util = css.match(/@utility hover-lift\s*\{([\s\S]*?)\n\}/);
    expect(util).not.toBeNull();
    expect(util![1]).toMatch(/var\(--shadow-lifted\)/);
    expect(util![1]).toMatch(/var\(--shadow-ring-primary\)/);
  });
});