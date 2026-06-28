# Backend

Isolated API-first backend for `food-crm`.

## Run

Recommended one-command local workflow from the frontend repo:

```bash
cd ../food-crm-dev
npm run local:setup
npm run local:dev
```

See `../food-crm-dev/docs/LOCAL_DEVELOPMENT.md`.

Manual backend-only run:

```bash
npm ci
cp .env.example .env
npx prisma generate
npm run db:deploy
npm run typecheck
npm test
npm run dev
```

Check:

```bash
curl http://127.0.0.1:4000/api/v1/health
```

The backend uses its own `.env` file in the repository root. For local
development it also loads `../.env` as a fallback, so `DATABASE_URL` and
`SESSION_SECRET` can stay one level above the backend repo when needed.

Required variables:

```bash
DATABASE_URL="postgres://..."
SESSION_SECRET="at-least-32-random-chars"
BACKEND_CORS_ORIGIN="http://localhost:3000,http://127.0.0.1:3000"
```

Before running `npm run db:deploy`, make sure `DATABASE_URL` points to an
available PostgreSQL database.

## Notes

- API prefix: `/api/v1`
- Branch flow: `feature branch -> dev -> staging -> main -> production`. In this repo CI runs on PRs and pushes to `dev`; deploy runs from `dev` to staging and from `main` to production.
- Order business rules: `docs/ORDER_BUSINESS_RULES.md`
- Inventory business rules: `docs/inventory-rules.md`
- Auth supports both:
  - `Authorization: Bearer <token>`
  - httpOnly session cookie
- Role and permission model lives in `src/modules/access/access-control.ts`
- Current route groups: `auth`, `access`, `dashboard`, `loyalty`, `clients`, `employees`, `orders`, `catalog`, `tech-cards`, `inventory`.
- Backend domain, repositories and DB helpers are copied under `backend/src`; runtime code does not import root `modules/*` or `shared/*`.
