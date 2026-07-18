# Checklist de Release para Produção — UEECM

> Rode este checklist **antes de cada deploy** para produção. Marque cada
> item; um único item aberto na seção "Bloqueadores" impede o release.

Data do release: `____/____/______` — Responsável: `______________`

---

## 1. Bloqueadores (obrigatórios)

- [ ] `bun run build` executou sem erros
- [ ] `bunx vitest run` — todas as suítes passando
- [ ] `bunx tsgo --noEmit` — sem erros de tipos
- [ ] Migrações Supabase aplicadas em produção (`supabase db push` ou via console)
- [ ] Secrets de runtime presentes (validar em `/painel-runtime`):
  - [ ] `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
  - [ ] `FIREBASE_VAPID_PUBLIC_KEY`, `FIREBASE_WEB_API_KEY`
  - [ ] `DISPATCH_SECRET`, `GEMINI_API_KEY`
- [ ] `deploy-worker.yml` gated em `ci-gate` (nenhum push sem CI verde)

## 2. Segurança

- [ ] Linter Supabase rodado — nenhum `error` novo
- [ ] RLS ativa em toda tabela `public.*` criada nesta release
- [ ] Nenhuma função `SECURITY DEFINER` com `EXECUTE` para `anon`/`authenticated`
      sem justificativa documentada em `docs/relatorios/`
- [ ] Endpoints `/api/public/*` sensíveis (dispatch, cron) validam
      `Authorization` via `timingSafeEqualStr`
- [ ] Nenhum `service_role_key` referenciado em código de cliente
      (`rg -n "SERVICE_ROLE" src/ | rg -v ".server.ts"`)
- [ ] "Leaked Password Protection" habilitado no Supabase Auth

## 3. Push / FCM

- [ ] `/painel-runtime` → "Verificar variáveis" tudo verde
- [ ] `/painel-runtime` → "Disparar dispatcher agora" retorna sucesso
- [ ] Telemetria em `fcm_dispatch_logs` mostra entradas recentes com `ok=true`
- [ ] Push de teste chega em: (a) PWA desktop, (b) PWA Android instalado,
      (c) APK TWA com tela bloqueada
- [ ] E2E `tests/e2e/fcm-dispatch-flow.spec.ts` passou na última execução

## 4. UX / Responsividade

- [ ] Rotas críticas checadas em 375px, 768px, 1440px:
      `/`, `/painel`, `/escola/agendamentos`, `/instalar`, `/painel-runtime`
- [ ] Sem overflow horizontal em mobile
- [ ] Botão de instalar APP visível no rodapé

## 5. Observabilidade pós-deploy (primeiras 24h)

- [ ] `system_errors` sem entradas `critical` novas
- [ ] `fcm_dispatch_logs` sem `ok=false` recorrente
- [ ] Analytics em `/painel-analytics` mostrando tráfego normal
- [ ] Nenhum alerta em Sentry / Cloudflare Workers dashboard

---

**Aprovação final:** ______________________ Data: ****/****/______
