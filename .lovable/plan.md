## Objetivo

Trocar todo o pipeline de notificações do app — hoje em **Web Push com VAPID** (`@block65/webcrypto-web-push` + `PushManager.subscribe` + service worker próprio) — por **Firebase Cloud Messaging (FCM)**, usando o SDK oficial do Firebase no cliente e a **FCM HTTP v1 API** no servidor. Isso prepara o terreno para reaproveitar o **mesmo backend e os mesmos tokens** quando você fizer o app nativo Android/iOS.

Inscrições Web Push atuais serão **descartadas**; usuários clicam de novo em "Ativar avisos" e recebem um token FCM.

---

## Passo 0 — Você cria o projeto Firebase (antes de eu codar)

Vou precisar destes valores. Enquanto você não me devolver eles, deixo tudo pronto mas o envio real não funciona.

1. **Criar projeto**: https://console.firebase.google.com → _Add project_ → nome livre (ex: `conecta-ueecm`) → pode desativar Analytics.
2. **Registrar app Web**: no projeto → ícone `</>` "Web" → apelido `conecta-ueecm-web` → **NÃO marcar** "Firebase Hosting" → _Register app_. Copie o objeto `firebaseConfig`:
   ```
   apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId
   ```
3. **Cloud Messaging → Web Push certificate**: Project settings → Cloud Messaging → _Web configuration_ → _Generate key pair_. Copie a **Public VAPID key** (única string base64url, começa por `B...`). Essa chave substitui a `VAPID_PUBLIC_KEY` atual.
4. **Service account** (para o servidor assinar chamadas FCM v1): Project settings → _Service accounts_ → _Generate new private key_ → baixa um `.json`. Vou pedir três campos desse JSON via `add_secret`:
   - `FIREBASE_PROJECT_ID` (campo `project_id`)
   - `FIREBASE_CLIENT_EMAIL` (campo `client_email`)
   - `FIREBASE_PRIVATE_KEY` (campo `private_key` — cole com os `\n` literais preservados; o código trata)

Também vou pedir a **VAPID public key do Firebase** como `FIREBASE_VAPID_PUBLIC_KEY` e os valores públicos como secrets prefixados `VITE_FIREBASE_*` (apiKey/projectId/appId/messagingSenderId) — todos podem ficar no bundle, mas os secrets facilitam ambientes.

---

## O que vai mudar no código

### Banco (uma migração)

- Criar tabela `public.fcm_tokens`:
  ```
  id uuid pk, user_id uuid null (FK auth.users), token text unique not null,
  user_agent text, platform text, created_at, updated_at
  ```
  Com RLS: `authenticated` insere/deleta os próprios (`user_id = auth.uid()`) e anônimos também podem inserir (`user_id is null`) para visitantes; grants padrão + `service_role` full.
- **Deixar `push_subscriptions` intocada por enquanto** (só paramos de escrever nela). Depois de você confirmar que o FCM está funcionando, dropo em migração separada. Ficam as triggers já existentes de fila (`push_notifications_queue`) — o payload continua igual, só muda quem consome.

### Servidor (TanStack)

- **Novo**: `src/lib/fcm.server.ts` com:
  - `getAccessToken()` — assina JWT RS256 com WebCrypto (`crypto.subtle.importKey` + `sign`) usando `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`, troca por OAuth2 access token em `https://oauth2.googleapis.com/token` com escopo `https://www.googleapis.com/auth/firebase.messaging`. Cache em memória por ~55min. Roda em Cloudflare Workers (WebCrypto, sem `google-auth-library`).
  - `sendFcm(token, payload)` — POST em `https://fcm.googleapis.com/v1/projects/{PROJECT_ID}/messages:send` com o access token; trata 404/`UNREGISTERED` como token morto (delete).
- **Substituir**: `src/lib/push-dispatcher.server.ts` — mesmo formato (`drainPushQueue`, `sendTestPushToUser`, `broadcastTestPushToAll`) mas lendo `fcm_tokens` e chamando `sendFcm` em vez de `sendOne`. Preserva a estrutura de fila e a resposta `{ processed, sent, pruned, errors }` para não quebrar as chamadas existentes.
- **Manter** intocados: `src/lib/push.functions.ts`, `src/lib/comunicado-notify.functions.ts`, `/api/public/dispatch-push.ts`, triggers e fila. Assinaturas idênticas.

### Rotas HTTP

