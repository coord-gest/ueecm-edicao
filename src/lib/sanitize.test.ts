import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "@/lib/sanitize";

describe("sanitizeHtml", () => {
  it("remove scripts maliciosos do conteúdo", () => {
    const dirty = '<p>Olá</p><script>alert("xss")</script>';
    const clean = sanitizeHtml(dirty);
    expect(clean).toContain("<p>Olá</p>");
    expect(clean).not.toContain("<script");
  });

  it("permite iframes de YouTube", () => {
    const html = '<iframe src="https://www.youtube.com/embed/abc123"></iframe>';
    const clean = sanitizeHtml(html);
    expect(clean).toContain("youtube.com/embed/abc123");
  });

  it("bloqueia iframes de domínios não permitidos", () => {
    const html = '<iframe src="https://evil.example.com/x"></iframe>';
    const clean = sanitizeHtml(html);
    expect(clean).not.toContain("evil.example.com");
  });
});
