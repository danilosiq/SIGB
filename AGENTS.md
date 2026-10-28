# SIGB

- Não pergunte ao usuário para executar dev, build ou comandos de inicialização. Execute as validações necessárias diretamente.
- Preserve a organização modular de `dicere-speech-frontend`: rotas em `src/app`, features em `src/core/features`, serviços, tipos e componentes próprios separados.
- Axios apenas em serviços; lógica de dados em hooks TanStack Query; regras e Prisma exclusivamente no servidor.
- Componentes nativos shadcn, se adicionados, pertencem a `src/components/ui`; wrappers próprios ficam em `src/core/components`.
- Banco PostgreSQL no Neon com Prisma. Capas precisam de armazenamento binário, não apenas URLs.
- Demonstração sem DATABASE_URL é somente leitura e precisa permanecer identificada.
- Valide permissões no servidor, não só na interface. Nunca aceite role ou userId do cliente para empréstimos de aluno.
- Preserve transações, índice de empréstimo ativo único e histórico append-only.
- Notificações: três tentativas totais por destinatário/canal, backoff crescente e persistência de todas as tentativas. Não execute o worker dentro do ciclo de uma requisição.
- Nunca exponha segredos em NEXT_PUBLIC, logs, argumentos de integração ou código versionado.
- Para integração, use somente banco descartável `sigb_test` e dados fictícios. Provedores reais não devem ser acionados pelos testes.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
