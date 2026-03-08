    -- SUPABASE_RLS_AND_LOGS.sql
    -- Create admin_logs table (if missing) and add RLS policies that allow admin users to manage listings
    -- Run this in Supabase SQL Editor as a privileged user (SQL Editor -> Run)

    -- 1) Create admin_logs table used by admin panel activity logger
    CREATE TABLE IF NOT EXISTS public.admin_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id uuid REFERENCES public.profiles(id),
        action text,
        target text,
        details text,
        ip_address text,
        created_at timestamptz DEFAULT now()
    );

    -- 2) Ensure listings has RLS enabled and create a policy that grants full access to admin users
    ALTER TABLE IF EXISTS public.listings ENABLE ROW LEVEL SECURITY;

    -- Policy: allow full access to users whose profile has is_admin = true
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies p
            WHERE p.schemaname = 'public' AND p.tablename = 'listings' AND p.policyname = 'allow_admin_full_access'
        ) THEN
            CREATE POLICY allow_admin_full_access
                ON public.listings
                FOR ALL
                USING (
                    EXISTS (
                        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true
                    )
                );
        END IF;
    END$$;

    -- 3) If your application also requires non-admin users to SELECT their own rows, you may need a separate policy.
    -- Example: allow owners to select/update/delete their own listings
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies p
            WHERE p.schemaname = 'public' AND p.tablename = 'listings' AND p.policyname = 'allow_owner_access'
        ) THEN
            CREATE POLICY allow_owner_access
                ON public.listings
                FOR ALL
                USING (user_id = auth.uid())
                WITH CHECK (user_id = auth.uid());
        END IF;
    END$$;

    -- 4) Enable RLS and policy for admin_logs so admins can insert logs
    ALTER TABLE IF EXISTS public.admin_logs ENABLE ROW LEVEL SECURITY;
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies p
            WHERE p.schemaname = 'public' AND p.tablename = 'admin_logs' AND p.policyname = 'allow_admin_insert'
        ) THEN
            CREATE POLICY allow_admin_insert
                ON public.admin_logs
                FOR INSERT
                WITH CHECK (
                    EXISTS (
                        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true
                    )
                );
        END IF;
    END$$;

    -- 5) Optional: grant anon/select rights depending on your app design. Use caution with open permissions.

    -- Notes:
    -- - Run this SQL from Supabase SQL Editor (requires a user with rights to alter policies/tables).
    -- - After running, test the admin panel again; the 404 on admin_logs should disappear and admin users should be able to DELETE listings.
