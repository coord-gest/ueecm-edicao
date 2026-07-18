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

Sistema **APROVADO PARA PRODUÇÃO**. Última análise técnica consolidada: **17/07/2026 (v7 — Final)** — **0 críticos · 0 altos · 1 médio · 2 baixos**. Testes: **138/139 passando** (1 cosmética). Typecheck: **0 erros**. Deploy Cloudflare estável com `bun@1.2.15`. PWA/TWA com ícone do app em notificações. SEO com sitemap dinâmico + JSON-LD (WebSite, NewsArticle, BreadcrumbList, AboutPage, CollectionPage).

## Relatórios Técnicos

Todos os relatórios de auditoria ficam versionados em [`docs/relatorios/`](./docs/relatorios/).

- **Relatório atual:** [Análise Técnica Completa — 17/07/2026 (Markdown)](./docs/relatorios/Analise_Tecnica_Completa_2026-07-17.md) · [DOCX](./docs/relatorios/Analise_Tecnica_Completa_2026-07-17.docx) · [PDF](./docs/relatorios/Analise_Tecnica_Completa_2026-07-17.pdf)
- **Apresentação do sistema:** [Apresentação Completa (PPTX · 14 slides)](./docs/relatorios/Apresentacao_Sistema_UEECM.pptx)
- **Veredito atual:** ✅ APROVADO PARA PRODUÇÃO
- **Framework aplicado:** Prompt Mestre v2 — Análise Técnica Completa (Código · Segurança · SEO · PWA · Validação Final)

---

Desenvolvido por **Francisco Douglas** · [github.com/Francisco-Douglas-dev](https://github.com/Francisco-Douglas-dev)
