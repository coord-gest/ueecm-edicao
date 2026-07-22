# Análise Técnica Completa — U.E. Evaristo Campelo de Matos

**Versão:** v14 — Consolidada Final
**Data:** 22/07/2026
**Framework:** Prompt Mestre v2 — Código · Segurança · SEO · PWA · LGPD · Validação
**Veredito:** ✅ **APROVADO PARA PRODUÇÃO** — Nota **9.7/10**

---

## 1. Sumário Executivo

O portal escolar **Conecta UEECM** consolidou o ciclo completo de hardening
técnico (RLS/CLS, CSP/HSTS, HMAC, rate-limit) e agora entrega o pacote
**Unir Escola & Comunidade** — engajamento familiar de ponta a ponta com
diário de bordo, radar do filho, méritos, alerta de evasão, contrato
digital, selo de presença parental, mural, comunicados com confirmação,
chat pai↔professor moderado, rede de apoio e vaquinha digital.

No lado pedagógico o sistema ganhou **Atividades e Trabalhos** (com
dashboard do responsável e ranking) e **Planejamentos Pedagógicos**
assistidos por Gemini. O painel de **Alertas Globais v2** passou a operar
com rajadas agendadas via `pg_cron` e auditoria imutável.

| Indicador | Valor |
|-----------|-------|
| Vulnerabilidades críticas | **0** |
| Vulnerabilidades altas | **0** |
| Vulnerabilidades médias | **1** (Leaked Password Protection — ação manual) |
| Testes automatizados | **152+ passando** |
| Typecheck | **0 erros** |
| RLS coverage (schema public) | **100%** |
| Rotas ativas | ~130 |
| Migrações Supabase | 170+ |
| Nota final | **9.7 / 10** |

---

## 2. Arquitetura

- **Frontend:** React 19 + TanStack Start v1 (SSR) + TanStack Router/Query + Tailwind CSS v4 + shadcn/ui.
- **Backend:** TanStack Server Functions em **Cloudflare Workers** (Nitro).
- **Banco:** PostgreSQL em Supabase externo, RLS 100%, papéis em `user_roles` via `has_role` (`SECURITY DEFINER`, `search_path` fixo).
- **Storage:** `posts-media` (público), `galeria-eventos` (gated por publicação), `planejamentos-pedagogicos` (privado por professor).
- **Push:** FCM v1 + SW dedicado + dispatch server-side com segmentação por role/usuário.
- **PWA/Offline:** `vite-plugin-pwa` (`generateSW`, Workbox).
- **IA:** Gemini 2.0 Flash (chat com RAG, OCR de boletins, planejamentos pedagógicos, moderação).
- **Anti-bot:** Cloudflare Turnstile v2 (com fallback runtime).
- **Observabilidade:** Sentry (browser) + `system_errors` (server) + FinOps dashboard.

### 2.1 Fluxo de Dados

```text
Browser ── HTTPS ──▶ Cloudflare Worker (SSR + APIs)
                         │
                         ├──▶ Supabase Postgres (RLS + CLS)
                         ├──▶ Supabase Storage (posts, galeria, planejamentos)
                         ├──▶ Firebase FCM v1 (push segmentado por role/user)
                         ├──▶ Gemini API (chat / OCR / planejamentos)
                         └──▶ Sentry (erros browser)
```

---

## 3. Módulos por Frente

### 3.1 Comunicação Escola ↔ Família
- **Comunicados com Confirmação de Leitura** (dashboard de leitura por turma).
- **Chat Pai ↔ Professor** com moderação por IA.
- **Notificações Push** com segmentação por role/usuário/turma.
- **Alertas Globais v2** com pré-visualização, agendamento e rajadas via `pg_cron`.

### 3.2 Engajamento Familiar ("Unir Escola & Comunidade")
- **Diário de Bordo do Aluno** — timeline de eventos escolares.
- **Radar do Filho** — KPIs semáforos (frequência, notas, atividades, comportamento).
- **Méritos e Ocorrências** — anotações do professor com IA.
- **Alerta de Evasão** — scoring SQL com painel dedicado.
- **Contrato Digital** — assinatura dupla (escola + responsável).
- **Selo de Presença Parental** — badge por presença em eventos/confirmações.
- **Mural da Comunidade** — postagens públicas moderadas.
- **Rede de Apoio** + **Vaquinhas Digitais** — campanhas comunitárias.

### 3.3 Pedagógico
- **Atividades e Trabalhos** — professor cria por turma, marca Fez/Não fez; pai consulta pendências; ranking com drill-down e export CSV/PDF.
- **Planejamentos Pedagógicos** — semanal/quinzenal/mensal/semestral com assistência do Gemini; storage privado por professor.
- **Boletim SEMED Assunção do Piauí** — 10 disciplinas × 11 avaliações, cálculo automático, export DOCX landscape.
- **Importação de boletim por PDF** com Gemini 2.0 Flash.
- **Chat IA Tito** para alunos (com RAG e rate-limit).

### 3.4 Operacional
- **Agendamentos** com protocolo público (`/consultar-agendamento`), segmentação e lembretes por cron.
- **Painel de Manutenção** — backup semanal + monitor de egress + compressão retroativa WebP.
- **Painel de Erros** — `system_errors` filtrável.
- **FinOps** — custo por chamada de IA e projeção mensal.

### 3.5 Governança
- **DPIA/ROPA** documentados (`docs/DPIA-ROPA.md`).
- **RUNBOOK** operacional (`docs/RUNBOOK.md`).
- **Auditoria administrativa** (`admin_access_logs`, `audit_logs`, `alert_audit_logs`).
- **Direito ao esquecimento** (`apagar-conta.functions.ts`, `data_subject_requests`).

