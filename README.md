# OutfolioV1

Outfolio is a portfolio and project documentation platform for developers whose
work lives inside platforms that do not preserve a public, visual portfolio of
the finished product. This repository is also the implementation site for a
Master's thesis demonstration of a human-AI lifecycle process.

Traceability: this README summarizes implemented work through:

- Authentication and Session Management: Stories `9543457`, `9543458`,
  `9543459`, `9543460`
- Developer Profile Management: Stories `9543478`, `9543479`, `9543480`,
  `9543481`
- Project Case Study Management: Stories `9543564`, `9543565`, `9543566`,
  `9543567`
- Public Portfolio Viewing Experience: Stories `9543672`, `9543673`,
  `9543674`
- Project Discovery and Browsing: Stories `9543679`, `9543680`, `9543681`

## Current Scope

The implemented application covers:

- Account registration, login, logout, session validation, and protected route
  redirects.
- Authenticated profile viewing and editing, including profile visibility.
- Public developer profiles with only public profile data and published
  projects exposed.
- Project case study creation, editing, draft deletion, publishing, and
  unpublishing.
- Public project pages for published project case studies.
- Discovery browsing for published projects, including project type filtering
  and keyword search.

The next epic is Quality, Deployment and Demo Readiness.

## Tech Stack

- Runtime: Node.js `20.x`
- Package manager: `pnpm`
- Frontend: Next.js 14 app directory with React and TypeScript
- API layer: Express-style route handlers under `src/api/v1`
- ORM: Prisma
- Database/auth provider: Supabase Postgres/Auth
- Browser sessions: NextAuth-compatible session cookie handling
- Tests: Jest, React Testing Library, jsdom

## Important Paths

- `app/register` - registration page and form
- `app/login` - login page and form
- `app/profile` - authenticated profile workspace
- `app/projects` - authenticated project management workspace
- `app/developer/[username]` - public developer profile
- `app/project/[slug]` - public project case study page
- `app/discover` - published project discovery page
- `src/api/v1/auth` - auth/session handlers
- `src/api/v1/profile` - profile handlers
- `src/api/v1/projects` - authenticated project handlers
- `src/api/v1/public` - public project handler
- `src/api/v1/discover` - discovery handlers
- `prisma/schema.prisma` - User, Profile, and Project data model
- `demonstration-log.local.md` - local, gitignored thesis demonstration log

## Environment

Create a local `.env` with the values needed by the runtime:

```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
NEXTAUTH_URL=http://127.0.0.1:3000
NEXTAUTH_SECRET=
```

Unit tests mock external services and do not require live Supabase credentials.
Running the app against real data does require the environment variables above.

## Install

```bash
corepack prepare pnpm@9.12.3 --activate
pnpm install
pnpm prisma generate
```

## Run Locally

```bash
pnpm dev
```

Explicit local host/port:

```bash
pnpm next dev --hostname 127.0.0.1 --port 3000
```

Useful routes:

- `http://127.0.0.1:3000/register`
- `http://127.0.0.1:3000/login`
- `http://127.0.0.1:3000/profile`
- `http://127.0.0.1:3000/projects`
- `http://127.0.0.1:3000/discover`
- `http://127.0.0.1:3000/developer/{username}`
- `http://127.0.0.1:3000/project/{slug}`

## Test

Run the full suite:

```bash
pnpm test
```

Run the production build:

```bash
pnpm build
```

Focused backend checks:

```bash
pnpm test -- tests/api/auth/register.test.ts
pnpm test -- src/api/v1/auth/login.test.ts
pnpm test -- tests/api/v1/auth/session.test.ts
pnpm test -- tests/api/v1/auth/logout.test.ts
pnpm test -- tests/api/profile/me.test.ts
pnpm test -- tests/api/profile/public.test.ts
pnpm test -- tests/api/projects/create.test.ts
pnpm test -- tests/api/projects/get.test.ts
pnpm test -- tests/api/projects/update.test.ts
pnpm test -- tests/api/projects/delete.test.ts
pnpm test -- tests/api/projects/publish.test.ts
pnpm test -- tests/api/projects/unpublish.test.ts
pnpm test -- tests/api/public/project.test.ts
pnpm test -- tests/api/discover/projects.test.ts
```

