# SIGB — Sistema Integrado de Gestão Bibliotecária

Aplicação Next.js com TypeScript, Tailwind CSS, TanStack Query, Axios, Lucide e Prisma/PostgreSQL, preparada para o Neon. Criada em `SIGB`, seguindo a organização modular do `dicere-speech-frontend`.

## Situação da entrega

- A demonstração local funciona sem banco, tem dados ilustrativos, alternância de perfil e **não grava operações**.
- A API real, migrações, autenticação, acervo e serviço assíncrono estão implementados.
- A conexão na sua conta Neon e os envios reais dependem de `DATABASE_URL` e de provedores configurados. Nenhuma conta Neon foi criada e nenhuma mensagem real foi enviada.

## Arquitetura

```text
src/app/                         Rotas e composição; Route Handler da API
src/core/@types/                 Contratos da interface
src/core/components/             Componentes próprios reutilizáveis
src/core/features/library/
  components/                    Formulários da funcionalidade
  data/                          Dados explicitamente demonstrativos
  hooks/                         Estado, consultas e mutações TanStack Query
  services/                      Operações HTTP da funcionalidade
  index.tsx                      Composição da interface
src/core/services/api-service.ts Cliente Axios e tratamento de erros
src/core/services/server/        Autenticação, Prisma e regras de negócio
src/core/styles/                 Estilos e responsividade
src/core/utils/                  Cálculos de multa, prazo e retentativa
prisma/                         Schema, migração e seed
scripts/worker.ts                Fila persistente e manutenção periódica
```

Axios é chamado somente pelos serviços, sem acesso direto nos componentes. As permissões são verificadas no servidor; a alternância de perfil existe apenas na demonstração. O banco nunca é acessado pelo navegador.

## Banco Neon e configuração

