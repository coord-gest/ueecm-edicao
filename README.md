# U.E. Evaristo Campelo de Matos — Portal Escolar

> Plataforma institucional da escola: blog público com SEO, calendário, grade de horários, gestão escolar (turmas/alunos/responsáveis), notificações push (FCM) e PWA instalável com suporte offline.

## Visão Geral

Aplicação full-stack com:

- **Frontend**: React 19 + TanStack Start v1 (SSR) + TanStack Router/Query + Tailwind CSS v4 + shadcn/ui.
- **Backend**: TanStack Server Functions rodando em **Cloudflare Workers** (via Nitro).
- **Banco de Dados**: PostgreSQL no **Supabase próprio** (externo), com RLS ativo em todas as tabelas do schema `public` e papéis em tabela dedicada checados via função `SECURITY DEFINER` (`has_role`, `is_school_admin`).
- **Storage**: bucket público `posts-media` para capas dos posts.
- **Push Notifications**: Firebase Cloud Messaging (FCM v1) com Service Worker dedicado (`/firebase-messaging-sw.js`) e dispatch server-side com prioridade máxima (acorda a tela em Android/iOS mesmo bloqueada).
- **PWA/Offline**: `vite-plugin-pwa` (`generateSW`, Workbox) — `NetworkFirst` para HTML, `CacheFirst` para assets/imagens, página `/offline` como fallback. Coexiste com o SW do FCM.

## Papéis e Fluxo Editorial

Papéis: `leitor`, `professor`, `secretario`, `coordenador`, `diretor`, `admin`, `desenvolvedor`.

Fluxo de publicação: **rascunho → revisão → aprovação → publicado**, com auditoria automática por triggers e notificações em tempo real para o autor quando o post é aprovado ou rejeitado.

## Principais Módulos

- **Blog público** com SEO por rota (título, meta, OG/Twitter), sitemap dinâmico e RSS.
- **Painéis** por papel (professor, coordenador, diretor, secretário, desenvolvedor) com dashboards, aprovação, alertas, arquivos, comentários, LGPD, auditoria, runtime, erros e analytics.
- **Módulo Escolar**: turmas, alunos, responsáveis, professores, comunicados (com dashboard).
- **Agendamentos** com lembretes automáticos via cron endpoint público.
- **Chat/IA** (Gemini) e recursos de RAG para conteúdo educacional.
- **LGPD**: consentimento de cookies, solicitação de dados, uso de imagem, consentimento parental.

## Stack

- React 19, TanStack Start v1, TanStack Router, TanStack Query, TypeScript estrito
- Vite 7, Tailwind CSS v4, shadcn/ui, lucide-react, Zod
- Supabase (Auth, Postgres, Storage, RLS, Realtime)
- Cloudflare Workers (Wrangler, Nitro)
- Firebase Cloud Messaging (Web Push)
- `vite-plugin-pwa` + Workbox

## Rodando Localmente

```bash
bun install
bun run dev
```

App em `http://localhost:5173`. Copie `.env.example` para `.env` e preencha as chaves do seu Supabase e Firebase.

## Deploy (Cloudflare Workers)

```bash
bun install --frozen-lockfile
bun run build
bun run deploy
```

Configure no Cloudflare (via `wrangler secret put` ou painel) os seguintes secrets:

**Supabase**

- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`

**Firebase (FCM v1)**

- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- `FIREBASE_VAPID_PUBLIC_KEY`, `FIREBASE_WEB_API_KEY`

**Outros**

- `DISPATCH_SECRET` — protege `/api/public/dispatch-push`
- `GEMINI_API_KEY` — chat/IA e embeddings
- `VITE_SITE_URL` — necessário se usar domínio próprio (sitemap/RSS)

## Estrutura

```
src/
├── routes/              # Rotas file-based (TanStack Router)
│   └── api/public/      # Endpoints públicos (webhooks, cron, dispatch-push)
├── components/          # UI + composições (escola/, ui/)
├── lib/                 # Hooks, server functions (.functions.ts), utilidades
├── integrations/
│   ├── supabase/        # client (browser), client.server (admin), auth-middleware
│   └── firebase/        # client FCM
└── styles.css           # Tokens do design system (Tailwind v4)

