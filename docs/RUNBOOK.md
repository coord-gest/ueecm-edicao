# Runbook de Incidentes — Conecta UEECM

Documento operacional. Mantido pelo DPO/administrador do sistema.
Última revisão: {{ATUALIZAR-NA-EDIÇÃO}}

## 0. Contatos

| Papel                  | Nome        | Contato                                           |
| ---------------------- | ----------- | ------------------------------------------------- |
| DPO / Encarregado LGPD | _preencher_ | dpo@conectaueecm.com                              |
| Administrador técnico  | _preencher_ | _preencher_                                       |
| Suporte Supabase       | —           | https://supabase.com/dashboard/support            |
| Suporte Cloudflare     | —           | https://dash.cloudflare.com/?to=/:account/support |
| Suporte Lovable        | —           | https://lovable.dev                               |

## 1. Severidades

| Sev   | Definição                                                                 | Resposta                                                        |
| ----- | ------------------------------------------------------------------------- | --------------------------------------------------------------- |
| SEV-1 | Vazamento de dados, indisponibilidade > 30 min, dados de menores expostos | Acionar DPO em ≤ 15 min. Comunicar ANPD em ≤ 72h se confirmado. |
| SEV-2 | Feature crítica quebrada (login, chat, push)                              | Fix em ≤ 4h úteis.                                              |
| SEV-3 | Degradação parcial, workaround disponível                                 | Fix na próxima janela.                                          |

## 2. Rotação de chaves

### 2.1 `LOVABLE_API_KEY`

Ferramenta: `lovable_api_key--rotate_lovable_api_key`. Redeploy do Worker é automático.

### 2.2 Chaves Supabase (`SERVICE_ROLE_KEY`, `anon`)

1. Dashboard Supabase → Project Settings → API → **Reset service_role key**.
2. Atualizar `SERVICE_ROLE_KEY` via Lovable secrets (`update_secret`).
3. Se `anon` for rotacionada: atualizar `VITE_SUPABASE_PUBLISHABLE_KEY` no `.env` do projeto.
4. Redeploy.

### 2.3 `DISPATCH_SECRET` (cron/HMAC dos endpoints `/api/public/*`)

1. Gerar novo valor: `openssl rand -hex 32`.
2. Atualizar em Lovable secrets.
3. Atualizar em **todos** os schedulers (pg_cron `cron.job` que apontam para `/api/public/*`).
4. Redeploy.

### 2.4 `TURNSTILE_SECRET_KEY` / `VITE_TURNSTILE_SITE_KEY`

1. Cloudflare Dashboard → Turnstile → widget → **Rotate**.
2. Copiar Site Key → `.env` (`VITE_TURNSTILE_SITE_KEY`).
3. Copiar Secret Key → `update_secret TURNSTILE_SECRET_KEY`.
4. Redeploy.

### 2.5 Firebase (`FIREBASE_*`, `FIREBASE_VAPID_PUBLIC_KEY`)

1. Firebase Console → Project Settings → Service Accounts → **Generate new private key**.
2. Atualizar `FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY` via secrets.
3. Redeploy.
4. Tokens FCM dos usuários continuam válidos.

### 2.6 `GEMINI_API_KEY`

1. Google AI Studio → **Regenerate key**.
2. `update_secret GEMINI_API_KEY`.
3. Redeploy.

## 3. Restore de backup

Backups: Supabase Point-in-Time Recovery (PITR) — retenção conforme plano.

### 3.1 Restore completo

1. Dashboard Supabase → Database → **Backups** → escolher timestamp.
2. Clonar em novo projeto para validar antes de sobrescrever produção.
3. Após validação, promover ou executar `pg_dump`/`pg_restore` seletivo.
4. Comunicar usuários (banner in-app + email).

### 3.2 Restore de tabela única

```sql
-- No projeto de backup clonado
COPY public.tabela TO '/tmp/tabela.csv' CSV HEADER;
-- Na produção
CREATE TABLE public.tabela_restore (LIKE public.tabela);
COPY public.tabela_restore FROM '/tmp/tabela.csv' CSV HEADER;
-- Merge manual após auditoria
```

### 3.3 Storage

Buckets Supabase têm versionamento por objeto quando ativado. Restaurar via API:
`storage.from('bucket').download(path, { version: '<id>' })`.

## 4. Playbook de vazamento de dados

1. **T+0** Isolar: revogar service_role, desativar endpoint suspeito, bloquear IPs se aplicável.
2. **T+15min** DPO acionado. Snapshot de logs (`system_errors`, `audit_logs`, Cloudflare Access logs).
3. **T+1h** Escopo do vazamento — quantos titulares, quais categorias, se envolve menores.
4. **T+24h** Draft de comunicação (ANPD + titulares).
5. **T+72h** Notificação formal ANPD conforme LGPD Art. 48.
6. **T+7d** Relatório pós-incidente + ações corretivas.

## 5. Endpoints críticos e sua verificação

| Endpoint                     | Verificação rápida                                        |
| ---------------------------- | --------------------------------------------------------- |
| `/api/chat`                  | `curl -X POST .../api/chat -d '{"message":"ping"}'` → 200 |
| `/api/public/dispatch-push`  | Requer `x-dispatch-secret`; sem header deve retornar 401  |
| `/api/public/backup-semanal` | idem 401 sem HMAC                                         |
| Login `/auth`                | Página carrega, Turnstile renderiza                       |

## 6. Monitoramento

- Tabela `system_errors` — dashboard em `/painel-erros`.
- Cloudflare Analytics — 5xx e latência do Worker.
- Supabase Dashboard → Reports → API/Auth.
- FCM Diagnostics: `/painel-desenvolvedor` → tab FCM.

## 7. Checklists

### Rotina mensal

- [ ] Revisar `system_errors` últimos 30 dias
- [ ] Rodar `security--run_security_scan`
- [ ] Rodar `bun run audit:a11y`
- [ ] Conferir tokens FCM inativos (limpeza)
- [ ] Revisar `data_subject_requests` pendentes (LGPD Art. 19 — 15 dias)

### Rotina trimestral

- [ ] Rotação preventiva de `DISPATCH_SECRET`
- [ ] Revisão de policies RLS
- [ ] Revisão de acessos administrativos (`user_roles`)
- [ ] Teste de restore de backup em ambiente de staging
- [ ] Atualização do DPIA/ROPA
