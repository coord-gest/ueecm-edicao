# Runbook — Resposta a Incidentes de Segurança (LGPD Art. 48)

> Documento interno. Versão pública para titulares em `/seguranca/incidentes`.
> Última revisão: 2026-07-23. Revisão semestral obrigatória.

## 1. Escopo

Aplica-se a qualquer evento que comprometa (ou tenha potencial para comprometer)
a confidencialidade, integridade ou disponibilidade de dados pessoais tratados
pelo portal da U.E. Evaristo Campelo de Matos.

## 2. Papéis

| Papel | Responsável | Contato |
|---|---|---|
| DPO / Coord. Resposta | Francisco Douglas | franciscodouglas.dev@outlook.com |
| Direção | Val de Sousa / Hellen | ueecmevaristo2018@gmail.com |
| Operador — Banco | Supabase | dashboard do projeto |
| Operador — Edge/CDN | Cloudflare | dashboard da zona |

## 3. Severidades

- **P0 — Crítico**: exposição pública de dados pessoais, credenciais vazadas, RCE.
- **P1 — Alto**: acesso indevido confirmado a dados internos, bypass de RLS.
- **P2 — Médio**: vulnerabilidade explorável sem evidência de abuso.
- **P3 — Baixo**: findings de scanner de baixo impacto.

SLA interno de triagem: P0 ≤ 1 h · P1 ≤ 4 h · P2 ≤ 24 h · P3 ≤ 5 dias úteis.

## 4. Fluxo (checklist)

### 4.1 Detecção
- [ ] Fonte do alerta registrada (log, denúncia, scanner).
- [ ] Snapshot dos logs relevantes preservado (audit_logs, system_errors, edge logs).

### 4.2 Contenção (P0/P1)
- [ ] Rotacionar chaves comprometidas: `SERVICE_ROLE_KEY`, `DISPATCH_SECRET`, `TURNSTILE_SECRET_KEY`.
- [ ] Revogar sessões (`auth.sessions`) dos usuários afetados.
- [ ] Bloquear rota/handler vulnerável (feature flag, deploy hotfix ou WAF rule).
- [ ] Restringir/ajustar RLS/CLS se o bypass ocorreu no banco.

### 4.3 Erradicação
- [ ] Corrigir causa raiz em código e migrar banco se necessário.
- [ ] Rodar `security--run_security_scan` e `dependency_scan`.
- [ ] Cobertura de teste para o cenário (evita regressão).

### 4.4 Recuperação
- [ ] Restaurar de backup verificado (HMAC ok) se houver corrupção.
- [ ] Reabilitar rotas com monitoramento reforçado por 72 h.

### 4.5 Notificação (Art. 48)
- [ ] DPO consolida: dados afetados, titulares, riscos, medidas.
- [ ] Comunicar ANPD em até **72 h** da confirmação (formulário oficial ANPD).
- [ ] Comunicar titulares afetados por e-mail + banner no portal.
- [ ] Registrar protocolo em `data_subject_requests` quando aplicável.

### 4.6 Post-mortem (obrigatório em P0/P1)
- [ ] Timeline, causa raiz, impacto, ações corretivas, lições aprendidas.
- [ ] Arquivar em `docs/post-mortems/AAAA-MM-DD-slug.md`.
- [ ] Atualizar este runbook se o fluxo mudou.

## 5. Comandos úteis

```bash
# Revogar todas as sessões de um usuário (via SQL)
DELETE FROM auth.sessions WHERE user_id = '<uuid>';

# Bloquear login de um usuário (via Supabase Auth Admin)
# updateUserById(uuid, { banned_until: '2099-01-01' })

# Listar últimos erros críticos
SELECT * FROM public.system_errors ORDER BY created_at DESC LIMIT 100;
```

## 6. Referências

- LGPD, Art. 46 (segurança), Art. 48 (comunicação de incidentes), Art. 49 (medidas).
- Guia ANPD de Notificação de Incidente de Segurança (versão vigente).
- OWASP ASVS, NIST SP 800-61r2.