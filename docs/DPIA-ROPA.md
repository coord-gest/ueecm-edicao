# DPIA + ROPA — Conecta UEECM

Documento de conformidade LGPD. Base legal: Lei 13.709/2018.
Última revisão: {{ATUALIZAR-NA-EDIÇÃO}} · Responsável: DPO da UEECM.

> ⚠️ Este projeto trata dados de **menores de idade** (alunos). Aplica-se o
> Art. 14 da LGPD: tratamento no melhor interesse da criança, com
> consentimento específico e destacado de pelo menos um dos pais/responsáveis.

---

## Parte I — ROPA (Registro das Operações de Tratamento)

### 1. Identificação

| Campo | Valor |
|---|---|
| Controlador | União Espírita Evangélica Cristo do Morumbi (UEECM) |
| Encarregado (DPO) | _preencher_ — dpo@conectaueecm.com |
| Operador | Supabase Inc. (banco) · Cloudflare (CDN/Workers) · Google (FCM/Gemini) |
| Sistema | Conecta UEECM (aplicação web PWA) |

### 2. Finalidades

1. Gestão acadêmica (frequência, notas, comunicados).
2. Comunicação escola↔família (chat, push, avisos).
3. Divulgação institucional (galerias, posts, equipe).
4. Autorizações e uso de imagem (consentimento parental).
5. Emissão de comprovantes/relatórios.

### 3. Categorias de dados e titulares

| Categoria de titular | Dados tratados | Sensível? | Base legal |
|---|---|---|---|
| Alunos (menores) | Nome, foto, turma, notas, frequência, autorizações | Sim (menor) | Art. 14 §1º — consentimento parental |
| Pais/responsáveis | Nome, e-mail, telefone, vínculo | Não | Consentimento (Art. 7 I) + execução de contrato educacional (Art. 7 V) |
| Profissionais | Nome, foto, bio, email, telefone, cargo | Não | Legítimo interesse (Art. 7 IX) + consentimento |
| Visitantes públicos | Depoimentos, foto (quando enviada) | Não | Consentimento explícito no formulário |
| Autores de conteúdo | Metadados de posts/comentários | Não | Execução do serviço |

### 4. Compartilhamento com terceiros (subprocessadores)

| Terceiro | País | Finalidade | Salvaguarda |
|---|---|---|---|
| Supabase | EUA | Banco, auth, storage | DPA + criptografia em repouso |
| Cloudflare | Global | CDN, Workers, Turnstile | DPA + TLS |
| Google Firebase (FCM) | EUA | Push notifications | DPA Google + tokens anônimos |
| Google Gemini | EUA | Assistente IA (`/api/chat`) | Sem envio de PII sensível; prompts filtrados |
| Lovable | UE/EUA | Hospedagem gerenciada | DPA Lovable |

### 5. Retenção

| Dado | Prazo | Base |
|---|---|---|
| Registros acadêmicos (notas, frequência) | 5 anos após saída | Norma MEC |
| Comunicados/mensagens | 2 anos após envio | Legítimo interesse |
| Chat aluno↔escola | 1 ano após última mensagem | Minimização |
| Fotos em galerias | Enquanto publicadas + 30 dias após despublicação | Consentimento revogável |
| Autorizações assinadas | Duração do vínculo + 5 anos | Comprovação legal |
| Logs de acesso / audit | 12 meses | Segurança (Art. 46) |
| `system_errors` | 90 dias | Segurança operacional |
| Tokens FCM inativos | 60 dias | Limpeza automática |
| Consentimentos parentais revogados | Até anonimização das fotos vinculadas | Direito de revogação (Art. 8 §5º) |

### 6. Medidas técnicas e organizacionais (Art. 46)

- **Autenticação:** Supabase Auth (email/senha) + rate limit + Turnstile no login.
- **Autorização:** RLS em todas as tabelas com dados pessoais; roles em `user_roles`.
- **Criptografia:** TLS 1.3 em trânsito; AES-256 em repouso (Supabase padrão).
- **Isolamento:** Fotos de galerias não publicadas bloqueadas por policy de storage.
- **Rate limit:** `/api/chat` em 3 camadas; endpoints `/api/public/*` com HMAC timing-safe.
- **Cabeçalhos:** CSP, HSTS, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy.
- **Auditoria:** Tabelas `audit_logs`, `admin_access_logs`, `analytics_events`.
- **Backup:** Supabase PITR (ver `docs/RUNBOOK.md`).
- **Gestão de incidentes:** `docs/RUNBOOK.md` seção 4 (notificação ANPD ≤ 72h).

### 7. Direitos dos titulares (Art. 18)

Canal único: página `/solicitar-dados` (tabela `data_subject_requests`).
Prazo de resposta: 15 dias corridos.
Suportados: acesso, correção, anonimização, portabilidade, revogação de consentimento, informação sobre compartilhamento.

---

## Parte II — DPIA (Relatório de Impacto)

Justificativa: tratamento envolve **crianças e adolescentes** (Art. 38 combinado com Art. 14) — DPIA é recomendável.

### 8. Necessidade e proporcionalidade

Cada finalidade da Seção 2 é vinculada a uma atividade educacional legítima.
Dados coletados são o **mínimo necessário** para a finalidade — nomes, turma e
contato do responsável são estritamente operacionais.
Fotos e depoimentos exigem consentimento **específico**, revogável a qualquer
momento em `/uso-de-imagem`.

### 9. Riscos identificados e mitigações

| # | Risco | Impacto | Prob. | Mitigação atual |
|---|---|---|---|---|
| R1 | Vazamento de fotos de alunos | Alto | Baixa | Storage policy exige `publicado=true` (fix 2025) |
| R2 | Acesso indevido a notas/frequência | Alto | Baixa | RLS por `aluno_responsavel` + role staff |
| R3 | Exposição de contato de profissionais | Médio | Baixa | Grants por coluna — email/tel só via RPC admin |
| R4 | Injeção via chat Gemini | Médio | Média | Rate limit 3-níveis + validação de tamanho |
| R5 | Abuso de endpoints `/api/public/*` | Médio | Baixa | HMAC timing-safe |
| R6 | Perda de dados por falha Supabase | Alto | Baixa | PITR + runbook de restore |
| R7 | Uso de imagem sem consentimento renovado | Alto (menor) | Média | Consentimento parental revalidado anualmente na rematrícula |
| R8 | Vazamento de senha (credential stuffing) | Médio | Média | **Pendente:** ativar Leaked Password Protection |
| R9 | Ataque a11y (bypass de teclado) | Baixo | Baixa | Radix/shadcn + auditoria axe periódica |

### 10. Ações prioritárias

1. Ativar **Leaked Password Protection** (Auth › Providers › Email).
2. Revisar consentimentos parentais a cada rematrícula anual.
3. Rodar `security--run_security_scan` e `bun run audit:a11y` mensalmente.
4. Publicar link para `/privacidade` e canal DPO em todos os rodapés.
5. Treinamento anual de LGPD para staff com acesso administrativo.

### 11. Aprovação

| Papel | Nome | Data | Assinatura |
|---|---|---|---|
| Controlador | — | — | — |
| DPO | — | — | — |
| Direção da escola | — | — | — |

> Rever este documento **anualmente** ou sempre que houver mudança material
> nas finalidades, categorias de dados ou subprocessadores.
