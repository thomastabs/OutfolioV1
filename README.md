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
- Quality, Deployment and Demo Readiness: Stories `9543689`, `9543686`,
  `9543687`, `9543688`, `9543690`, `9543691`
- Home Dashboard: Stories `9552550`, `9552551`, `9552553`, `9552554`,
  `9552555`, `9552556`
- User Interface and Visual Design: Stories `9552558`, `9552559`, `9552560`,
  `9552561`, `9552562`, `9556465`

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
- Home dashboard at `/`, including product positioning, auth-aware actions, and
  published project highlights.
- Initial visual style guide tokens for typography, spacing, colors, component
  shapes, and form validation states.
- Responsive layout hooks and CSS media-query rules for auth, profile, project
  management, public portfolio, public project, and discovery pages.
- shadcn-style themed UI primitives for buttons, cards, inputs, textareas,
  badges, empty states, validation feedback, and navigation actions.
- Branded color palette, accessible contrast checks, and visual state
  indicators for draft, published, private, unlisted, and unpublished content.
- Accessibility enhancements for keyboard focus, semantic page structure,
  labelled form controls, live validation feedback, and clear empty/error
  states.
- Tailwind CSS, shadcn-style UI primitives, and lucide-react icons powering a
  polished redesign of `/`, `/projects`, `/profile`, `/discover`, public
  developer profiles, and public project pages.

Phase 4 testing has been completed for the full locked 8-epic scope. Phase 5
deployment work is tracked through Apex and the local demonstration log.

## Tech Stack

- Runtime: Node.js `20.x`
- Package manager: `pnpm`
- Frontend: Next.js 14 app directory with React and TypeScript
- Styling/UI: Tailwind CSS, shadcn-style local primitives, lucide-react icons,
  and legacy CSS tokens retained for compatibility during the transition
- API layer: Express-style route handlers under `src/api/v1`, bridged for
  Vercel through `app/api/v1/[...path]/route.ts`
- ORM: Prisma
- Database/auth provider: Supabase Postgres/Auth
- Browser sessions: NextAuth-compatible session cookie handling
- Tests: Jest, React Testing Library, jsdom

## Important Paths

- `/` - home dashboard route
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
- `src/api/v1/home` - home dashboard handler
- `src/api/v1/index.ts` - mounted API v1 Express router and deployment env
  guard
- `app/api/v1/[...path]/route.ts` - Next.js App Router API bridge for
  deployed `/api/v1` routes
- `app/styles` - global visual style guide CSS variables and form styles
- `app/components/ui` - shadcn-style Button, Card, Input, Textarea, and Badge
  primitives used by the polished UI layer
- `.github/workflows/deploy.yml` - GitHub Actions CI/CD workflow for
  production deployment to Vercel
- `tailwind.config.js` and `postcss.config.js` - Tailwind CSS integration for
  Next.js app directory mode
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

For the current Supabase project created for Story `9543690`, use:

```bash
SUPABASE_URL=https://rclasxysrxfqnszkknfy.supabase.co
SUPABASE_ANON_KEY=<project-publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<project-service-role-key>
DATABASE_URL=postgresql://postgres:<database-password>@db.rclasxysrxfqnszkknfy.supabase.co:5432/postgres
NEXTAUTH_URL=<deployed-application-url>
NEXTAUTH_SECRET=<strong-random-secret>
```

