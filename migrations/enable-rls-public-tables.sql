-- Enable Row Level Security on public tables that were exposed to anon/authenticated roles.
--
-- Context:
--   - The app accesses Supabase exclusively via SUPABASE_SERVICE_ROLE_KEY (app/lib/db.ts).
--   - service_role bypasses RLS, so enabling RLS without policies will NOT break the app.
--   - This blocks anon/authenticated key access (which the app does not use).
--
-- If a future client ever needs to use anon/authenticated access to these tables,
-- explicit policies must be added at that time.

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_carryover ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glass_client_carryover ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glass_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_cost ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wine_regions ENABLE ROW LEVEL SECURITY;
