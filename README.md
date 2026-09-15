# OutfolioV1
Outfolio is a public portfolio and project documentation platform where OutSystems developers can showcase their work. This will be used for my thesis demonstration, so a more simpler version of it will be developed

For the simplified Outfolio scope, we'll focus on 6 epics and roughly 18 user stories.
That is enough to exercise Apex properly without turning the project back into the larger original vision.

Recommended Epics:

1. Authentication & Session
   - Register account
   - Log in
   - Maintain authenticated session
   - Redirect/protect authenticated pages
2. Developer Profile
   - View own profile
   - Edit profile details
   - Manage profile visibility
   - View public developer profile
3. Project Case Studies
   - Create project case study
   - Edit project case study
   - Delete draft project
   - Publish/unpublish project
4. Public Portfolio Experience
   - Show published projects on public profile
   - View public project page
   - Hide private/unpublished projects from public visitors
5. Discovery / Browse
   - Browse published projects
   - Filter or search published projects by simple criteria, if time allows
6. Quality, Deployment & Demo Readiness
   - Add backend tests for auth/profile/project visibility
   - Add frontend tests for key forms and public pages
   - Prepare deployment configuration
   - Validate production demo flow

---

## Local Development

Traceability: this scaffold currently implements Story `9543457` - User
Registration for Epic `367615` - Authentication and Session Management.

### Runtime

- Node.js: `20.x`
- Package manager: `pnpm`
- Frontend/runtime: Next.js 14 app directory
- API layer: Express 4 route handlers under `src/api/v1`
- Database ORM: Prisma
- Auth foundation: Supabase Auth for credentials, NextAuth session cookies for
  browser sessions

The registration page is available at:

```bash
http://127.0.0.1:3000/register
```

### Install

```bash
corepack prepare pnpm@9.12.3 --activate
pnpm install
pnpm prisma generate
```

### Environment

Live registration needs these environment variables before the API can create
real users:

```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
NEXTAUTH_URL=http://127.0.0.1:3000
NEXTAUTH_SECRET=
```

The unit tests mock Supabase, Prisma, and session creation, so they do not need
live credentials.

### Run Locally

```bash
pnpm dev
```

To bind explicitly to the local URL used during scaffold verification:

```bash
pnpm next dev --hostname 127.0.0.1 --port 3000
```

### Test

Run the full test suite:

```bash
pnpm test
```

Run the Story `9543457` Developer Pack checks:

```bash
pnpm test -- tests/api/auth/register.test.ts
pnpm test -- --testPathPattern=app/register
pnpm test -- --testPathPattern=app/register/page.tsx
```

Current coverage includes:

- `EP-1` registration API success, duplicate username/email, and validation
  failure cases.
- `SCR-1` registration form rendering, client validation, API error display,
  loading state, duplicate-submit prevention, and success callback.
- `SCR-3` registration-page redirect behavior for authenticated, loading,
  unauthenticated, and post-registration states.

### Build

```bash
pnpm build
```

### Known Local Notes

- The project declares Node `20.x`. Running commands on Node `21.x` currently
  works for tests/build but emits pnpm unsupported-engine warnings.
- Jest/jsdom may emit a Node `DEP0040` punycode deprecation warning under newer
  Node versions; the tests still pass.
- `node_modules`, `.next`, `apex-context-files`, screenshots, `apex.md`, and
  `demonstration-log.local.md` are intentionally ignored by Git.