Focused frontend checks:

```bash
pnpm test -- --testPathPattern=app/register
pnpm test -- --testPathPattern=app/login
pnpm test -- --testPathPattern=app/profile
pnpm test -- --testPathPattern=app/projects
pnpm test -- --testPathPattern='app/developer/\\[username\\]/page.tsx.test.tsx'
pnpm test -- --testPathPattern='app/project/\\[slug\\]/page.tsx.test.tsx'
pnpm test -- --testPathPattern=app/discover/page.tsx.test.tsx
pnpm test -- --testPathPattern=app/providers.tsx.test.tsx
```

Schema/model checks:

```bash
pnpm test -- tests/api/prisma/profile-schema.test.ts
pnpm test -- tests/api/prisma/project-schema.test.ts
```

## Implemented Behavior By Epic

### Authentication and Session Management

- `POST /api/v1/auth/register` registers users with Supabase Auth and stores
  the local User record.
- `POST /api/v1/auth/login` validates username/password and establishes a
  session.
- `GET /api/v1/auth/session` returns authenticated session identity.
- `POST /api/v1/auth/logout` clears the active session.
- Login, registration, profile, and project pages redirect based on session
  state.

### Developer Profile Management

- `GET /api/v1/profile/me` returns the authenticated user's profile.
- `PUT /api/v1/profile/me` updates profile fields with validation.
- Profile visibility supports public, private, and unlisted values in the data
  model.
- `GET /api/v1/profile/public/{username}` exposes public profile data and only
  published projects.
- `/developer/[username]` renders public developer profile information and
  links published projects to their public pages.

### Project Case Study Management

- `POST /api/v1/projects` creates draft project case studies.
- `GET /api/v1/projects` lists the authenticated user's projects.
- `GET /api/v1/projects/{id}` and `PUT /api/v1/projects/{id}` support editing
  owned projects.
- `DELETE /api/v1/projects/{id}` deletes owned draft projects only.
- `POST /api/v1/projects/{id}/publish` publishes valid case studies.
- `POST /api/v1/projects/{id}/unpublish` removes public availability.
- `/projects` and `/projects/[id]` provide project list, create, edit, delete,
  publish, and unpublish flows.

### Public Portfolio Viewing Experience

- `GET /api/v1/profile/public/{username}` returns public developer profiles and
  published projects only.
- `GET /api/v1/public/project/{slug}` returns published project case study
  detail.
- `/project/[slug]` renders public project title, summary, type, role, status,
  tags, cover image, problem, features, technical notes, contribution, and
  outcome.
- Private, draft, or unpublished projects are not exposed publicly.

### Project Discovery and Browsing

- `GET /api/v1/discover/projects` returns published project summaries.
- Discovery results include id, title, slug, summary, and developerName.
- Optional `projectType` filters results by project type.
- Optional `keyword` searches title and summary case-insensitively.
- `/discover` lists published projects and supports project type filtering,
  keyword search, loading, empty, filtered-empty, search-empty, and error states.

## Current Local Verification Baseline

At the latest Story `9543681` verification point:

- `pnpm test` passed: 30 suites, 177 tests.
- `pnpm build` passed.
- `git diff --check` passed.

## Known Local Notes

- The project declares Node `20.x`. Running commands on Node `21.x` currently
  works for tests/build but emits pnpm unsupported-engine warnings.
- Jest/jsdom may emit a Node `DEP0040` punycode deprecation warning under newer
  Node versions; the tests still pass.
- `node_modules`, `.next`, `apex-context-files`, screenshots, `apex.md`, and
  `demonstration-log.local.md` are intentionally ignored by Git.
