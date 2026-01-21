# HaccForum

I believe that written articles are very important ways to spread ideas and search for truth. I want to create a platform for people to defend and discuss their ideas with Rich article authoring and discussion platform with hierarchical threads, backed by MongoDB and secured user sessions.

## Prerequisites

- Node.js 18+
- A MongoDB instance (a local Docker container on `mongodb://127.0.0.1:27017` works great)

## Configuration

1. Copy `.env.example` to `.env` and update the values as needed.
	- `MONGODB_URI` should point to your MongoDB (the default works with `docker run -p 27017:27017 mongo`).
	- `JWT_SECRET` must be a strong random string.
	- `CLIENT_ORIGIN` is the URL where Vite serves the frontend (`http://localhost:5173` in dev).
	- `VITE_API_BASE_URL` points the frontend at the API (`http://localhost:4000/api` by default).

## Scripts

```
# start the API server with watch mode
npm run server:dev

# build the API for production (outputs to dist/server)
npm run server:build

# run the compiled API (after server:build)
npm run server:start

# run the Vite dev server
npm run dev

# type-check + build the frontend
npm run build
```

During development, run the API (`server:dev`) and frontend (`dev`) in separate terminals.

## Bootstrapping Users

The first successful call to `POST /api/auth/register` creates an admin user (no authentication required). Further registrations require an authenticated admin request. Use `POST /api/auth/login` to obtain a JWT for subsequent calls.

## API Highlights

- `POST /api/auth/login` → Authenticate and receive a token.
- `GET /api/auth/me` → Fetch current user details.
- `GET /api/articles?parentId=<id>` → List child articles (omit `parentId` for roots).
- `POST /api/articles` → Create an article (admin/editor roles).
- `PATCH /api/articles/:id` → Update with optimistic locking (`version` field).
- `GET /api/articles/:id/revisions` → Review edit history.

Authentication uses a Bearer token (`Authorization: Bearer <token>`). Frontend components call these endpoints automatically after login.

