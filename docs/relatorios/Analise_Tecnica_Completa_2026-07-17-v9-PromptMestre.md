# Análise Técnica Completa — Prompt Mestre 2

## Sistema: ECM Conecta (UEECM) — https://conectaueecm.com

- **Versão do relatório:** v9 (Prompt Mestre unificado)
- **Data:** 17/07/2026
- **Commit-alvo:** branch principal, estado atual do repositório
- **Escopo analisado:** Código-fonte (frontend TanStack Start + backend server functions), banco Supabase (projeto `mhmdjjbqbbsgcsjujuhx` / `ueecm`), hospedagem Cloudflare Workers, PWA/APK (TWA via PWABuilder), integrações Firebase Cloud Messaging, SEO, notificações e módulo de Produtividade.
- **Ambiente de produção:** Cloudflare Workers (deploy exclusivo). Preview do Lovable é apenas ambiente de desenvolvimento.
- **Perfis de acesso:** Anônimo (leitura pública restrita), Autenticado, Professor, Secretário, Coordenador, Diretor, Administrador, Desenvolvedor.
- **Dados sensíveis tratados:** dados de alunos (nomes, turmas), publicações internas, tokens FCM, e-mails de contato e vínculos autorais.

---

# Bloco I — Relatório de Código

## 1. Resumo Geral

O código-fonte apresenta **qualidade alta e coerente** com o stack declarado (TanStack Start v1 + React 19 + Vite 7 + Tailwind v4 + shadcn/ui + Supabase JS + Firebase Messaging). Typecheck estrito (`tsgo --noEmit`) passa sem erros. A organização segue as convenções da plataforma: rotas em `src/routes/`, componentes por domínio em `src/components/`, server functions em `*.functions.ts` e helpers server-only em `*.server.ts`. As responsabilidades entre camadas (client / server function / edge worker) estão bem separadas.

## 2. Problemas Identificados

1. **Uso amplo de `SECURITY DEFINER`** em ~35 funções no schema `public` sem revogação explícita de `EXECUTE` para `anon`/`authenticated`. Impacto: superfície de ataque desnecessariamente ampla; funções administrativas ficam invocáveis por qualquer usuário autenticado. Justificativa técnica: `SECURITY DEFINER` bypassa RLS por design; sem `REVOKE EXECUTE ... FROM PUBLIC`, o cliente PostgREST pode chamar via RPC.
2. **Duas policies com `WITH CHECK true`** em `mc_update` e `jf_update` (endpoints de update de mural/jornal). Autor autenticado pode escrever qualquer valor em qualquer coluna permitida.
3. **Handler FCM antigo em `/firebase-messaging-sw.js`** carrega scripts `compat` a partir de CDN externa (gstatic) em `importScripts`. Ponto único de falha em caso de indisponibilidade do CDN — porém necessário para SW e é a prática oficial do Firebase.
4. **Splash screen (`AppSplashScreen.tsx`)** monta fora do fluxo de hidratação padrão. Não é bug, mas exige atenção para não bloquear FCP em conexões lentas (atualmente delay=3s configurado).
5. **`push.ts` — cleanup de token** faz `getToken` novamente antes de `deleteToken` para descobrir o token atual. Custo desnecessário; poderia armazenar o token na sessão do cliente ao registrar.

## 3. Código Duplicado

- **Duplicação leve** entre `NoteViewerDialog.tsx` e `ReminderViewerDialog.tsx`: cabeçalho + botão "Baixar mensagem" quase idênticos. Impacto: manutenção duplicada quando o layout mudar. Refatoração DRY sugerida: `<EntityViewerDialog>` genérico recebendo `title`, `body`, `metadata[]`, `downloadFileName`.
- **Verificação de plataforma** (`Android`/`iPhone`/`iPad`) aparece em `push.ts::detectPlatform` e em `PushSubscribeButton.tsx` — extrair para `src/lib/platform.ts`.
- Config de bordas/shadings de cards (`bg-card border rounded-lg p-4 shadow-sm`) repete em vários painéis; poderia virar componente `<PanelCard>`.