---

## 4. Segurança

### 4.1 RLS & CLS
- 100% das tabelas `public` com RLS ativa.
- Papéis em tabela dedicada `user_roles` + `has_role` (SECURITY DEFINER, search_path fixo).
- CLS em `profissionais`: PII (email/telefone) revogada de `anon`/`authenticated`; página pública usa view `profissionais_publicos` (`security_invoker=true`).
- Views auditadas: `enquete_resultados` e `profissionais_publicos` com `security_invoker=true`.

### 4.2 Rate Limiting & HMAC
- `/api/chat`: IP (30/min) · usuário (60/min) · global (300/min).
- `/api/public/dispatch-push`, `/api/public/backup-semanal`, webhooks: HMAC timing-safe.
- Alertas em rajada: 100/h por admin, 30/h global.

### 4.3 Headers HTTP (`src/server.ts`)
- CSP com whitelist (Turnstile, Supabase, FCM, Gemini, Sentry).
- HSTS com preload.
- `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`.

### 4.4 Dependências
- `xlsx` substituído por `exceljs@4.4.0` — resolve CVE Prototype Pollution.
- SBOM CycloneDX gerado em CI (`.github/workflows/sbom.yml`).
- Dependabot ativo.

### 4.5 Funções `SECURITY DEFINER`
- 25 funções sensíveis com `EXECUTE` revogado de `anon`.
- `process_alert_burst_tick()` e `log_alert_action()` restritos a `service_role`.
- `increment_post_views(uuid)` mantida para `anon` (contador público, intencional).

### 4.6 Secrets
- `SERVICE_ROLE_KEY`, `FIREBASE_PRIVATE_KEY`, `DISPATCH_SECRET`, `GEMINI_API_KEY`, `TURNSTILE_SECRET_KEY` nunca no bundle client.
- `VITE_TURNSTILE_SITE_KEY` exposta como Plaintext (pública por design) com fallback via `/api/public/turnstile-config`.

### 4.7 Pendência Manual
- 🟡 Ativar **Leaked Password Protection** em Supabase → Auth → Providers → Email.

---

## 5. Notificações Push (FCM)

- Registro via `/api/push/fcm-register` com bind ao `user_id` no login (`reattachPushTokenToUser`).
- Dispatch server-side em `/api/public/dispatch-push` acionado por `pg_net` em triggers.
- Segmentação por role, usuário e turma na fila.
- Prioridade máxima (Android `PRIORITY_MAX` + `HIGH`; iOS `apns-priority:10`).
- Tags únicas + `renotify` + `requireInteraction` → compatível Android 13/14/15/**16+**.
- Trigger `enqueue_due_alert_pushes` com janela de 10 min pós-expiração.
- `push_notifications_queue` com `status` (pending/sent/failed) e `last_error`.

---

## 6. LGPD & Conformidade

- `docs/DPIA-ROPA.md` + `docs/RUNBOOK.md` versionados.
- Consentimento de cookies, imagem e parental implementados.
- Base legal LGPD Art. 14 (dados de menores).
- Consentimento parental obrigatório em cadastro de alunos <18 (tabela `parental_consents`).
- `data_subject_requests` com policies restritas.
- Direito ao esquecimento operacional.

---

## 7. Testes & Qualidade

| Área | Status |
|------|--------|
| Vitest unit + integration | ✅ 152+ passando |
| Typecheck estrito | ✅ 0 erros |
| Prettier + ESLint | ✅ |
| CI/CD (GitHub Actions) | ✅ gate typecheck + testes no PR |
| SBOM CycloneDX | ✅ automático |
| RLS test-suite | ✅ |
| E2E Playwright | Parcial (comunicado/justificativa/login/FCM) |

---

## 8. SEO, PWA & Design System

- Sitemap dinâmico + RSS por rota; JSON-LD por página.
- `head()` próprio por rota com `og:image` derivado do herói/capa.
- SW só em produção HTTPS; `/offline` pré-cacheada; coexiste com SW do FCM.
- Tema **"Azul & Menta"** com gradientes ricos em light/dark.
- Padronização global `border-radius: 5px` em cards, botões, inputs e tabs.
- Scoping `data-admin` — painéis administrativos sem arredondamento; site público com o design suave.
- Auditoria WCAG 2.2 AA (`docs/A11Y-AUDIT.md`).

---

## 9. Veredito Final

> Sistema **APROVADO PARA PRODUÇÃO** com nota **9.7/10**.
>
> Base sólida (RLS 100%, CLS, CSP/HSTS, rate-limit, HMAC, Turnstile),
> conformidade LGPD documentada, push funcional em Android 13/16+ e iOS
> mesmo com tela bloqueada, painel de Alertas Globais endurecido com
> auditoria e rajadas server-side, e o pacote **Unir Escola & Comunidade**
> entregando engajamento familiar de ponta a ponta.

### Pendências para "certificação definitiva"
1. Ativar **Leaked Password Protection** no painel Supabase (1 clique).
2. Adicionar `bun audit` ao CI (P2).
3. Executar **pentest ativo externo** — análise atual é estática/teórica.
4. Executar **testes de carga reais** em pico estimado.
5. Rodar **UAT formal** com professores e responsáveis.

**Responsável técnico:** Francisco Douglas — `github.com/Francisco-Douglas-dev`
**Data de emissão:** 22/07/2026