- **Novo**: `/api/fcm/register` (POST) — recebe `{ token, platform }`, valida com Zod, resolve `user_id` do bearer opcional, upsert em `fcm_tokens`.
- **Novo**: `/api/fcm/unregister` (POST) — remove um token.
- **Remover**: `/api/push/subscribe.ts` e `/api/push/resubscribe.ts` (não são mais necessários — FCM gerencia rotação de token internamente e o SDK re-emite via `onTokenRefresh`).

### Cliente

- Instalar `firebase` (`bun add firebase`).
- **Novo**: `src/integrations/firebase/client.ts` — `initializeApp` + `getMessaging` (lazy, só no browser).
- **Novo**: `public/firebase-messaging-sw.js` — carrega SDK compat do Firebase via `importScripts`, chama `firebase.messaging()` e faz `onBackgroundMessage(showNotification)` com o mesmo visual do SW atual. `notificationclick` abre `event.notification.data.url`.
- **Reescrever**: `src/lib/push.ts` — trocar `PushManager.subscribe` por `getToken(messaging, { vapidKey, serviceWorkerRegistration })` do SDK; `getCurrentSubscription` vira `getCurrentFcmToken()`; envio ao backend passa por `/api/fcm/register`.
- **Deletar**: `src/lib/push-vapid.ts`, `src/lib/push-verify.functions.ts`, `src/lib/push-debug.functions.ts` (obsoletos).
- **Atualizar consumidores**: `PushSubscribeButton.tsx`, `TestPushButton.tsx`, `BroadcastTestPushButton.tsx` — só mudam nomes de função importados; UX igual.
- **SW antigo** (`public/sw.js`): virar kill-switch que faz `unregister()` + limpa caches, para browsers que já registraram a versão anterior desregistrarem sozinhos. O novo SW é o `firebase-messaging-sw.js` (escopo diferente, coexistem sem conflito).

### Diagnóstico

- `src/lib/runtime-check.functions.ts` — trocar `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` por `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_VAPID_PUBLIC_KEY`. Painel `/painel-diagnostico` continua funcionando.
- `PUSH_SETUP.md` — reescrever com instruções FCM.

---

## Detalhes técnicos importantes

- **JWT no Worker**: `crypto.subtle.importKey('pkcs8', pemToBinary(privateKey), { name:'RSASSA-PKCS1-v1_5', hash:'SHA-256' }, false, ['sign'])`. Sem libs Node (elas quebram em Cloudflare Workers).
- **Payload FCM v1**: `{ message: { token, notification: { title, body }, webpush: { fcm_options: { link }, headers: { Urgency: 'high', TTL: '3600' } }, android: { priority: 'HIGH' }, apns: { headers: { 'apns-priority': '10' } } } }` — o mesmo payload já serve para o futuro app nativo.
- **Tokens mortos**: FCM v1 retorna `404` com `error.status === 'NOT_FOUND'` ou `error.details[].errorCode === 'UNREGISTERED'` → deletar do `fcm_tokens`.
- **Access token cache**: guardar em módulo (`let cached: { token, exp } | null`); OAuth2 token dura 1h.
- **iOS**: FCM Web só funciona em iOS 16.4+ com PWA instalado (mesma limitação de hoje). Componente `PushSubscribeButton` já trata esse caso — mantém a lógica de "instale o app primeiro".

---

## Ordem de execução

1. Você me envia os 4 secrets (Passo 0).
2. Rodo a migração `fcm_tokens`.
3. Escrevo servidor (`fcm.server.ts` + novo dispatcher + rotas `/api/fcm/*`).
4. Escrevo cliente (`firebase/client.ts`, novo SW, nova `push.ts`).
5. Adapto botões e removo arquivos VAPID obsoletos.
6. Kill-switch no `public/sw.js` antigo.
7. Você testa: clica em "Ativar avisos" → "Enviar push de teste".
8. Depois de OK, drop de `push_subscriptions` em migração separada.

---

## Impacto para os usuários

- Todo mundo que já tinha ativado avisos vai precisar **clicar de novo em "Ativar avisos"** uma vez. Sem isso, param de receber. Aviso opcional dentro do app na primeira renderização pós-deploy (adiciono um toast informativo em `PermissionsOnboarding.tsx` se você quiser — me diga na hora).
- Nenhuma outra parte do app muda: comunicados, alertas, posts e agendamentos continuam disparando push automaticamente via as mesmas triggers.

Se aprovar, começo pelo Passo 0 pedindo os secrets do Firebase.