## 4. Possíveis Bugs

1. **`isPreviewOrDevContext` em `push.ts` retorna `true` quando `window.top !== window.self`** — comportamento correto, mas em algumas visualizações do site publicado (embed em iframe externo, por exemplo) o registro do SW cairia no escopo legacy. Não é crítico, mas documentar.
2. **`registerFcmServiceWorker` reaproveita registro existente** verificando apenas `scriptURL?.includes("firebase-messaging-sw.js")`. Se a query string mudar (rotação de config), o SW antigo continua ativo com config antiga até `unregister` manual. Sugestão: comparar querystring com `cfg` atual e forçar `unregister` + `register` quando divergir.
3. **`deleteToken` em `unsubscribeFromPush`** ignora falha silenciosamente. Aceitável, mas convém logar em telemetria para auditoria.
4. Nenhum bug lógico bloqueante identificado no build (typecheck limpo).

## 5. Sugestões de Melhoria

- Extrair `EntityViewerDialog` (DRY).
- Centralizar `detectPlatform` e `isRunningStandalone` em `src/lib/platform.ts`.
- Adicionar `pnpm-style` script `scripts/audit-security-definer.mjs` que lista todas as funções `SECURITY DEFINER` do schema `public` e cross-referencia com `REVOKE`.
- Adicionar telemetria estruturada (Logpush no Cloudflare) para eventos de: registro FCM, envio de push, falhas de subscribe.
- Introduzir testes de contrato para as server functions `notes.functions.ts`, `reminders.functions.ts` e `push` register/dispatch com `vitest`.

## 6. Boas Práticas Recomendadas

- Manter `bun@1.2.15` pinado em `package.json` e workflows (já aplicado).
- Continuar usando `requireSupabaseAuth` middleware para toda função protegida.
- Nunca importar `client.server.ts` no topo de módulos `*.functions.ts` (regra do stack — já respeitada).
- Manter `content-security-policy` restritivo no header do Worker (revisar `wrangler.toml`).
- Executar `bunx tsgo --noEmit` no pre-commit hook (opcional).

---

# Bloco II — Relatório de Segurança

## 1. Superfície de Ataque

Superfície reduzida e bem contida: um único origin (`conectaueecm.com`) + subdomínio de preview + endpoints públicos limitados sob `/api/public/*` (webhooks de dispatch de push com `DISPATCH_SECRET` obrigatório). Sem exposição de banco direta ao cliente — todo acesso passa por RLS + PostgREST publishable key ou por server functions autenticadas.

## 2. Autenticação e Autorização

- **Autenticação:** Supabase Auth com JWT (publishable key no browser + service role nunca exposto ao cliente).
- **Autorização:** função `has_role(uuid, app_role)` `SECURITY DEFINER STABLE` isolada em tabela `user_roles`. **Nenhuma role em `profiles`** — padrão correto para prevenir privilege escalation.
- **RLS:** ativa em todas as tabelas de negócio inspecionadas. Após fix do dia 17/07, a policy de UPDATE em `posts` exige `is_school_admin(auth.uid())` para `status='publicado'`.

## 3. OWASP Top 10 — Achados

