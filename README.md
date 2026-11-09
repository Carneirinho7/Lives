# LiveLoot

Painel para abrir canais da Twitch e Kick e conferir o estado dos players. Os pontos oficiais pertencem às plataformas; o LiveLoot não concede nem simula pontos por assistir.

## Banco de dados

Os clientes SSR do Supabase ficam em `frontend/lib/supabase/`. O Auth e o perfil novo usam o projeto `alzrsebcmfqzedegptow`; `public.profiles` tem RLS e nao permite que usuarios alterem pontos ou papel de administrador diretamente. A permissão de execução do antigo RPC de pontos fictícios foi revogada, sem apagar saldos existentes. `.env.local` e ignorado pelo Git.

`DATABASE_URL` ainda aponta para o banco legado e e usado apenas para ler o perfil Better Auth na primeira sessao confirmada. `SUPABASE_SECRET_KEY` e obrigatoria somente no servidor para importar esse perfil uma vez e para a configuracao inicial do administrador. Nunca use essa chave em variavel `NEXT_PUBLIC_`. Mantenha o banco e as tabelas Better Auth antigos durante a validacao; eles nao sao apagados nem migrados destrutivamente.

As senhas Better Auth usam scrypt e nao podem ser importadas diretamente no Supabase Auth. O usuario legado deve criar uma conta com o mesmo e-mail, confirmar o endereco e definir uma nova senha; depois, nome, pontos e papel sao copiados sem apagar o registro antigo. O projeto Supabase esta com confirmacao por e-mail habilitada. Configure no painel do Supabase os redirects `/auth/confirm` para localhost e para o dominio publicado e um SMTP para envio de e-mails em producao.

As migrations em `supabase/migrations/` criam o perfil, RLS, o gatilho de cadastro e o RPC de pontos. `LEGACY_BETTER_AUTH_ENABLED` fica falso por padrao; o codigo e a dependencia Better Auth permanecem como rollback ate a validacao final.

## Variaveis para Vercel

Configure estas variaveis nas Environment Variables do projeto Vercel:

- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: obrigatorias para login, cadastro e sessao.
- `SUPABASE_SECRET_KEY`: obrigatoria no servidor para migrar contas/perfis legados e reivindicar admin. Nunca use o prefixo `NEXT_PUBLIC_`.
- `DATABASE_URL`: conexao com o PostgreSQL legado Better Auth; necessaria enquanto a migracao de contas e perfis estiver habilitada.
- `NEXT_PUBLIC_SITE_URL`: defina a origem HTTPS canonica quando usar dominio proprio. O dominio `VERCEL_URL` gerado pela Vercel e aceito automaticamente.
- `ADMIN_SETUP_TOKEN`: configure se o fluxo de reivindicacao de administrador for usado.
- `BETTER_AUTH_SECRET` e `BETTER_AUTH_URL`: mantenha apenas se precisar do rollback Better Auth; habilite `LEGACY_BETTER_AUTH_ENABLED=true` somente nesse caso.

No Supabase, adicione `/auth/confirm` aos Redirect URLs para cada dominio e configure SMTP antes de depender de confirmacao por e-mail em producao. Nao publique enquanto o fluxo completo de autenticacao/migracao nao estiver validado.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra <http://localhost:3000>. O projeto usa Next.js App Router, React, TypeScript e Tailwind CSS 4.

## Como funciona

- `frontend/components/player-embed.tsx` usa o SDK oficial da Twitch para indicar reprodução/pausa; na Kick informa que o iframe carregou, mas não consegue verificar a reprodução. Nenhum desses estados confirma pontos oficiais.
- `backend/routes/ping.ts` está desativada e retorna `410`; o LiveLoot não concede pontos por tempo de tela ou visibilidade do player.
- `backend/store.ts` contem a lista inicial de lives.
- As alteracoes de lives no painel ficam no `localStorage` do navegador.
- `src/proxy.ts` renova cookies Supabase e protege paginas; cada API tambem valida a sessao no servidor.

Para ganhar pontos oficiais, entre na Twitch ou na Kick e assista pelo canal original. Acompanhe o saldo diretamente no canal; o navegador não fornece ao LiveLoot confirmação confiável desses pontos. O PokeIdle também exige vincular as contas de plataforma para os bônus de live. Não há envio automático de mensagens.

## Publicar no Render

O `render.yaml` cria um web service Docker. Configure `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY` no Render; a chave secreta e server-only. `BETTER_AUTH_SECRET` permanece para rollback e `ADMIN_SETUP_TOKEN` e gerado pelo Blueprint. Depois de confirmar o e-mail e entrar, o dono pode usar o token para reivindicar admin.