public/
├── firebase-messaging-sw.js  # SW dedicado do FCM
└── manifest.json             # PWA manifest
```

O SW da PWA (`/sw.js`) é gerado pelo Workbox no build; **não** é escrito à mão.

## Segurança

- **RLS** em todas as tabelas do `public`; `GRANT`s explícitos por role.
- **Papéis em tabela dedicada** (`user_roles`) — nunca em `profiles`. Verificação via `has_role` (`SECURITY DEFINER`).
- **PII** (email/telefone de profissionais) exposta apenas para autenticados; a página pública `/agendar` lê da view `profissionais_publico` (sem PII, `security_invoker = true`).
- **Auditoria** automática (`audit_logs`) via triggers.
- **Realtime** restrito a uma allowlist de tabelas.
- **Chaves secretas** (`SERVICE_ROLE_KEY`, `FIREBASE_PRIVATE_KEY`, `DISPATCH_SECRET`, `GEMINI_API_KEY`) usadas somente em server functions/routes; nunca no bundle client.
- **Webhooks/endpoints públicos** sob `/api/public/*` validam assinatura/secret antes de processar.
- Recomendado ativar **Leaked Password Protection** em Supabase → Auth → Providers → Email.

## Push Notifications

- Registro do token FCM via `/api/push/fcm-register`.
- Dispatch server-side em `/api/public/dispatch-push` (autenticado por `DISPATCH_SECRET`), com auto-dispatch por `pg_net` a partir de triggers do banco.
- Payload envia `notification` no topo com prioridade máxima (`PRIORITY_MAX` + `HIGH` no Android; `apns-priority: 10` no iOS) para acordar a tela mesmo bloqueada.
- Detalhes operacionais em [PUSH_SETUP.md](./PUSH_SETUP.md).

## PWA / Offline

- Registro do SW só em produção HTTPS; ignorado em previews, iframes e com `?sw=off`.
- Atualizações silenciosas com toast de "recarregar" quando novo SW instala.
- Estratégias Workbox: `NetworkFirst` (HTML, timeout 5s) e `CacheFirst` (JS/CSS/fontes/imagens).
- Página `/offline` pré-cacheada como fallback de navegação.
- O SW do FCM (`/firebase-messaging-sw.js`) fica fora do precache e continua funcionando em paralelo.

## Scripts

| Comando           | Descrição                                   |
| ----------------- | ------------------------------------------- |
| `bun run dev`     | Vite dev server                             |
| `bun run build`   | Build de produção (SSR + client + SW)       |
| `bun run preview` | Preview local do build                      |
| `bun run deploy`  | Build + `wrangler deploy` (Cloudflare)      |
| `bun run test`    | Vitest (unit + component + integração leve) |
| `bun run lint`    | ESLint                                      |
| `bun run format`  | Prettier                                    |

## Testes

Suíte com Vitest + Testing Library cobrindo:

- Componentes (`PainelLayout`, `SiteFooter`)
- Fluxos (`flows`, `permissions`, `parental-consent`, `sanitize`)
- RLS de `profissionais` e realtime (`profissionais-rls`, `test-realtime-rls`)
- Endpoint público de dispatch (`dispatch-push`)

## Módulos Recentes (destaques)

- **Boletim Escolar Oficial (SEMED Assunção do Piauí)** — 10 disciplinas × 11 avaliações (AQ · AE · REC · PF), média e resultado calculados automaticamente, validação 0–10 em tempo real, exportação `.docx` em landscape.
- **Importação de boletins por PDF** — server function com Gemini 2.0 Flash extrai notas + metadados do aluno (INEP, sexo, filiação), match automático por nome, revisão manual antes de aplicar, storage opcional em bucket privado.
- **Painel do Responsável** com 11 recursos (boletim PDF, frequência, autorizações digitais, justificativa de faltas, chat com coordenação, alertas personalizados, multi-filhos).
- **Painel de Manutenção** — backup semanal `pg_cron` + monitor de egress + compressão retroativa WebP.
- **Auditoria administrativa** — `admin_access_logs` + gating dinâmico da sidebar por role.
- **Patrocinadores** com CRUD, drag-and-drop, rascunho/ao vivo, tracking.

## Status

Sistema **APROVADO PARA PRODUÇÃO** — Nota **9.7/10** (Prompt Mestre 2 v2 · 24/07/2026).

- **Riscos abertos:** 0 críticos · 0 altos · 1 médio (Leaked Password Protection pendente no Supabase) · 2 baixos.
- **Métricas:** 395 arquivos TS/TSX · 121 rotas · 170 migrações · 62 deps runtime / 25 dev · 152+ testes verdes.
- **Higiene:** typecheck 0 erros · 0 `console.log` em `src/` · 0 uso de `any`/`as any`.
- **Design system:** paleta **Navy Trust** consolidada + cantos quadrados globais (Tito preservado, invariante testada).
- **Últimos avanços (v2):** limpeza de dead-code (26 arquivos + 15 deps · –18 shadcn não usados) · Modo Apresentação com slides · Central LGPD unificada · CSP com `frame-src` YouTube/Vimeo · fila de concorrência no chat IA (>5 usuários → 429).
- Deploy Cloudflare estável com `bun@1.2.15`. Turnstile v2 ativo (com fallback runtime). Notificações FCM funcionais em Android 13/16+ e iOS (tela bloqueada). Alertas Globais v2 com rajadas agendadas (`pg_cron`). PWA/TWA com ícone circular "UEECM". Chat IA em **Gemini 2.0 Flash**.

## Relatórios Técnicos

Todos os relatórios de auditoria ficam versionados em [`docs/relatorios/`](./docs/relatorios/).

- **Relatório atual (v2):** [Análise Técnica — Prompt Mestre 2 v2 — 24/07/2026](./docs/relatorios/Analise_Tecnica_PromptMestre2_v2.md)
- **Relatório anterior (v1):** [Análise Técnica — Prompt Mestre 2 v1 — 22/07/2026](./docs/relatorios/Analise_Tecnica_PromptMestre2_v1.md)
- **Relatório consolidado histórico:** [Análise Técnica Completa v14 — 22/07/2026](./docs/relatorios/Analise_Tecnica_Completa_2026-07-22-v14-Final.md)
- **Apresentação do sistema:** [Apresentação Executiva (PPTX · 44 slides)](./docs/relatorios/Apresentacao_Sistema_UEECM_v3.pptx)
- **Veredito atual:** ✅ APROVADO PARA PRODUÇÃO
- **Framework aplicado:** Prompt Mestre 2 — Análise Técnica Completa (Código · Segurança · Validação Final)

## Roadmap Concluído (Consolidado)

- ✅ RLS 100% + column-level security em `profissionais` (PII protegida).
- ✅ Views `enquete_resultados` e `profissionais_publicos` com `security_invoker=true`.
- ✅ Revogação de EXECUTE público em 23 funções `SECURITY DEFINER` sensíveis.
- ✅ Storage `galeria-eventos` restrito a galerias publicadas.
- ✅ Rate-limit de 3 camadas em `/api/chat` (Gemini).
- ✅ CSP + HSTS + headers de segurança em `src/server.ts` (inclui domínios Turnstile).
- ✅ Turnstile v2 com fallback runtime via `/api/public/turnstile-config`.
- ✅ HMAC/timing-safe em endpoints públicos (backup semanal, dispatch, webhooks).
- ✅ Trigger `enqueue_due_alert_pushes` corrigido (grace de 10 min, sem coluna fantasma).
- ✅ Push FCM com tags únicas + `renotify:true` (compatível Android 16).
- ✅ Reatach de token FCM ao `user_id` no login (`reattachPushTokenToUser`).
- ✅ Documentação LGPD: `docs/DPIA-ROPA.md` + `docs/RUNBOOK.md`.
- ✅ CI/CD com gate de Typecheck no PR.
- ✅ **Unir Escola & Comunidade**: Diário de Bordo, Radar do Filho, Méritos & Ocorrências, Alerta de Evasão, Contrato Digital, Selo de Presença Parental, Mural da Comunidade, Comunicados com Confirmação, Chat Pai↔Professor moderado, Rede de Apoio + Vaquinha Digital.
- ✅ **Acadêmico**: Atividades e Trabalhos (professor divulga por turma, marca Fez/Não fez; pai acompanha; ranking com drill-down + export CSV/PDF), Planejamentos Pedagógicos (semanal/quinzenal/mensal/semestral) assistidos por Gemini.
- ✅ **Agendamentos**: segmentação por role/usuário no push + consulta pública por protocolo em `/consultar-agendamento`.
- ✅ **Design System**: paleta **Navy Trust** (`#0f1b3d · #1e3a5f · #3b6fa0 · #e8edf3`), cantos **quadrados globais** (exceção do Tito), invariantes visuais garantidas por teste (`src/test/theme-invariants.test.ts`). Redução drástica de gradientes/bordas/rings na Home, Team, Testimonials, PushInline, CtaDuo.
- ✅ **Observabilidade**: Sentry (browser) + `system_errors` + FinOps dashboard (`/painel-finops`).
- ✅ **Segurança**: `xlsx` substituído por `exceljs` (CVE Prototype Pollution); SBOM CycloneDX no CI; CSV Injection sanitizada; mocks removidos de produção.
- ✅ **Modo Apresentação & Modo TV**: gerenciador de slides em `/painel-apresentacoes`, player em `/apresentar/$id`, atalho fullscreen no painel; dashboard TV público em `/tv`.
- ✅ **Central LGPD unificada** em `/central-lgpd` (Solicitação de dados + Segurança/Incidentes + Uso de imagem) — DPO Francisco Douglas (Art. 41).
- ✅ **Limpeza v2 (24/07/2026)**: –26 arquivos órfãos · –18 componentes shadcn não usados · –15 dependências não usadas. Typecheck permanece verde.
- 🟡 Pendente (Dashboard): **Enable Leaked Password Protection** em Supabase Auth.

---

Desenvolvido por **Francisco Douglas** · [github.com/Francisco-Douglas-dev](https://github.com/Francisco-Douglas-dev)
