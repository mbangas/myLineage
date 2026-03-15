# Arquitectura do Sistema — myLineage SaaS Multi-Tenant

**Requisito:** `01 — Plan myLineage SaaS Multi-Tenant Transformation`  
**Versão:** 2.0.0  
**Data:** 15/03/2026  
**Plataforma:** Node.js 18+ / Express 4 / PostgreSQL 16 / Docker

---

## Visão Geral

O **myLineage** é uma plataforma web SaaS multi-tenant de genealogia compatível com **GEDCOM 7.0**. Permite gerir múltiplas árvores genealógicas, com isolamento de dados por árvore (_tenant_), autenticação JWT com 2FA (TOTP), controlo de acesso baseado em funções (RBAC), e convites por email.

---

## Diagrama de Arquitectura de Alto Nível

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (HTML + JS)                          │
│                                                                     │
│  landing.html  app.html  arvore.html  album.html  admin.html  ...   │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │ auth.js  │  │remote-       │  │tree-         │                  │
│  │ (JWT)    │  │storage.js    │  │switcher.js   │                  │
│  └──────────┘  │(window.      │  │(selector UI) │                  │
│                │GedcomDB)     │  └──────────────┘                  │
│                └──────────────┘                                     │
└───────────────────────────┬─────────────────────────────────────────┘
                            │  HTTPS — fetch REST (Authorization: Bearer <JWT>)
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       server.js (Express 4)                         │
│                                                                     │
│  ┌──────────────┐  ┌─────────────────┐  ┌─────────────────────┐    │
│  │ authMiddlware│  │ treeAuth        │  │ requireAdmin /      │    │
│  │ (JWT verify) │  │ Middleware      │  │ requireTreeRole     │    │
│  └──────────────┘  │ (RBAC check)   │  └─────────────────────┘    │
│                    └─────────────────┘                              │
│  ┌─────────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ /api/auth/* │  │/api/     │  │/api/     │  │ /api/admin/*   │  │
│  │ (público)   │  │trees/*   │  │trees/    │  │ (admin only)   │  │
│  └─────────────┘  └──────────┘  │:treeId/* │  └────────────────┘  │
│                                  └──────────┘                       │
│  ┌─────────────────────┐  ┌────────────────┐  ┌──────────────────┐ │
│  │/api/invitations/*   │  │/api/           │  │/uploads/:treeId/ │ │
│  │(público + authed)   │  │notifications/* │  │(ficheiros est.)  │ │
│  └─────────────────────┘  └────────────────┘  └──────────────────┘ │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
          ┌─────────────────┬┴──────────────────┐
          ▼                 ▼                   ▼
┌─────────────────┐  ┌──────────────┐  ┌───────────────┐
│  PostgreSQL 16  │  │  ./uploads/  │  │  ./JSON-DATA/ │
│  (porta 5433)   │  │  (ficheiros  │  │  (modo legacy │
│                 │  │   por árvore)│  │   / testes)   │
└─────────────────┘  └──────────────┘  └───────────────┘
```

---

## Backend

### Ponto de Entrada

- **`server.js`**
  - Inicializa Express, middleware CORS, `express.json` (limite 50 MB)
  - Regista todas as rotas por ordem de precedência (públicas → autenticadas → tree-scoped)
  - Executa migrações ao arranque (quando `DATABASE_URL` definido)
  - Semeia o utilizador admin a partir de variáveis de ambiente
  - Gestão de shutdown gracioso (`SIGTERM`/`SIGINT`)
  - Endpoint de diagnóstico: `GET /api/info`

---

### Módulos de Biblioteca (`lib/`)

| Módulo | Responsabilidade | Dependências |
|---|---|---|
| `lib/db.js` | Pool de ligações PostgreSQL (singleton), wrapper `query()` | `pg` |
| `lib/auth-middleware.js` | Hash bcrypt, geração/verificação de JWT, `authMiddleware`, `requireAdmin`, `requireRole()` | `bcrypt`, `jsonwebtoken` |
| `lib/tree-auth.js` | `treeAuthMiddleware` (valida membership por treeId), `requireTreeRole()` | `lib/db.js` |
| `lib/crud-helpers.js` | CRUD dual-mode (PostgreSQL ↔ JSON), `readCollection`, `writeCollection`, `writeEntity`, `deleteEntity`, `nextId` | `lib/db.js` |
| `lib/gedcom-parser.js` | Parser GEDCOM 7 → JSON (INDI, FAM, OBJE, SOUR, REPO, NOTE, SUBM) | `lib/crud-helpers.js` |
| `lib/gedcom-builder.js` | JSON → texto GEDCOM 7 (export) | — |
| `lib/email.js` | Envio de emails via Nodemailer (SMTP configurável por env vars) | `nodemailer` |

---

### Rotas (`routes/`)

#### `routes/auth.js` — Autenticação (público)
- `POST /register` — criação de conta
- `POST /login` — credenciais → tokens (ou passo TOTP)
- `POST /login/totp` — verificação do código TOTP → tokens
- `POST /refresh` — renovação do access token
- `POST /logout` — (client-side; sem blacklist actual)
- `GET  /me` — perfil do utilizador autenticado
- `PUT  /me` — atualizar nome / email
- `PUT  /me/password` — alterar password
- `POST /totp/setup` — gerar segredo TOTP + URI QR
- `POST /totp/verify` — confirmar primeiro código TOTP
- `DELETE /totp` — desativar 2FA

#### `routes/trees.js` — Gestão de Árvores (autenticado)
- `POST   /` — criar árvore (criador torna-se owner)
- `GET    /` — listar árvores do utilizador (admin vê todas)
- `GET    /:treeId` — detalhes da árvore
- `PUT    /:treeId` — atualizar nome/descrição (owner)
- `DELETE /:treeId` — eliminar árvore e todos os dados (owner)
- `GET    /:treeId/members` — listar membros
- `POST   /:treeId/members` — adicionar membro (owner)
- `PUT    /:treeId/members/:userId` — alterar role (owner)
- `DELETE /:treeId/members/:userId` — remover membro (owner)

#### `routes/genealogy.js` — Dados Genealógicos (tree-scoped)
- `GET/POST /{collection}` — CRUD de coleções (individuals, families, sources, repositories, multimedia, notes, submitters, historical-facts)
- `GET/PUT/DELETE /{collection}/:id` — CRUD por entidade
- `POST /bulk-replace` — substituição em massa de coleções
- `GET/PUT /header` — cabeçalho GEDCOM
- `GET/PUT/DELETE /settings` — definições da árvore
- `GET/POST/DELETE /history` — histórico de auditoria
- `GET /stats` — estatísticas da árvore
- `GET /gedcom/export` — exportar GEDCOM 7
- `POST /gedcom/import` — importar GEDCOM 7
- `POST /upload` — upload de ficheiro multipart (multer)
- `GET /multimedia/cache-status` — estado do cache de imagens externas
- `POST /multimedia/cache-retry` — re-tentativa de download externo
- `POST /multimedia/refresh-zones` — regenerar zonas de marcação de pessoas
- `GET /topola-json` — dados no formato Topola
- `GET /surname-research/:surname` — pesquisa de apelido (Wikipedia + Wikidata)

#### `routes/invitations.js` — Convites
- `POST /api/trees/:treeId/invitations` — enviar convite (owner)
- `GET  /api/trees/:treeId/invitations` — listar convites da árvore
- `GET  /api/invitations` — convites pendentes do utilizador
- `POST /api/invitations/:id/accept` — aceitar convite
- `POST /api/invitations/:id/decline` — recusar convite
- `GET  /api/invitations/by-token/:token` — público: detalhes por token

#### `routes/notifications.js` — Notificações
- `GET /` — listar notificações do utilizador
- `GET /unread-count` — contagem não lidas
- `PUT /:id/read` — marcar como lida
- `PUT /read-all` — marcar todas como lidas

#### `routes/admin.js` — Administração (admin only)
- `GET /stats` — estatísticas agregadas da plataforma
- `GET /users` — listar utilizadores (paginado)
- `GET /trees` — listar árvores (paginado)
- `GET /logins` — auditoria de logins (últimos N registos)

---

### Migrações (`migrations/`)

- `001_initial_schema.js` — schema completo (tabelas, índices, seed)
- `002_seed_legacy_tree.js` — tree legado (UUID `00000000-…`)
- `run.js` — executor de migrações ordenado, idempotente

---

## Base de Dados (PostgreSQL 16)

### Diagrama de Tabelas

```
users
├── id (UUID PK)
├── email UNIQUE
├── password_hash
├── name
├── totp_secret / totp_verified
├── is_admin
└── created_at / updated_at

trees
├── id (UUID PK)
├── name / description
├── owner_id → users.id
└── created_at / updated_at

tree_memberships
├── id (UUID PK)
├── tree_id → trees.id
├── user_id → users.id
├── role  CHECK('owner','writer','reader')
└── UNIQUE(tree_id, user_id)

genealogy_records                ← núcleo dos dados multi-tenant
├── id (UUID PK)
├── tree_id → trees.id
├── collection VARCHAR(50)        (individuals, families, …)
├── entity_id  VARCHAR(50)        (I1, F2, M3, …)
├── data JSONB                    (estrutura GEDCOM 7)
├── created_at / updated_at / deleted_at
└── UNIQUE(tree_id, collection, entity_id)

invitations
├── id / tree_id / inviter_id / invitee_email
├── role / status / token UNIQUE
└── expires_at / responded_at

notifications
├── id / user_id / type / data JSONB / read
└── created_at

tree_settings
├── tree_id / key (PK composta)
└── value JSONB

tree_history
├── id / tree_id / data JSONB
└── created_at

login_audit
├── id / user_id / ip / user_agent / success
└── created_at
```

### Índices Relevantes

- `(tree_id, collection)` — leitura de coleção completa
- `(tree_id, collection, entity_id)` — acesso por ID
- `(user_id)` em `tree_memberships`
- `(token)` em `invitations`
- `(user_id, read)` em `notifications`
- `(user_id, created_at DESC)` em `login_audit`

### Modo Dual (fallback JSON)

Quando `DATABASE_URL` não está definido, `lib/crud-helpers.js` redireciona todas as operações para ficheiros JSON em `./JSON-DATA/` (um ficheiro por coleção). Usado em testes unitários e desenvolvimento sem Docker.

---

## Frontend

### Páginas Principais

| Página | Módulo | Descrição |
|---|---|---|
| `login.html` | Auth | Email + password; fluxo TOTP |
| `register.html` | Auth | Registo de nova conta |
| `setup.html` | Auth | Configuração inicial 2FA (admin) |
| `landing.html` | Trees | Minhas árvores, partilhadas, convites pendentes |
| `invite.html` | Invites | Aceitação/recusa de convite por token |
| `index.html` | Dashboard | Boas-vindas, atalhos rápidos |
| `app.html` | Cadastro | CRUD de indivíduos |
| `arvore.html` | Visualização | Árvore interativa (Topola + family-chart) |
| `indicadores.html` | Stats | Gráficos e totais |
| `gedcom.html` | GEDCOM | Import/export `.ged` |
| `album.html` | Multimédia | Galeria OBJE, marcação de zonas |
| `documentos.html` | Documentos | Biblioteca PDF/imagem/vídeo/áudio |
| `historico.html` | Auditoria | Registo de alterações |
| `validacao.html` | Qualidade | Análise de consistência GEDCOM |
| `configuracao.html` | Definições | Configurações gerais |
| `tree-settings.html` | Trees | Membros, convites, eliminar árvore |
| `admin.html` | Admin | Painel administração (users, trees, logins) |
| `apis.html` | Docs | Referência interativa dos endpoints |

### Scripts Globais (injetados em todas as páginas)

| Ficheiro | Responsabilidade |
|---|---|
| `auth.js` | JWT em `localStorage`, refresh automático, wrapper `fetch` com `Authorization: Bearer` |
| `remote-storage.js` | `window.GedcomDB` — abstração de todos os acessos REST tree-scoped com `currentTreeId` |
| `tree-switcher.js` | Injeta seletor de árvore ativa no topbar |
| `notifications.js` | Injeta sino de notificações; polling a cada 60 s |
| `history-logger.js` | Envolve mutações do `GedcomDB`; regista auditoria via `POST /history` |
| `back-to-top.js` | Botão de scroll para o topo |
| `help-menu.js` | Menu de ajuda contextual |

### Bibliotecas de Visualização (bundles pré-compilados)

| Bundle | Biblioteca | Uso |
|---|---|---|
| `topola-bundle.js` | topola 3.x | Árvore em `arvore.html` |
| `family-chart-bundle.js` | family-chart 0.9 | Variante de chart interativo |
| `qrcode-bundle.js` | qrcode | QR Code para URI TOTP |
| `livro-bundle.js` | page-flip | Visualização de livro em `livro.html` |

---

## Segurança e Controlo de Acesso

### Fluxo de Autenticação

```
[Browser]                    [server.js]               [PostgreSQL]
    │                             │                          │
    │── POST /api/auth/login ────►│                          │
    │   { email, password }       │── SELECT users ─────────►│
    │                             │◄──────────────────────── │
    │                             │  bcrypt.compare()        │
    │                             │                          │
    │  (se 2FA activo)            │                          │
    │◄── { requires2FA: true } ───│                          │
    │── POST /api/auth/login/totp►│                          │
    │   { userId, code }          │  verifyTotp() (HMAC-SHA1)│
    │                             │  ±1 janela de 30s        │
    │                             │── INSERT login_audit ───►│
    │◄── { accessToken (15m),     │                          │
    │      refreshToken (7d) } ───│                          │
    │                             │                          │
    │── GET /api/... ────────────►│                          │
    │   Authorization: Bearer ... │  verifyAccessToken()     │
    │                             │  → req.user              │
    │                             │── SELECT tree_memberships►│
    │                             │  → req.treeRole          │
```

### Níveis de Acesso (RBAC)

```
admin  ──► acesso total (bypass de todas as tree_memberships)
  │
owner  ──► gestão da árvore (membros, convites, eliminar)
  │
writer ──► leitura + escrita de dados genealógicos
  │
reader ──► apenas leitura
```

### Cadeia de Middleware por Rota

```
request
  └─► authMiddleware          (verifica JWT)
        └─► treeAuthMiddleware (verifica membership → req.treeRole)
              └─► requireTreeRole('owner','writer')  (autorização)
                    └─► handler da rota
```

---

## Infraestrutura e Deploy

### Diagrama Docker

```
┌────────────────────────────────────────────────┐
│              docker-compose.yml                │
│                                                │
│  ┌──────────────────────┐  ┌────────────────┐  │
│  │  mylineage (app)     │  │ mylineage-db   │  │
│  │  Node.js 18          │  │ PostgreSQL 16  │  │
│  │  porta: 3000         │  │ porta: 5433    │  │
│  │                      │  │                │  │
│  │  volumes:            │  │  volumes:      │  │
│  │  - ./JSON-DATA       │  │  - pgdata      │  │
│  │  - ./uploads         │  │                │  │
│  └──────────────────────┘  └────────────────┘  │
│              depends_on: postgres (healthy)     │
│                                                │
│  Variáveis de Ambiente:                        │
│  DATABASE_URL, JWT_SECRET, ADMIN_EMAIL,        │
│  ADMIN_PASSWORD, APP_URL,                      │
│  SMTP_HOST/PORT/USER/PASS/FROM                 │
└────────────────────────────────────────────────┘
```

### Volumes Persistentes

| Volume | Conteúdo | Persistência |
|---|---|---|
| `pgdata` | Dados PostgreSQL | Obrigatória |
| `./uploads` | Ficheiros multimédia por árvore (`uploads/<treeId>/fotos/`) | Obrigatória |
| `./JSON-DATA` | Dados JSON legados / ficheiros de migração | Migração |

---

## Máquinas de Estado

### Estados de um Convite

```
[pendente] ──aceitar──► [aceito]
           ──recusar──► [recusado]
           ──expirar──► [expirado]   (expires_at < NOW)
```

### Estados de Autenticação (Frontend)

```
[sem sessão]
    │ login OK (sem 2FA)
    ▼
[autenticado]  ◄── refresh automático (a cada pedido com 401)
    │ token expirado + refresh inválido
    ▼
[sem sessão] ──► redirect login.html
```

### Fluxo TOTP (Admin)

```
[1.º login admin]
    │ totp_verified = FALSE
    ▼
[forçar setup] ──► POST /totp/setup ──► gerar secret + URI QR
    │ utilizador configura autenticador
    ▼
[verificar] ──► POST /totp/verify ──► totp_verified = TRUE
    │
    ▼
[logins seguintes]: POST /login → requires2FA → POST /login/totp → tokens
```

---

## Ciclo de Vida dos Dados Genealógicos

```
import GEDCOM              CRUD UI (app.html)
     │                            │
     ▼                            ▼
parseGedcomToJson()    POST /individuals, /families, …
     │                            │
     └──────────┬─────────────────┘
                ▼
         writeCollection()
         writeEntity()     ──► genealogy_records (JSONB)
                ▲                      │
                │               (soft-delete: deleted_at)
         readCollection()              │
                │               GET /individuals?includeDeleted=true
                ▼
         buildGedcomText() ──► export .ged
```

---

## Testes

| Camada | Localização | Âmbito |
|---|---|---|
| Unitários | `tests/unit/` | CRUD de cada coleção (modo JSON), GEDCOM parser/builder |
| Integração | `tests/integration/` | Auth flow, GEDCOM roundtrip, API flow completo, trees flow |
| E2E | `tests/e2e/` | Script bash contra servidor em execução |
| Helpers | `tests/helpers/setup.js` | Ambiente isolado (tmpDir, JWT de teste) |

Executor: **Jest 29** com `supertest`. Timeout: 15 s. Cobertura em `lib/**` e `server.js`.

---

## Dependências Externas em Runtime

| Serviço | Protocolo | Obrigatoriedade | Uso |
|---|---|---|---|
| PostgreSQL 16 | TCP 5432 | Recomendado (fallback JSON) | Armazenamento principal |
| SMTP | TCP 587/465 | Opcional | Envio de convites |
| Wikipedia REST API | HTTPS | Opcional | Pesquisa de apelidos |
| Wikidata API | HTTPS | Opcional | Brasões de armas |
| Wikimedia Commons | HTTPS | Opcional | Imagens de brasões |

---

*Gerado automaticamente em 15/03/2026 a partir do requisito `01 — Plan myLineage SaaS Multi-Tenant Transformation`.*
