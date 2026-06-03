# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (run in two terminals)
npm run dev:backend      # Express on :3000 with nodemon
npm run dev:frontend     # Vite on :5173, proxies /api → :3000

# First-time setup
npm run install:all      # Install both backend + frontend deps
npm run init-db          # Create SQL Server schema (once)

# Production build
npm run build            # Vite build → frontend/dist/
npm run copy:build       # Windows: copy dist → backend/public/
npm run copy:build:linux # Linux equivalent
npm run start            # Serve production from backend/server.js

# Docker
docker build -t cs-steel-wms .
docker run -p 3000:3000 -e DB_SERVER=... -e DB_USER=... -e DB_PASSWORD=... cs-steel-wms
```

## Architecture

**Full-stack**: React (Vite) frontend + Express backend + SQL Server (mssql).  
In production, Express serves the built React app from `backend/public/` at `/`. All API calls go to `/api/*`.  
In development, Vite dev server (`:5173`) proxies `/api` to `:3000`.

### Backend (`backend/`)

- **Entry**: `backend/server.js` — mounts all routes, serves static frontend, runs alert background job.
- **Routes**: `backend/src/routes/` — one file per feature domain. All protected routes use `authenticate` middleware; admin-only routes also use `requireAdmin`.
- **DB**: `backend/src/config/db.js` — single connection pool via `getPool()`. All queries use parameterized inputs (`.input('Name', sql.Type, value)`).
- **Cache**: `backend/src/utils/cache.js` — in-memory TTL cache with promise coalescing. Use `cache.wrap('key', fn, ttlMs)` to cache; call `cache.del('key')` after mutations.
- **Auth middleware** (`backend/src/middleware/auth.js`): Verifies JWT, caches user lookup for 30 s. `requireAdmin` checks `RoleName === 'Admin'` OR the role has `USERS` permission in `WMS_MenuPermissions`.

### Frontend (`frontend/src/`)

- **Routing**: `App.jsx` — all pages are lazy-loaded. `<ProtectedRoute menuCode="CODE">` guards each route by checking `WMS_MenuPermissions`.
- **Auth**: `AuthContext.jsx` — stores `user`, `permissions` (keyed by `MenuCode`), `token`. Call `hasPermission(code, 'canView'|'canCreate'|'canEdit'|'canDelete')`.
- **API**: `services/api.js` — Axios instance. Interceptors auto-redirect to `/login` on 401, show toast on 403, display global loading bar on every request.
- **i18n**: `LanguageContext.jsx` + `translations/index.js` — use `const { t } = useLang()` everywhere. Add new keys to all three language sections (th/en/my).
- **Layout**: `MainLayout.jsx` manages sidebar collapse state (persisted to `localStorage` as `wms_sidebar_collapsed`). Desktop uses collapsible `Sidebar.jsx`; mobile/tablet uses `BottomNav.jsx` (bottom tab bar with "More" drawer).
- **Styles**: `index.css` defines `.btn-primary`, `.btn-secondary`, `.card`, `.input-field`, `.label`, `.table-header`, `.table-cell`, `.page-title`. Use these classes throughout — don't re-invent them.

### Adding a new feature (full-stack)

1. **Backend route**: `backend/src/routes/feature.js` → export Express router → mount in `server.js` as `app.use('/api/feature', require('./src/routes/feature'))`.
2. **Frontend page**: `frontend/src/pages/Feature.jsx` → add lazy import + `<ProtectedRoute menuCode="FEATURE_CODE">` in `App.jsx`.
3. **Navigation**: Add entry to `menuItems` in `Sidebar.jsx` and `ALL_ITEMS` in `BottomNav.jsx`, and `pageTitles` in `MainLayout.jsx`.
4. **Permissions**: Add `FEATURE_CODE` to the `MENUS` array in `Users.jsx` so admins can grant access to roles.
5. **Translations**: Add all string keys to `translations/index.js` under `th`, `en`, and `my`.

## Database Conventions

- Table prefix: `WMS_` (e.g., `WMS_Users`, `WMS_Trips`, `WMS_Warehouses`).
- Soft-delete via `IsActive = 0`, never hard-delete user-facing records.
- Timestamps: `CreatedAt DATETIME DEFAULT GETDATE()`, `UpdatedAt` updated on writes.
- All query results come back as `result.recordset` (array) or `result.recordset[0]`.
- Schema is initialized by `backend/src/db/init.js` — add new `CREATE TABLE IF NOT EXISTS` blocks there for new tables.

## Key Non-Obvious Patterns

**Permission system is dual-layer**: Frontend `hasPermission()` hides menu items; backend middleware enforces access. Both must be kept in sync when adding a new protected feature.

**Master data warmup**: `AuthContext` pre-fetches vehicle types, warehouses, customers, loading stations, and active trips after login so pages load instantly. If you add a new master entity used across pages, add it to the warmup fetch in `AuthContext.jsx`.

**Cache invalidation**: Every `POST`/`PUT`/`DELETE` route that modifies cached data must call `cache.del('key')` before responding. Missed invalidations cause stale reads.

**`requireAdmin` is async**: The middleware now does a DB lookup for non-Admin roles to check `WMS_MenuPermissions`. Don't convert it back to synchronous.

**Tabs array in `Master.jsx`**: Uses `labelKey` (not `label`). When reading the active tab's display name, use `t(tabs.find(tb => tb.key === tab)?.labelKey || '')`, not `.label`.

## Environment Variables (backend `.env`)

```
PORT=3000
NODE_ENV=development
DB_SERVER=localhost
DB_PORT=1433
DB_USER=sa
DB_PASSWORD=yourpassword
DB_NAME=WMS
JWT_SECRET=change_me_in_production
JWT_EXPIRES_HOURS=24
CORS_ORIGIN=*
DTC_API_URL=            # Optional: GPS tracking API
DTC_API_KEY=            # Optional: GPS tracking key
```

## Deployment (Railway)

Push to GitHub → Railway auto-builds via `Dockerfile` (multi-stage: builds React, copies `dist/` to `backend/public/`, runs `node backend/server.js`). Health check endpoint: `GET /api/health`. See `DEPLOY_GUIDE.md` for full steps.
