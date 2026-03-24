# Security Architect Memory - order-ai

## Project Profile
- Next.js 16 + TypeScript + Supabase Postgres + Tailwind CSS v4
- Deployed on Vercel, wine/glass order management with AI parsing
- ~80+ API routes under `app/api/`
- Auth: custom HMAC-signed cookie sessions in `app/lib/auth.ts`
- DB: Supabase service_role_key used server-side only via `app/lib/db.ts`

## Key Security Findings (2026-03-02)
See `security-audit-2026-03-02.md` for full report.

### Critical
1. **API routes have NO authentication** - only 3 of ~80+ routes check session
2. **Hardcoded secrets in .env.local** - OpenAI, Anthropic, GitHub, Supabase keys visible
3. **Session signing uses SUPABASE_SERVICE_ROLE_KEY** with hardcoded fallback
4. **db-tables/db-columns APIs expose schema** - no auth, no prod guard

### High
1. No security headers (CSP, HSTS, X-Frame-Options) in next.config.mjs
2. No rate limiting on login endpoint
3. Token has no expiration (only cookie maxAge=30d)
4. Setup endpoint creates users with password "0000"
5. Minimum password length is only 4 characters

### Architecture Notes
- Supabase service_role_key bypasses all RLS (by design for server usage)
- No middleware.ts exists for centralized auth/security
- Debug/test routes use `NODE_ENV === 'production'` guard (inconsistent)
