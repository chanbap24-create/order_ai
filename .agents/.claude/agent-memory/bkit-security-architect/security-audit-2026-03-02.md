# Security Audit - order-ai (2026-03-02)

Full OWASP Top 10 based audit results. See MEMORY.md for summary.

## Unauthenticated API Routes (Critical)
Only these routes check getSession():
- app/api/auth/me/route.ts
- app/api/auth/password/route.ts
- app/api/sales/expense/file/route.ts

All other ~80 routes are completely open.

## Test/Debug Endpoints in Production
These use NODE_ENV guard but remain in codebase:
- /api/debug-db, /api/debug-alias, /api/debug-client-items
- /api/test-github, /api/test-master-sheet, /api/test-supply-price
- /api/test-method, /api/test-riedel-price, /api/test-pdf

These do NOT have any guard:
- /api/db-tables (lists all database tables)
- /api/db-columns?table=X (reads any table schema + sample data)
