# LiveLoot

MVP de uma aplicaÃ§Ã£o para acompanhar vÃ¡rias lives e acumular pontos enquanto os players estÃ£o visÃ­veis.

## Entrar no LiveLoot

Abra `/login`, escolha **Criar conta** e cadastre seu nome, e-mail e uma senha com pelo menos 10 caracteres. No ambiente local, o primeiro cadastro recebe o papel de administrador; os demais recebem o papel de usuÃ¡rio. Em produÃ§Ã£o, a conta do dono reivindica admin usando o cÃ³digo inicial da hospedagem.

O LiveLoot guarda contas, sessÃµes e saldo em `data/liveloot.sqlite`. A autenticaÃ§Ã£o usa Better Auth, cookies HttpOnly e limite de tentativas. O envio de e-mail de verificaÃ§Ã£o ainda precisa ser configurado antes de tratar os e-mails como identidades verificadas.

As tabelas de autenticaÃ§Ã£o sÃ£o aplicadas automaticamente no primeiro acesso.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra <http://localhost:3000>. O projeto usa Next.js App Router, React, TypeScript e Tailwind CSS 4.

## Como funciona

- `frontend/components/player-embed.tsx` monta os iframes, mantÃ©m autoplay desativado e Ã¡udio mutado e usa Intersection Observer + Page Visibility API para pausar a contagem fora de foco.
- `backend/routes/ping.ts` valida sessÃ£o autenticada e limita cada combinaÃ§Ã£o usuÃ¡rio/live a um ping por 60 segundos. Um ping vÃ¡lido acrescenta 5 pontos internos.
- `backend/store.ts` contÃ©m a lista inicial das lives e valida os pings.
- `backend/routes/dashboard.ts` fornece o perfil autenticado e as lives para a tela inicial.
- Os botÃµes de adicionar/remover lives guardam as alteraÃ§Ãµes no `localStorage` deste navegador; o botÃ£o **Adicionar live** aceita links diretos de canais da Twitch e do Kick.
- `backend/auth.ts` configura o login por e-mail/senha, SQLite e o primeiro administrador.

## OrganizaÃ§Ã£o das pastas

- `frontend/`: interface organizada em `pages/`, `components/`, `auth/` e `styles/`.
- `backend/`: cÃ³digo do servidor, autenticaÃ§Ã£o, migraÃ§Ãµes, banco SQLite e lÃ³gica de lives/pontos.
- `backend/shared/`: tipos compartilhados entre front-end e back-end.
- `src/app/`: camada fina de rotas obrigatÃ³ria do Next.js App Router. As telas vivem em `frontend/pages/`; os `route.ts` registram os endpoints que usam o cÃ³digo de `backend/`.

## PersistÃªncia e autenticaÃ§Ã£o

Contas, sessÃµes e saldo sÃ£o persistidos em SQLite. A lista inicial de lives estÃ¡ em `backend/store.ts`.

Os pontos adicionados pelo endpoint `/api/ping` sÃ£o apenas pontos internos do LiveLoot. Para acumular pontos oficiais, use **Abrir Twitch/Kick** no card e assista enquanto estiver conectado Ã  sua conta na plataforma.

O parÃ¢metro `parent` obrigatÃ³rio do Twitch Ã© preenchido com o hostname atual. O embed do Kick recebe os parÃ¢metros documentados `autoplay=false` e `muted=true`; o iframe envia a origem via `referrerPolicy`.

As lives de exemplo sÃ£o canais editÃ¡veis em `backend/store.ts`.

## Publicar para outras pessoas

O projeto inclui `Dockerfile` e `render.yaml` para publicar como um web service no Render. A configuraÃ§Ã£o usa disco persistente para o SQLite. ServiÃ§os gratuitos do Render nÃ£o oferecem esse disco, entÃ£o essa configuraÃ§Ã£o requer um plano pago. O serviÃ§o ainda nÃ£o foi criado nem o repositÃ³rio publicado.

1. Envie este repositÃ³rio para uma conta GitHub que vocÃª controle.
2. No Render, crie um Blueprint apontando para o repositÃ³rio e revise o plano e o disco antes de confirmar.
3. Depois do primeiro deploy, crie sua conta no site. No painel do Render, copie `ADMIN_SETUP_TOKEN` e use-o no cadastro ou no botÃ£o **Configurar admin**.
4. Compartilhe o endereÃ§o pÃºblico `*.onrender.com` que o Render gerar.

Em produÃ§Ã£o, nenhum cadastro recebe admin automaticamente. O cÃ³digo gerado pelo Render permite ao dono reivindicar a administraÃ§Ã£o uma Ãºnica vez.

