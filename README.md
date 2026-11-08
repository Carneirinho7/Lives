# LiveLoot

MVP de uma aplicação para acompanhar várias lives e acumular pontos enquanto os players estão visíveis.

## Entrar no LiveLoot

Abra `/login`, escolha **Criar conta** e cadastre seu nome, e-mail e uma senha com pelo menos 10 caracteres. A primeira conta criada no banco SQLite local recebe o papel de administrador; cadastros posteriores recebem o papel de usuário. Depois, use e-mail e senha em **Entrar**.

O LiveLoot guarda contas, sessões e saldo em `data/liveloot.sqlite`. A autenticação usa Better Auth, cookies HttpOnly e limite de tentativas. Não use o primeiro cadastro de administrador em um servidor público sem antes configurar um fluxo seguro de convite/implantação e envio de verificação de e-mail.

## Rodar localmente

```bash
npm install
npx auth@latest migrate --yes
npm run dev
```

Abra <http://localhost:3000>. O projeto usa Next.js App Router, React, TypeScript e Tailwind CSS 4.

## Como funciona

- `src/frontend/components/player-embed.tsx` monta os iframes, mantém autoplay desativado e áudio mutado e usa Intersection Observer + Page Visibility API para pausar a contagem fora de foco.
- `src/app/api/ping/route.ts` exige sessão autenticada e limita cada combinação usuário/live a um ping por 60 segundos. Um ping válido acrescenta 5 pontos internos.
- `src/backend/store.ts` contém a lista inicial das lives e valida os pings.
- `src/app/api/dashboard/route.ts` fornece o perfil autenticado e as lives para a tela inicial.
- Os botões de adicionar/remover lives guardam as alterações no `localStorage` deste navegador; o botão **Adicionar live** aceita links diretos de canais da Twitch e do Kick.
- `src/backend/auth.ts` configura o login por e-mail/senha, SQLite e o primeiro administrador.

## Organização das pastas

- `src/frontend/`: telas, componentes React, cliente de autenticação e estilos.
- `src/backend/`: autenticação, banco SQLite e lógica de lives/pontos.
- `src/shared/`: tipos usados tanto pelo front-end quanto pelo back-end.
- `src/app/`: entrada exigida pelo App Router do Next.js; páginas e rotas de API encaminham para as pastas acima.

## Persistência e autenticação

Contas, sessões e saldo são persistidos em SQLite. A lista inicial de lives está em `src/backend/store.ts`.

Os pontos adicionados pelo endpoint `/api/ping` são apenas pontos internos do LiveLoot. Para acumular pontos oficiais, use **Abrir Twitch/Kick** no card e assista enquanto estiver conectado à sua conta na plataforma.

O parâmetro `parent` obrigatório do Twitch é preenchido com o hostname atual. O embed do Kick recebe os parâmetros documentados `autoplay=false` e `muted=true`; o iframe envia a origem via `referrerPolicy`.

As lives de exemplo são canais editáveis em `src/backend/store.ts`.
