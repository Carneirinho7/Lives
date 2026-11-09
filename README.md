# LiveLoot

MVP para acompanhar lives e acumular pontos enquanto os players estao visiveis.

## Banco de dados

Os clientes SSR do Supabase ficam em `frontend/lib/supabase/`. O Auth e o perfil novo usam o projeto `alzrsebcmfqzedegptow`; `public.profiles` tem RLS e nao permite que usuarios alterem pontos ou papel de administrador diretamente. O RPC de pontos autentica o usuario e aplica limite de 60 segundos por live. `.env.local` e ignorado pelo Git.

`DATABASE_URL` ainda aponta para o banco legado e e usado apenas para ler o perfil Better Auth na primeira sessao confirmada. `SUPABASE_SECRET_KEY` e obrigatoria somente no servidor para importar esse perfil uma vez e para a configuracao inicial do administrador. Nunca use essa chave em variavel `NEXT_PUBLIC_`. Mantenha o banco e as tabelas Better Auth antigos durante a validacao; eles nao sao apagados nem migrados destrutivamente.

As senhas Better Auth usam scrypt e nao podem ser importadas diretamente no Supabase Auth. O usuario legado deve criar uma conta com o mesmo e-mail, confirmar o endereco e definir uma nova senha; depois, nome, pontos e papel sao copiados sem apagar o registro antigo. O projeto Supabase esta com confirmacao por e-mail habilitada. Configure no painel do Supabase os redirects `/auth/confirm` para localhost e para o dominio publicado e um SMTP para envio de e-mails em producao.

As migrations em `supabase/migrations/` criam o perfil, RLS, o gatilho de cadastro e o RPC de pontos. `LEGACY_BETTER_AUTH_ENABLED` fica falso por padrao; o codigo e a dependencia Better Auth permanecem como rollback ate a validacao final.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra <http://localhost:3000>. O projeto usa Next.js App Router, React, TypeScript e Tailwind CSS 4.

## Como funciona

- `frontend/components/player-embed.tsx` monta os iframes e pausa a contagem quando a live nao esta visivel.
- `backend/routes/ping.ts` valida a sessao Supabase no servidor e chama o RPC que soma 5 pontos por minuto em cada canal.
- `backend/store.ts` contem a lista inicial de lives.
- As alteracoes de lives no painel ficam no `localStorage` do navegador.
- `src/proxy.ts` renova cookies Supabase e protege paginas; cada API tambem valida a sessao no servidor.

Os pontos sao internos do LiveLoot. Para acumular pontos oficiais, assista conectado a sua conta Twitch/Kick.

## Publicar no Render

O `render.yaml` cria um web service Docker. Configure `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY` no Render; a chave secreta e server-only. `BETTER_AUTH_SECRET` permanece para rollback e `ADMIN_SETUP_TOKEN` e gerado pelo Blueprint. Depois de confirmar o e-mail e entrar, o dono pode usar o token para reivindicar admin.