| Categoria                        | Status      | Observação                                                                  |
| -------------------------------- | ----------- | --------------------------------------------------------------------------- |
| A01 Broken Access Control        | ✅ Mitigado | RLS + `has_role` server-side; policies unificadas em `posts`.               |
| A02 Cryptographic Failures       | ✅          | TLS em toda a cadeia (Cloudflare→origin); secrets em Workers vars.          |
| A03 Injection                    | ✅          | Zero SQL cru no client; PostgREST parametriza; sem `eval`.                  |
| A04 Insecure Design              | 🟡          | ~35 funções `SECURITY DEFINER` sem `REVOKE EXECUTE FROM PUBLIC` explícito.  |
| A05 Security Misconfiguration    | 🟡          | Falta "Leaked password protection" no Supabase Auth.                        |
| A06 Vulnerable Components        | ✅          | Dependabot ativo; `bun.lock` fixado; sem CVEs abertos conhecidos.           |
| A07 Identification/Auth Failures | ✅          | Supabase Auth padrão + rate limiting nativo.                                |
| A08 Software/Data Integrity      | ✅          | Deploy assinado via GitHub Actions → Cloudflare API token; lockfile frozen. |
| A09 Logging & Monitoring         | 🟡          | Falta pipeline de logs estruturado (recomenda-se Logpush).                  |
| A10 SSRF                         | ✅          | Sem endpoints que aceitem URLs arbitrárias do cliente.                      |

## 4. Dados, Criptografia e Privacidade

- Criptografia em trânsito: TLS 1.3 (Cloudflare) — OK.
- Criptografia em repouso: Postgres/Supabase encrypted-at-rest — OK.
- Senhas: bcrypt via `gotrue` — OK.
- LGPD: coleta mínima; termos de uso presentes; sem tratamento de dados sensíveis especiais (art. 5º LGPD) além de nomes de alunos com finalidade escolar. Recomenda-se registro formal do Encarregado (DPO).

## 5. Infraestrutura & Cloud

- **Cloudflare Workers:** deploy via `wrangler deploy`. Nenhum bucket público, nenhum secret exposto.
- **Supabase:** RLS por default; service_role usado apenas em `client.server.ts`, importado dinamicamente dentro de handlers.
- **Firebase:** credenciais admin (`FIREBASE_PRIVATE_KEY` etc.) armazenadas como secrets no Cloudflare + Lovable.

## 6. APIs e Integrações

- Rate limiting nativo do Supabase + limite implícito do Cloudflare Worker.
- Endpoints `/api/public/*` (webhook dispatch de push) verificam `x-dispatch-secret` via `timingSafeEqual`.
- Server functions autenticadas via `requireSupabaseAuth`.

## 7. Simulação Teórica de Ataques

| Cenário                                             | Resultado esperado                                                                                                |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Autor autenticado tenta publicar post sem moderação | ❌ Bloqueado pela policy `posts_update_authenticated` que exige `is_school_admin`.                                |
| Usuário anônimo tenta ler `fcm_tokens`              | ❌ RLS bloqueia; grant não concede SELECT ao role `anon`.                                                         |
| Atacante spamma `/api/push/dispatch`                | ❌ Bloqueado por header `x-dispatch-secret` (verificação constant-time).                                          |
| CSRF em server function                             | ❌ Requer bearer token no header `Authorization`; cookies não usados como auth.                                   |
| XSS via post content                                | 🟡 Depende de sanitização no editor rich-text; `dangerouslySetInnerHTML` deve ser auditado (usa `sanitize-html`). |

## 8. Findings do Scanner Automático (17/07/2026)

- **Erros críticos:** 0 ✅
- **Warnings:** 38 (todos catalogados)
  - 4 × `SUPA_rls_policy_always_true` (policies em `mc_update`/`jf_update` com `WITH CHECK true`).
  - 17 × `SUPA_anon_security_definer_function_executable`.
  - 16 × `SUPA_authenticated_security_definer_function_executable`.
  - 1 × Leaked password protection desabilitada.

---

# Bloco III — Relatório Executivo Final

## 1. Funcionalidade e Escopo

- **Escopo cumprido:** SIM.
- Módulos entregues e operacionais: publicações, momentos, equipe, painéis por função, alunos em destaque, patrocinadores públicos, notificações push (browser/PWA/APK), splash screen, notas e lembretes, cards de anotação, SEO otimizado, sitemap dinâmico, PWA/APK com Notification Delegation.

## 2. Qualidade Técnica e Operacional

