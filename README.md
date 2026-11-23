# MathsMock

A Year 10 Mathematics Paper 1 mock-test app with an open student home page and a protected teacher dashboard.

## Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` (do not overwrite an existing `.env`).
3. Set `MONGODB_URI`, and choose values for `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `AUTH_SECRET`. Use a long, random `AUTH_SECRET` (at least 32 characters).
4. Start the app with `npm run dev`, then open `http://localhost:3000`.

The app connects to the database named by `MONGODB_DB` (defaults to `mathsmock`). It seeds the initial question bank and test settings on first use. Keep `.env` and `.env.local` private; only `.env.example` belongs in source control.

## Access

- `/` is the student page. Students enter a name only; the app creates a secure, HTTP-only browser session behind the scenes.
- `/admin/login` is the teacher sign-in. Credentials are read from the environment, and `/admin` requires a signed session cookie.

If `MONGODB_URI` is not set, the practice flow can be previewed in the browser, but attempts and messages cannot sync to the teacher dashboard. The interface displays this limitation rather than reporting unsaved data as delivered.

## Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```
