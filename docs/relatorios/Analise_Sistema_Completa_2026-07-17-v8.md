# Análise Completa do Sistema — Conecta UEECM

**Data:** 17/07/2026 • **Versão:** v8 • **Site:** https://conectaueecm.com

---

## 1. Veredito Geral

| Categoria                                   | Status                  |
| ------------------------------------------- | ----------------------- |
| Build / TypeScript (`tsgo --noEmit`)        | ✅ PASS — sem erros     |
| Rotas / Router TanStack                     | ✅ OK                   |
| Deploy Cloudflare Workers (bun 1.2.15)      | ✅ OK                   |
| PWA / APK / Notificações                    | ✅ OK                   |
| SEO / OG / Sitemap                          | ✅ OK                   |
| Segurança (Supabase Scanner)                | ⚠️ 1 crítico + warnings |
| Módulos novos (Anotações, Lembretes, Cards) | ✅ OK                   |

**Veredito:** APROVADO com **1 correção crítica pendente** (RLS de `posts`).

---

## 2. Erro Crítico (deve ser corrigido)

### 2.1 RLS_POLICY_BYPASS em `posts`

- **Tabela:** `public.posts`
- **Problema:** Duas policies UPDATE permissivas (`posts_no_self_publish` e `posts_update`) se sobrepõem com OR. Qualquer autor autenticado consegue definir `status='publicado'` diretamente, ignorando a moderação editorial.
- **Impacto:** publicação de conteúdo não revisado no site público.
- **Correção (SQL):** unificar as regras em uma única `WITH CHECK` que exige `is_school_staff(auth.uid())` para alterar `status` para `publicado`.

---

## 3. Avisos (Warnings)

### 3.1 PRIVILEGE_ESCALATION em `mensagens_coordenacao.mc_update`

`WITH CHECK (true)` permite trocar `remetente_id/remetente_nome/remetente_tipo` após passar o USING. Recomenda-se restringir a alteração apenas de `lida_em` para não-admins.

### 3.2 MISSING_RLS_PROTECTION em `alunos_destaque_historico`

Policy INSERT valida apenas `autor_id = auth.uid()`. Deve exigir `is_school_admin` ou `is_professor_da_turma`.

### 3.3 SECURITY DEFINER Functions expostas (~35 funções)

Diversas funções `SECURITY DEFINER` estão executáveis por `anon`/`authenticated`. Auditar `GRANT EXECUTE` — revogar de `anon` onde não for público.

### 3.4 Leaked Password Protection desativado

Habilitar em: Supabase → Auth → Password Protection (HaveIBeenPwned).

### 3.5 Deprecação (não bloqueia)

`createServerFn().inputValidator()` está deprecado em favor de `.validator()`. Impacto: apenas warnings no build. Arquivos afetados:

- `src/lib/notes-reminders.functions.ts` (7 ocorrências)
- `src/lib/seed-users.functions.ts` (1 ocorrência)

---

## 4. Funcionalidades Verificadas ✅

- **Autenticação** Supabase com `requireSupabaseAuth` middleware
- **Painéis por perfil**: Diretor, Coordenador, Secretário, Professor, Leitor, Desenvolvedor
- **Produtividade** → Anotações, Lembretes e Cards de Anotação
- **Visualizadores modernos** com download de mensagem (.txt) e imagem (.png)
- **Notificações Push (FCM)** — SW no root scope, ícones absolutos, botão de teste
- **PWA/APK** — splash screen do mascote (3s), manifest, assetlinks
- **SEO** — canonical, OG absolutas, JSON-LD, sitemap dinâmico
- **Responsividade Mobile** — Equipe, Header (Sheet à direita), filtros com wrap

---

## 5. Infraestrutura

| Item            | Configuração                                             |
| --------------- | -------------------------------------------------------- |
| Deploy          | **Exclusivamente Cloudflare Workers** via GitHub Actions |
| Bun             | `1.2.15` (pinado em `package.json` e workflows)          |
| Lockfile        | `bun.lock` sincronizado (frozen no CI)                   |
| Secrets runtime | 8 configurados (Supabase, Firebase, Gemini, Dispatch)    |
| Domínio         | conectaueecm.com                                         |

---

## 6. Próximos Passos Recomendados

1. **[CRÍTICO]** Corrigir policy `posts_update` (SQL de merge).
2. **[MÉDIO]** Restringir `WITH CHECK` em `mc_update`.
3. **[MÉDIO]** Endurecer INSERT de `alunos_destaque_historico`.
4. **[BAIXO]** Auditar `GRANT EXECUTE` das funções `SECURITY DEFINER`.
5. **[BAIXO]** Habilitar Leaked Password Protection no Supabase Auth.
6. **[BAIXO]** Migrar `.inputValidator()` → `.validator()`.

---

**Conclusão:** o sistema está estável, com build e tipos limpos, PWA/APK e notificações funcionais. Apenas 1 ajuste crítico de RLS é necessário para produção 100% segura.
