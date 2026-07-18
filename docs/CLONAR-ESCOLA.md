# 📋 Checklist de Clonagem — Nova Escola

Guia passo a passo para replicar o sistema Conecta UEECM para uma nova escola.
**Tempo estimado**: 2-3 horas na primeira vez, ~1h nas próximas.

---

## 🎯 Antes de começar

- [ ] Nome da nova escola definido: `___________________`
- [ ] Slug/subdomínio escolhido (ex: `escolax`): `___________________`
- [ ] Domínio contratado (ex: `escolax.com.br`): `___________________`
- [ ] Logo em PNG (512×512 + 192×192) prontos
- [ ] Cores da identidade visual definidas (primária + secundária)
- [ ] E-mail administrativo do diretor da nova escola

---

## 1️⃣ Lovable — Remix do Projeto (5 min)

- [ ] Abrir o projeto Conecta UEECM no dashboard
- [ ] Clicar nos três pontinhos (⋯) → **Remix**
- [ ] Renomear para `Conecta {NomeEscola}`
- [ ] Confirmar que o novo projeto abriu com todo o código
- [ ] **Desconectar do Supabase antigo**: Project Settings → Supabase → Disconnect

---

## 2️⃣ Supabase — Novo Projeto (30 min)

- [ ] Criar conta/organização Supabase (ou reutilizar a existente)
- [ ] **New Project** → nome `conecta-{slug}` → região `South America (São Paulo)`
- [ ] Anotar senha do banco em local seguro
- [ ] Aguardar provisionamento (~2 min)
- [ ] Conectar o projeto Lovable a este novo Supabase (Project Settings → Supabase)

### 2.1 Migrations (SQL Editor)

Executar em ordem, copiando de `supabase/migrations/` do projeto original:

- [ ] Extensões (`pgcrypto`, `pg_cron`, `pg_net`, `vector`)
- [ ] Enums (`app_role`, `post_status`, etc.)
- [ ] Tabelas core (`profiles`, `user_roles`, `alunos`, `turmas`, etc.)
- [ ] Funções (`has_role`, `is_school_admin`, `is_professor_da_turma`, etc.)
- [ ] Triggers (audit, push queue, rate limits)
- [ ] RLS policies (todas as tabelas)
- [ ] Views (`profissionais_publicos`, `familias_depoimentos_publicos`)
- [ ] Índices de performance
- [ ] Seed de `comunicado_templates` (7 templates padrão)

> 💡 **Dica**: exportar o schema do UEECM com `pg_dump --schema-only` acelera muito.

### 2.2 Storage Buckets

Criar via Dashboard → Storage:

- [ ] `alert-images` (público)
- [ ] `comunicados-anexos` (privado)
- [ ] `justificativas` (privado)
- [ ] `backups` (privado)
- [ ] Aplicar policies de cada bucket

### 2.3 Auth

- [ ] Ativar **Email** provider
- [ ] Ativar **Leaked Password Protection** (Auth → Policies)
- [ ] Configurar SMTP (Resend) com domínio da nova escola
- [ ] Configurar templates de e-mail (confirmação, reset)
- [ ] URL de redirect: `https://{dominio}/auth/callback`

---

## 3️⃣ Firebase — Push Notifications (20 min)

- [ ] Criar novo projeto Firebase: `conecta-{slug}`
- [ ] Habilitar **Cloud Messaging**
- [ ] Gerar par de chaves VAPID (Cloud Messaging → Web configuration)
- [ ] Baixar credenciais Admin SDK (Service Account JSON)
- [ ] Anotar: `projectId`, `webApiKey`, `vapidPublicKey`, `clientEmail`, `privateKey`

---

## 4️⃣ Secrets no Lovable (10 min)

Adicionar via Project Settings → Secrets:

- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_PUBLISHABLE_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` / `SERVICE_ROLE_KEY`
- [ ] `SUPABASE_DB_URL`
- [ ] `FIREBASE_PROJECT_ID`
- [ ] `FIREBASE_WEB_API_KEY`
- [ ] `FIREBASE_VAPID_PUBLIC_KEY`
- [ ] `FIREBASE_CLIENT_EMAIL`
- [ ] `FIREBASE_PRIVATE_KEY`
- [ ] `DISPATCH_SECRET` (gerar novo — `openssl rand -hex 32`)
- [ ] `GEMINI_API_KEY` (pode reutilizar ou criar novo)
- [ ] `GROQ_API_KEY` (pode reutilizar ou criar novo)
- [ ] `LOVABLE_API_KEY` (auto)

---

## 5️⃣ Personalização Visual (30 min)

### 5.1 Assets

- [ ] Substituir `public/icon-512.png` e `public/icon-192.png`
- [ ] Substituir `public/badge-96.png` (silhueta monocromática)
- [ ] Substituir `public/favicon.ico`
- [ ] Substituir logo em `src/assets/`
- [ ] Atualizar splash screen do PWA

### 5.2 Manifest e Metadados

- [ ] `public/manifest.json` → nome, short_name, theme_color
- [ ] `src/routes/__root.tsx` → title, description, og tags
- [ ] `public/firebase-messaging-sw.js` → config do novo Firebase
- [ ] `src/integrations/firebase/config.ts` → nova config

### 5.3 Conteúdo

- [ ] Nome da escola em todos os textos hardcoded (buscar `UEECM`)
- [ ] Endereço, telefone, e-mail de contato
- [ ] Página `/sobre` — reescrever história da escola
- [ ] Cores em `src/styles.css` (tokens do design system)

---

## 6️⃣ Cloudflare — Deploy (20 min)

- [ ] Criar nova conta Cloudflare (ou usar existente)
- [ ] Publicar o projeto no Lovable (botão **Publish**)
- [ ] Configurar Worker no Cloudflare
- [ ] Adicionar todos os secrets no Worker (mesma lista do passo 4)
- [ ] Configurar domínio custom no Lovable
- [ ] Adicionar registros DNS (A → 185.158.133.1 + TXT)
- [ ] Aguardar SSL (~5-30 min)

---

## 7️⃣ Cron Jobs no Supabase (10 min)

SQL Editor — substituir `{dominio}` e `{dispatch_secret}`:

- [ ] `dispatch-push` (a cada minuto)
- [ ] `backup-semanal` (segunda 03h)
- [ ] `comunicados-agendados` (a cada 5 min)
- [ ] `comunicados-lembretes` (diário 09h)
- [ ] `cleanup-*` (semanal — analytics, audit, errors)

---

## 8️⃣ Dados Iniciais (30 min)

- [ ] Criar usuário Desenvolvedor (você) via Auth → Users
- [ ] Atribuir role `desenvolvedor` em `user_roles`
- [ ] Criar usuário Diretor da nova escola
- [ ] Cadastrar turmas iniciais em `turmas_escolares`
- [ ] Cadastrar profissionais em `profissionais`
- [ ] Configurar tema em `configuracoes_tema`
- [ ] Testar login com cada perfil

---

## 9️⃣ Testes Finais (30 min)

- [ ] Login funciona
- [ ] Push notification chega (testar com celular bloqueado)
- [ ] Upload de imagem funciona (bucket certo)
- [ ] Cadastro de aluno funciona
- [ ] Comunicado envia push
- [ ] PWA instala no Android
- [ ] PWA instala no iOS
- [ ] Modo offline funciona
- [ ] Backup manual gera arquivo em `backups/`
- [ ] `/painel-manutencao` mostra recursos corretos

---

## 🔟 Handover para a Escola

- [ ] Reunião de treinamento com Diretor + Coordenador
- [ ] Entregar credenciais em envelope digital seguro (1Password/Bitwarden)
- [ ] Documento com contatos de suporte
- [ ] Agendar primeira revisão em 15 dias

---

## 🚨 Alertas de Segurança

1. **Nunca reutilizar `DISPATCH_SECRET`, `SERVICE_ROLE_KEY` ou senhas** entre escolas
2. **VAPID keys devem ser únicas** por Firebase project
3. **Backup imediato** após configuração inicial (segurança contra rollback)
4. **Revisar RLS** — confirmar que nenhuma policy vazou dados entre projetos

---

## 📊 Custos por Escola Clonada

| Item                                       | Custo/mês          |
| ------------------------------------------ | ------------------ |
| Supabase Pro (recomendado após 3-6 meses)  | $25                |
| Cloudflare Workers (Free até 100k req/dia) | $0                 |
| Domínio (.com.br anual ÷ 12)               | ~R$ 4              |
| Firebase (Free tier cobre bem)             | $0                 |
| **Total**                                  | **~$25 + domínio** |

> Nos primeiros meses, dá para rodar 100% grátis (Supabase Free) enquanto a escola valida.

---

## 🔄 Manutenção Multi-Escola

Quando fizer uma correção/feature nova no UEECM:

1. Testar no UEECM primeiro
2. Copiar SQL das migrations pra cada Supabase clonado
3. No Lovable de cada escola: fazer o mesmo prompt pro assistente aplicar
4. Publicar (Update) em cada projeto
5. Rodar smoke test rápido em cada domínio

> 💡 **Dica**: manter uma planilha `escolas.csv` com colunas `nome | dominio | supabase_url | firebase_project | ultima_atualizacao` facilita muito.

---

**Última atualização**: Julho 2026
**Versão do sistema base**: Conecta UEECM v2.x
