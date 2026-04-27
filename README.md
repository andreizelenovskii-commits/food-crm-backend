# Backend

Isolated API-first backend for `food-crm`.

## Run

```bash
cd backend
npm install
npm run dev
```

The backend uses its own `.env` file inside `backend/`.
For local development it also loads the root `.env` as a fallback, so `DATABASE_URL`
and `SESSION_SECRET` can stay in one place.

Required variables:

```bash
DATABASE_URL="postgres://..."
SESSION_SECRET="at-least-32-random-chars"
BACKEND_CORS_ORIGIN="http://localhost:3000,http://127.0.0.1:3000"
```

## Notes

- API prefix: `/api/v1`
- Auth supports both:
  - `Authorization: Bearer <token>`
  - httpOnly session cookie
- Role and permission model lives in `src/modules/access/access-control.ts`
- Current route groups: `auth`, `access`, `dashboard`, `loyalty`, `clients`, `employees`, `orders`, `catalog`, `tech-cards`, `inventory`.
- Backend domain, repositories and DB helpers are copied under `backend/src`; runtime code does not import root `modules/*` or `shared/*`.