Crie um projeto PostgreSQL no [Neon](https://console.neon.tech) e copie a connection string com TLS, preferencialmente a opção com pooling para a aplicação. Consulte a [documentação de conexão](https://neon.com/docs/get-started/connect-neon).

Copie `.env.example` para `.env.local` e preencha `DATABASE_URL`. A aplicação e os scripts usam essa variável; não há credenciais embutidas. A migração é versionada em `prisma/migrations`, sem `db push` em produção.

Os comandos já estão preparados:

| Comando                    | Finalidade                                                            |
| -------------------------- | --------------------------------------------------------------------- |
| `npm run dev`              | Desenvolvimento local                                                 |
| `npm run build`            | Gerar Prisma Client e build de produção                               |
| `npm run start`            | Servir o build                                                        |
| `npm run db:migrate`       | Aplicar migrações no banco configurado                                |
| `npm run db:seed`          | Administrador inicial e oito livros                                   |
| `npm run worker`           | Consumir fila, atualizar multas, bloquear atrasos e gerar lembretes   |
| `npm test`                 | Testes das regras de prazo, multa e backoff                           |
| `npm run test:integration` | Testes em PostgreSQL descartável                                      |
| `npm run test:api`         | Testes HTTP contra uma instância local de teste (`SIGB_TEST_API_URL`) |
| `npm run typecheck`        | Validação TypeScript                                                  |

Antes do seed, defina `SEED_ADMIN_PASSWORD` com pelo menos 10 caracteres; `SEED_ADMIN_EMAIL` é opcional (padrão `admin@sigb.local`). O seed não redefine a senha de um administrador existente. Cadastre alunos e bibliotecários pela interface administrativa. A senha inicial de cada usuário é informada pelo administrador; recuperação de senha e cadastro público não foram solicitados e não estão disponíveis.

O serviço web e o worker devem permanecer ativos em produção. Execute o worker como processo separado supervisionado (por exemplo, serviço do provedor de hospedagem). A recepção do webhook apenas persiste o evento e retorna; não depende de manter uma requisição HTTP aberta. O worker verifica manutenção a cada minuto e consome a fila continuamente. Vários workers são compatíveis com o bloqueio de linhas `FOR UPDATE SKIP LOCKED`.

## Perfis e regras

| Operação                                     | Aluno    | Bibliotecário | Admin |
| -------------------------------------------- | -------- | ------------- | ----- |
| Pesquisar acervo e consultar disponibilidade | Sim      | Sim           | Sim   |
| Cadastrar / editar / excluir livros e capas  | Não      | Sim           | Sim   |
| Criar empréstimo próprio                     | Sim      | Não           | Não   |
| Consultar empréstimos                        | Próprios | Todos         | Todos |
| Renovar empréstimo                           | Próprio  | Sim           | Sim   |
| Ajustar prazo / confirmar devolução          | Não      | Sim           | Sim   |
| Gerenciar usuários e perfis                  | Não      | Não           | Sim   |
| Editar dados pessoais                        | Sim      | Sim           | Sim   |

- Cada livro representa **um exemplar físico**, identificado por um código ISBN/código único. Para múltiplos exemplares da mesma obra, use códigos de exemplar diferentes.
- Empréstimo exige sessão válida de aluno cadastrado. Um livro indisponível exibe o alerta e permite voltar à busca.
- Atualização do exemplar, registro do empréstimo e auditoria ocorrem na mesma transação. A alteração condicional da disponibilidade e um índice parcial único impedem empréstimos simultâneos do mesmo exemplar.
- Após a confirmação do interesse pelo aluno, o exemplar fica ocupado e a equipe pode agendar dia/horário de retirada e confirmar a entrega física. A renovação e a devolução exigem retirada confirmada. O registro inicial marca o início do ciclo do empréstimo; o prazo pode ser ajustado pela equipe.
- Prazo inicial: `LOAN_DAYS`, padrão **14 dias**. Uma renovação estende o prazo pelo mesmo intervalo, desde que não haja atraso ou bloqueio; limite de uma renovação adotado por não existir regra mais específica no briefing.
- Multa: `DAILY_FINE_CENTS`, padrão **100 centavos por dia de calendário** em atraso, sem juros compostos. O valor continua aumentando enquanto o exemplar não for devolvido. Configure o fuso de execução como `America/Sao_Paulo`.
- Bloqueio quando a pendência ultrapassa **dois meses de calendário desde o empréstimo**, conforme a redação de RN05. O worker registra o bloqueio e enfileira aviso por e-mail aos bibliotecários.
- A devolução é confirmada pela equipe, consolida a multa e torna o exemplar disponível. O bloqueio não é removido automaticamente; um administrador regulariza a situação após análise.
- Não é possível excluir um livro/usuário com empréstimo ativo. Exclusões são lógicas, preservando relações e histórico.
- O histórico é append-only: trigger PostgreSQL rejeita UPDATE/DELETE na tabela `Audit`. Em produção, use uma credencial de migração separada da credencial da aplicação e não conceda permissões de DDL ao usuário de execução.

## Capas

Upload real de PNG, JPEG ou WebP de até 3 MB. O servidor verifica a assinatura binária e armazena o conteúdo em `Cover.data` (`bytea` no PostgreSQL), junto ao MIME e ao exemplar. `GET /api/books/{id}/cover` exige autenticação. Não é apenas uma URL externa.

As oito ilustrações tipográficas SVG incluídas em `public/covers` foram criadas para este projeto. O seed também armazena seus bytes no banco; uploads de SVG não são aceitos.

## Serviço de notificações

### Recebimento

`POST /webhooks/notificacoes` (também disponível em `/api/webhooks/notificacoes`)

Autorização: `Authorization: Bearer <WEBHOOK_SECRET>`.

```json
{
  "eventKey": "emprestimo-123-prazo-2026-11-01",
  "type": "PRAZO_PROXIMO",
  "recipientIds": ["UUID_DO_USUARIO"],
  "channels": ["EMAIL", "SMS", "WHATSAPP"],
  "message": "Seu prazo de devolução está próximo."
}
```

`recipientIds` define explicitamente o grupo de destinatários. O limite de um evento é 100 destinatários. Os contatos são resolvidos no banco; o corpo do webhook não pode substituir números ou e-mails cadastrados. `eventKey` é a chave de idempotência: reenviar a mesma chave retorna o mesmo evento, sem novos envios. UUIDs são usados para identificação.

Resposta HTTP **202**:

```json
{
  "id_notificacao": "UUID_DA_NOTIFICACAO",
  "status": "PROCESSANDO"
}
```

### Consulta

`GET /notificacoes/{id}` (também `/api/notificacoes/{id}`), com sessão autenticada. Alunos só consultam eventos dos quais são destinatários; equipe consulta todos.

```json
{
  "id_notificacao": "UUID_DA_NOTIFICACAO",
  "status": "ENVIADA",
  "tentativas": 2
}
```

Os estados são `PROCESSANDO`, `ENVIADA`, `FALHA`. `tentativas` é o maior contador dentre as entregas visíveis ao solicitante. O evento fica `ENVIADA` somente quando todas as entregas têm sucesso; fica `FALHA` quando todas terminam e ao menos uma falha. A tela de notificações mostra os canais e seus contadores individuais.

### Retentativas e auditoria

Cada combinação de evento, usuário e canal tem sua própria entrega persistida e no máximo **3 tentativas totais** (a primeira e duas retentativas). Em falhas, a segunda tentativa aguarda 60 segundos e a terceira 120 segundos. A tentativa é registrada **antes** do acesso ao provedor. Resultado, erro e próximo horário ficam no banco; todas as tentativas também geram registros imutáveis em `Audit`.

Um lease de 60 segundos recupera entregas interrompidas. O timeout de acesso ao gateway é 15 segundos. Uma tentativa interrompida conta para o limite. O mesmo ID de entrega é enviado como chave de idempotência a cada tentativa: o gateway deve honrar essa chave para evitar duplicidade quando o envio for aceito antes de uma queda do worker.

Eventos inválidos são rejeitados antes do processamento, com 400/401. Eventos válidos com contato ausente ou provedor não configurado são persistidos e encerrados como falha após as retentativas; nunca são reportados como envio real bem-sucedido.

### Provedores

Configure os pares `EMAIL_PROVIDER_URL`/`EMAIL_PROVIDER_TOKEN`, `SMS_PROVIDER_URL`/`SMS_PROVIDER_TOKEN` e `WHATSAPP_PROVIDER_URL`/`WHATSAPP_PROVIDER_TOKEN`. As URLs devem ser HTTPS.

O adaptador envia ao gateway de cada canal:

```http
POST <CANAL_PROVIDER_URL>
Authorization: Bearer <CANAL_PROVIDER_TOKEN>
Content-Type: application/json
Idempotency-Key: <ID_DA_ENTREGA>
```

```json
{
  "to": "+5511999999999",
  "channel": "WHATSAPP",
  "type": "PRAZO_PROXIMO",
  "message": "Seu prazo de devolução está próximo."
}
```

O gateway deve responder 2xx somente se aceitar o envio e adaptar esse contrato ao fornecedor escolhido. Há suporte ao contrato multicanal; integração direta com APIs específicas de Meta, Twilio ou Resend depende da escolha e credenciais do provedor. Não há envio simulado na API de produção. A aceitação pelo gateway é o critério de `ENVIADA`; confirmação de leitura/entrega do operador não está implementada.

Lembretes automáticos são gerados até três dias antes do prazo e usam e-mail como canal padrão. Webhooks podem escolher qualquer combinação dos três canais. Alterações do prazo geram uma nova chave de lembrete.

## Validação

Build de produção, TypeScript, testes unitários e integração com PostgreSQL local descartável. A integração cobre concorrência pelo mesmo exemplar, permissões de devolução/renovação, multa, persistência do bloqueio mesmo com empréstimo negado, idempotência, multicanalidade, três tentativas, disputa entre workers e rejeição de alterações no histórico.

Para repetir a integração, aplique as migrações em um banco descartável chamado `sigb_test` e defina `SIGB_TEST_DATABASE_URL` para esse banco. O teste cria dados, não apaga tabelas e se recusa a executar sem essa variável/nome. O teste de gateway usa uma resposta local simulada e não transmite mensagens.

As telas foram verificadas no navegador, incluindo busca, detalhes do livro, bloqueio de gravação na demonstração e acesso à gestão de usuários pelo perfil administrador.
