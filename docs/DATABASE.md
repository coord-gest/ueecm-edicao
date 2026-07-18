# Schema Supabase Externo — UEECM

Este documento descreve o estado do banco Supabase externo utilizado pelo projeto. O banco vive fora do Lovable (setup Cloudflare + Supabase próprio) e **não há migrations versionadas no repositório** — este arquivo é a fonte de verdade estrutural.

> ⚠️ **Ao rodar `ALTER`, `CREATE` ou `DROP` no Supabase, atualize este documento.**

---

## Tabelas principais (schema `public`)

### Agendamentos e consentimento LGPD

- **`agendamentos`** — agendamentos de atendimento com responsáveis. Trigger de rate-limit por IP. Coluna `protocolo` (UUID/texto único) é a âncora usada pelo consentimento parental.
- **`parental_consents`** — registro auditável de consentimento parental (Art. 14 LGPD). INSERT apenas via `service_role`. Contém `protocolo`, `minor_name`, `minor_dob`, `guardian_name`, `guardian_cpf` (opcional), `guardian_email`, `guardian_phone`, `term_version`, `ip_address`, `user_agent`, `created_at`.
  - **Índice único:** `parental_consents_protocolo_unique_idx` em `(protocolo)` — evita duplicidade quando o cliente reenviar o form.

### Autenticação e papéis

- **`user_roles`** — mapeia `user_id → role` (enum `app_role`: `admin`, `moderator`, `professor`, `user`, etc.). Lida via `has_role(_user_id, _role)` (SECURITY DEFINER). Nunca armazenar `role` no `profiles`.
- **`profiles`** — dados públicos do usuário, sem informação de permissão.

### Escola

- **`turmas`, `alunos`, `matriculas`, `boletins`, `notas_bimestrais`** — modelo acadêmico.
- **`disciplinas`, `professores`, `profissionais`** — corpo docente e áreas.
- **`comunicados`, `comunicados_agendados`, `comunicados_leituras`** — comunicação com famílias.

### Push / FCM

- **`push_notifications_queue`** — fila enfileirada por triggers (`tg_push_queue_dispatch`). Colunas: `id`, `title`, `body`, `url`, `attempts`, `processed_at`, `created_at`.
- **`fcm_tokens`** — tokens FCM por usuário. Removidos automaticamente quando FCM retorna `UNREGISTERED`/`INVALID_ARGUMENT`.

### Arquivos e Drive

- **`arquivo_templates`, `arquivo_preenchimentos`** — templates DOCX e preenchimentos por família.
- **`drive_files`, `drive_folders`** — cache de metadados do Google Drive.
- **`momentos`, `momentos_fotos`** — galeria pública ancorada em fotos no Drive.

### Outros

- **`familias_depoimentos`, `alunos_destaque`** — conteúdos da home. Leitura pública via RLS `TO anon`.
- **`system_errors`** — captura server-side de erros críticos.
- **`app_analytics`** — eventos anônimos.

---

## Schema `private`

Schema fechado — só `postgres`/superuser lê/escreve. Usado por funções `SECURITY DEFINER`.

### `private.app_secrets`

```sql
CREATE TABLE private.app_secrets (
  key   text PRIMARY KEY,
  value text NOT NULL
);
```

Contém segredos usados pelas funções agendadas do `pg_cron`, incluindo:

| key               | uso                                                                 |
| ----------------- | ------------------------------------------------------------------- |
| `dispatch_secret` | Bearer token para chamar `/api/public/dispatch-push` do Worker (S2) |
| `worker_url`      | URL base do Cloudflare Worker (`https://<seu-worker>.workers.dev`)  |

**Rotação:** trocar valor aqui + no secret `DISPATCH_SECRET` do Lovable + no secret do Cloudflare Worker, e redeployar o Worker.

---

## Cron jobs (`cron.job`)

Configurados via `pg_cron` + `pg_net` no Supabase. Todos os HTTP jobs autenticam com `Authorization: Bearer <private.app_secrets.dispatch_secret>`.

| jobid | schedule      | função                     | descrição                                                            |
| ----- | ------------- | -------------------------- | -------------------------------------------------------------------- |
| —     | `*/1 * * * *` | `agendamentos-lembretes`   | Notifica agendamentos próximos                                       |
| —     | `*/1 * * * *` | `comunicados-lembretes`    | Reenvia comunicados não lidos                                        |
| —     | `*/5 * * * *` | `comunicados-agendados`    | Publica comunicados no horário agendado                              |
| —     | `*/1 * * * *` | `enqueue_due_alert_pushes` | Interno (SQL puro) — enfileira alertas em `push_notifications_queue` |
| —     | `0 3 * * 0`   | `backup-semanal`           | Backup semanal para Google Drive                                     |

Consulte o valor real com:

```sql
SELECT jobid, schedule, jobname, command FROM cron.job ORDER BY jobid;
```

---

## Políticas RLS relevantes

- **`parental_consents`** — nenhuma policy de INSERT/SELECT para `anon`/`authenticated`. Apenas `service_role`.
- **`user_roles`** — SELECT `authenticated`, gravação só admin.
- **`familias_depoimentos`** / **`alunos_destaque`** — SELECT `TO anon` apenas em linhas com `aprovado = true` (para renderizar a home sem login).
- **`agendamentos`** — INSERT `TO anon` com rate-limit por trigger; SELECT restrito.
- **`fcm_tokens`** — INSERT/DELETE do próprio usuário via `auth.uid() = user_id`.

---

## Funções SECURITY DEFINER

- **`has_role(_user_id uuid, _role app_role) → boolean`** — resolve papel sem recursão RLS. `search_path = public`. Acessível por `authenticated`.
- **`trigger_dispatch_push()`** — invocada por `tg_push_queue_dispatch` após INSERT em `push_notifications_queue`. Lê `private.app_secrets` e faz `net.http_post` para o Worker.
- **`enqueue_due_alert_pushes()`** — job interno que scanneia alertas vencidos e insere na fila.

---

## Recuperação (disaster recovery)

Para recriar este banco em um novo projeto Supabase:

1. Criar schema `public` + `private`.
2. Recriar enum `app_role` e tabela `user_roles` + função `has_role`.
3. Recriar tabelas listadas acima (esquema pode ser reengenheirado via `pg_dump --schema-only`).
4. Aplicar `GRANT`s (ver `<user-roles>` no CLAUDE.md).
5. Recriar `private.app_secrets` e inserir `dispatch_secret` + `worker_url`.
6. Recriar cron jobs (queries prontas no histórico do chat / próximo commit).
7. Recriar funções `SECURITY DEFINER`.
8. Habilitar extensões: `pg_cron`, `pg_net`, `pgcrypto`, `uuid-ossp`.

---

**Última atualização:** 2026-07-16 — sincronização do `DISPATCH_SECRET` entre Supabase, Cloudflare Worker e Lovable (S2 resolvida).