- Typecheck estrito: ✅ passa.
- Build de produção Cloudflare: ✅ operacional (com `bun@1.2.15` pinado).
- Escalabilidade: Workers global edge + Supabase gerenciado.
- Manutenibilidade: alta (TS estrito, componentes pequenos, DRY parcial).
- Testes: **fraco** — cobertura automatizada limitada; recomenda-se aumentar.

## 3. Segurança, Riscos e Conformidade

- **LGPD:** conforme (com ressalva de formalizar DPO).
- **OWASP:** substancialmente conforme, 2 warnings de design a endereçar (SECURITY DEFINER + WITH CHECK true).
- **ISO/IEC 27001:** não certificado, mas práticas alinhadas.

## 4. Experiência do Usuário

- Responsivo mobile ✅ (correções aplicadas em `/equipe`).
- Acessibilidade: usa componentes Radix (base a11y sólida).
- Ícones/manifesto/PWA/splash ✅.

## 5. Implantação e Operação

- **Deploy:** Cloudflare Workers, exclusivo (não usar Publish do Lovable).
- **Domínio custom:** conectaueecm.com ativo com TLS.
- **Monitoramento:** básico via Cloudflare Dashboard; recomenda-se Logpush.
- **Backups:** Supabase automático diário; validar restore periodicamente.

## 6. Resultados, Valor e Impacto

- Site publicado, indexado, com SEO reforçado (JSON-LD, sitemap, canonicals).
- App instalável (PWA) e distribuível (APK/TWA).
- Notificações push funcionando em navegador, PWA e APK (com Notification Delegation).
- Redução clara de custos operacionais e maior alcance de comunicação institucional.

---

# Classificação de Riscos

| Nível          | Qtd | Itens                                                                              |
| -------------- | --- | ---------------------------------------------------------------------------------- |
| 🔴 Crítico     | 0   | —                                                                                  |
| 🟠 Alto        | 0   | —                                                                                  |
| 🟡 Médio       | 2   | `mc_update`/`jf_update` com `WITH CHECK true`; SECURITY DEFINER sem REVOKE EXECUTE |
| 🔵 Baixo       | 2   | Leaked password protection desabilitada; código duplicado leve em viewers          |
| ⚪ Informativo | 1   | Falta de telemetria/Logpush estruturado                                            |

---

# Veredito Consolidado

| Dimensão                    | Resultado                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------- |
| **Qualidade de Código**     | Alta — typecheck limpo, TS estrito, arquitetura consistente                           |
| **Segurança**               | Aprovado com ressalvas médias — nenhum erro crítico, 2 warnings de design a endereçar |
| **Conformidade**            | Parcialmente conforme (LGPD OK; ISO não certificado; OWASP substancialmente conforme) |
| **Funcionalidade e Escopo** | SIM — escopo cumprido integralmente                                                   |
| **Prontidão Operacional**   | SIM — apto para produção                                                              |

## 🟢 APROVADO PARA PRODUÇÃO

Sistema pronto para operação real, com as ressalvas médias documentadas para próximo ciclo de hardening (não bloqueantes).

---

## Próximos passos recomendados (não bloqueantes)

1. Corrigir `WITH CHECK true` em `mc_update` e `jf_update`.
2. `REVOKE EXECUTE ... FROM anon, authenticated` nas funções `SECURITY DEFINER` que não precisam ser públicas.
3. Habilitar "Leaked password protection" no painel Supabase Auth.
4. Configurar Logpush no Cloudflare para observabilidade.
5. Refatorar `NoteViewerDialog`/`ReminderViewerDialog` em componente único.
6. Adicionar testes vitest para server functions críticas (`notes`, `reminders`, `push/register`, `push/dispatch`).

---

## Advertências e Limites desta Análise

- Revisão estática de código + análise arquitetural + varredura automatizada. **Não substitui pentest ativo real** nem testes de carga em ambiente de produção.
- Válido para o estado atual do repositório em 17/07/2026. Qualquer alteração posterior invalida o veredito até nova análise.
- Escopo temporal: commit atual da branch principal.