Do not commit real `.env` files, database passwords, service-role keys, or
session secrets.

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
pnpm test -- tests/api/home/dashboard.test.ts
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
pnpm test -- app/page.tsx.test.tsx
pnpm test -- --testPathPattern=app/providers.tsx.test.tsx
pnpm test -- tests/api/responsive-layout.test.ts
pnpm test -- tests/api/themed-components.test.ts app/components/EmptyState.test.tsx app/components/ValidationMessage.test.tsx app/components/ui/button.test.tsx app/components/ui/back-button.test.tsx
pnpm test -- tests/api/accessibility-ui.test.ts tests/api/branding.test.ts
pnpm test -- tests/api/ui-polish.test.ts app/components/ui/ui-polish.test.tsx
```

Schema/model checks:

```bash
pnpm test -- tests/api/prisma/profile-schema.test.ts
pnpm test -- tests/api/prisma/project-schema.test.ts
```

Deployment-readiness checks:

```bash
pnpm test -- tests/api/deployment/github-actions-deploy.test.ts
pnpm test -- tests/api/v1/deployment-router.test.ts
pnpm build
```

## Production Deployment

Traceability: this section covers Story `9543690`, deployment technical
requirements DT-1 and DT-3, and runtime requirements RT-1, RT-2, and RT-3.
The repo-local CI/CD workflow added during Phase 5 also traces to Story
`9543457`'s deployment gate and deploy pack.

The real infrastructure delta for Story `9543690` is the API v1 App Router
bridge plus production environment and database migration verification. The
application code now exposes the backend handlers through
`app/api/v1/[...path]/route.ts`, so Vercel can route `/api/v1/*` requests to
the backend handlers.

Required production environment variables:

```bash
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
NEXTAUTH_URL
NEXTAUTH_SECRET
```

If any of those values are missing in production, `/api/v1` returns a
configuration error instead of silently running with placeholder credentials.

Required GitHub Actions repository secrets for `.github/workflows/deploy.yml`:

```bash
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

The workflow runs on pushes to `main` and can also be triggered manually with
`workflow_dispatch`. It installs dependencies with pnpm, generates the Prisma
client, runs the Jest suite, builds the Next.js app, pulls the Vercel
production environment, and deploys to Vercel production with the Vercel CLI.
Supabase and application runtime secrets should remain configured in Vercel,
not committed to this repository.

Recommended deployment preparation:

```bash
corepack prepare pnpm@9.12.3 --activate
pnpm install
pnpm prisma generate
pnpm test
pnpm build
```

Supabase linking commands, once the Supabase CLI is authenticated:

```bash
pnpm dlx supabase login
pnpm dlx supabase init
pnpm dlx supabase link --project-ref rclasxysrxfqnszkknfy
```

In non-interactive shells, `pnpm dlx supabase login` requires either
`--token <access-token>` or a `SUPABASE_ACCESS_TOKEN` environment variable.

Apply database migrations to the Supabase Postgres database only after
`DATABASE_URL` contains the real database password:

```bash
pnpm prisma migrate deploy
```

The Supabase database migrations for Story `9543690` have been applied. The
production deployment cannot be fully verified until the deployment environment
is configured with the required secrets and the deployed `NEXTAUTH_URL`.

## Implemented Behavior By Epic

### Authentication and Session Management

- `POST /api/v1/auth/register` registers users with Supabase Auth and stores
  the local User record.
- `POST /api/v1/auth/login` validates username/password and establishes a
  session.
- `GET /api/v1/auth/session` returns authenticated session identity.
- `GET /api/v1/health` returns a database-free API health response for
  deployment diagnostics.
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

### Home Dashboard

- `GET /api/v1/home/dashboard` returns the Outfolio product name, value
  proposition, authenticated session state, and published project highlights.
- `/` renders the home dashboard instead of a missing page.
- The home dashboard shows register, login, and discovery links to visitors.
- Unauthenticated visitors do not receive user-specific session fields and do
  not see profile or project workspace actions.
- Authenticated developers see profile and project workspace actions.
- The home dashboard checks `GET /api/v1/auth/session` to drive authenticated
  navigation state.
- Published project highlights render as project cards with title, summary, and
  a clean missing-summary fallback.
- Published project empty/error states are handled gracefully, including clear
  visitor navigation when no projects are available.
- Home dashboard navigation links for Register, Login, Discover, Profile, and
  Projects have focused frontend coverage.

## Planned Finishing Epics

Traceability: these epics were added as planned scope after Story `9543690`
deployment readiness and before the final end-to-end validation story. They are
partially implemented where noted below.

### User Interface and Visual Design

Problem: the implemented MVP proves the functional product loop, but the
requirements did not explicitly cover UI/UX polish, visual hierarchy, branding,
responsive layout, or accessibility. Without this epic, the product could be
technically complete but visually generic or hard to use.

Goal: create a cohesive, responsive, accessible Outfolio interface that makes
the portfolio experience feel credible to developers, recruiters, and technical
reviewers without adding new product workflows.

Implementation status: Story `9552558` defines and globally imports the first
visual style guide layer: typography and spacing tokens, color and shape tokens,
and shared form/validation styles. Story `9552559` applies responsive layout
classes and CSS media-query rules across auth, profile editor, project
management, public developer profile, public project, and discovery pages.
Story `9552560` adds reusable themed components and shared state styles for
buttons, text inputs, textareas, navigation links, project cards, empty states,
and validation feedback messages. Story `9552561` applies the Outfolio brand
palette, contrast-tested text and interaction colors, and branded state
indicators for project/profile visibility states.

Candidate stories:

- **Design Visual Style Guide** - Define the MVP visual direction, including
  typography, spacing, color usage, component shape, icon usage, form states,
  validation states, status treatments, and overall interface tone.
- **Implement Responsive Layouts** - Make existing pages work well across
  mobile, tablet, and desktop widths, covering auth, profile, projects, public
  portfolio pages, and discovery.
- **Create Themed UI Components** - Refine common UI patterns such as buttons,
  inputs, textareas, selects, navigation, cards, empty states, loading states,
  validation messages, and status labels.
- **Apply Branding and Color Schemes** - Apply a consistent Outfolio identity,
  including palette, contrast, surface treatment, calls to action, and visual
  cues for draft, published, private, and unlisted states.
- **User Interface Accessibility Enhancements** - Improve keyboard navigation,
  focus visibility, semantic headings, form labels, validation feedback,
  contrast, and screen-reader-friendly empty/error states.

### Home Dashboard

Problem: the deployed domain currently has no root experience. Directly opening
`/` shows a missing page even though the implemented product routes work.

Goal: implement `/` as a useful home dashboard that orients visitors and routes
authenticated developers into the existing Outfolio workflows.

Implementation status: Story `9552550` implements the first Home Dashboard
slice: the root route, dashboard API, auth-aware actions, published project
highlights, empty states, and error handling.

Story `9552551` verifies and constrains the unauthenticated visitor slice:
public dashboard data, unauthenticated session state, visitor navigation, and
no profile/project workspace links for visitors.

Story `9552553` verifies and implements the authenticated developer slice:
the home page checks `GET /api/v1/auth/session`, shows profile/project
workspace links for logged-in developers, and hides Register/Login actions.

Story `9552554` verifies and implements the published project highlights slice:
the home dashboard uses `GET /api/v1/home/dashboard`, relies on the backend's
published-only Prisma query, renders highlight cards, and shows registration
and discovery actions when there are no published highlights.

Story `9552555` verifies the no-projects empty state slice: the dashboard API
returns an empty `publishedProjects` array, unauthenticated users keep
Register/Login/Discover navigation, and no project-card placeholder UI appears
when no projects exist.

Story `9552556` verifies the home navigation-link slice: unauthenticated links
target `/register`, `/login`, and `/discover`; authenticated links target
`/profile` and `/projects`; and click interactions are covered in frontend
tests.

Candidate stories:

- **Create Home Dashboard Route** - Implement `/` as a dashboard with product
  identity, concise value proposition, and navigation to public and
  authentication flows.
- **Add Auth-Aware Home Dashboard Actions** - Show register, login, and
  discover actions to visitors; show profile and project workspace actions to
  authenticated developers.
- **Show Published Project Highlights** - Display a small set of published
  project highlights or recent public portfolio entries, preferably reusing
  existing discovery/public project data.
- **Handle Empty Home Dashboard States** - Keep the dashboard useful and
  polished when no published projects exist yet.
- **Connect Home Dashboard Navigation to Core Flows** - Verify dashboard links
  route correctly to `/register`, `/login`, `/profile`, `/projects`,
  `/discover`, `/developer/{username}`, and `/project/{slug}` where
  appropriate.

## Current Local Verification Baseline

At the latest Story `9552561` local verification point:

- `pnpm test -- tests/api/branding.test.ts app/projects/ProjectList.test.tsx app/profile/page.tsx.test.tsx --runInBand`
  passed: 3 suites, 20 tests.
- `pnpm test -- --runInBand` passed: 48 suites, 253 tests.
- `pnpm build` passed.
- `git diff --check` passed.
- `pnpm prisma migrate deploy` passed against the linked Supabase database.
- Full deployed-app verification is pending a production deployment URL and
  host-side environment variable configuration.

## Known Local Notes

- The project declares Node `20.x`. Running commands on Node `21.x` currently
  works for tests/build but emits pnpm unsupported-engine warnings.
- Jest/jsdom may emit a Node `DEP0040` punycode deprecation warning under newer
  Node versions; the tests still pass.
- `node_modules`, `.next`, `apex-context-files`, screenshots, `apex.md`, and
  `demonstration-log.local.md` are intentionally ignored by Git.
