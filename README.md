This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Admin Panel

An authoring panel lives under `/admin`, gated off by default. It writes to
this repo's own `content/` tree, so it targets local development and
self-hosted deployments with a writable filesystem - not read-only
serverless production.

### Enabling it

1. Generate a password hash:

   ```bash
   node -e "const c=require('node:crypto');const s=c.randomBytes(16);const h=c.scryptSync(process.argv[1],s,64,{N:16384,r:8,p:1});console.log(['scrypt',16384,8,1,s.toString('base64'),h.toString('base64')].join('\$'))" 'your-password-here'
   ```

2. Add the following to `.env.local` (see `.env.example` for the full list):

   ```bash
   ANIKI_ADMIN_ENABLED=true
   ANIKI_ADMIN_USERNAME=admin
   ANIKI_ADMIN_PASSWORD_HASH=<output of the command above>
   ANIKI_ADMIN_SESSION_SECRET=<a random string, 32+ characters>
   ANIKI_ADMIN_SESSION_TTL_SECONDS=43200
   ```

3. `npm run dev` (or `npm run build && npm run start`) and sign in at
   `/admin/login`.

### Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `ANIKI_ADMIN_ENABLED` | no | `false` | Must be the literal string `"true"` to turn the panel on at all. |
| `ANIKI_ADMIN_USERNAME` | yes, when enabled | `admin` | The single operator account's username. |
| `ANIKI_ADMIN_PASSWORD_HASH` | yes, when enabled | — | The `scrypt$...` hash from the generator command above. |
| `ANIKI_ADMIN_SESSION_SECRET` | yes, when enabled | — | HMAC key for signing session cookies. Minimum 32 characters. |
| `ANIKI_ADMIN_SESSION_TTL_SECONDS` | no | `43200` (12h) | How long a session cookie stays valid. |

### Fail-closed behaviour

If `ANIKI_ADMIN_ENABLED` isn't exactly `"true"`, or any required secret is
missing or invalid, every `/admin/*` page 404s (not a redirect) and every
`/api/admin/*` request gets a `404` JSON body. A disabled panel and a
misconfigured one are deliberately indistinguishable from the outside, so
neither state advertises that the panel exists at all.

`proxy.ts` only handles redirect UX (anonymous `/admin/*` browser
navigation to `/admin/login`, `401` JSON for anonymous `/api/admin/*`
requests) - it is not the security boundary. Every admin page and every
privileged API route independently calls `requireAdminSession()` and
re-verifies the session itself, per [CVE-2025-29927](https://nextjs.org/blog/cve-2025-29927)
and Next's own guidance that middleware must never be the sole gate on a
privileged route.

### Rate limiting caveat

Login attempts are rate-limited (5 failures per 15 minutes per
username+IP), but the limiter is an in-memory, per-process sliding
window - it resets on restart and is not shared across instances. This
is a real deterrent against credential stuffing on the single-instance
self-hosted deployment this panel targets; it is not a distributed rate
limiter, because this project has no shared state (database, Redis) to
back one with.

### Migration seam

`Claude.md` describes a longer-term GitHub OAuth flow backed by a MongoDB
`users` collection with a manually-promoted `ADMIN` role. Neither MongoDB
nor an OAuth provider exists in this repo yet, so this step ships
env-configured single-operator credentials instead - a real, testable
auth boundary today. The session cookie (`aniki_admin_session`, HMAC-signed,
stateless) and the `requireAdminSession()` call every page and route
already makes are the seam a future OAuth-backed identity provider would
plug into without changing any of the code that consumes a verified
session.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


// add a paragraph about the project
This project is designed to provide a solid foundation for building modern web applications using Next.js. It includes essential configurations and best practices to help developers get started quickly. The project structure is organized to facilitate scalability and maintainability, making it suitable for both small and large applications. With built-in support for server-side rendering, static site generation, and API routes, this project allows developers to create fast, SEO-friendly, and dynamic web experiences.