PLAN: Switch backend from Lovable Cloud to external Supabase project

SCOPE
- Disconnect the current Lovable Cloud backend (`qzgblkypqaegpqqvvkzw`).
- Connect your existing external Supabase project as the new backend.
- Migrate the full schema and all production data.
- Update the app and edge functions to use the new project.
- Validate auth, storage, and finance/audit triggers.

ASSUMPTIONS
- You have owner/admin access to the external Supabase project.
- You accept a brief maintenance window while we cut over.
- You want to keep the same app code and data model (no redesign).

STEP-BY-STEP

1. Add the Supabase organization in Lovable (you do this in the UI)
   - Dashboard → + in prompt box → Databases → Add Supabase organization.
   - Grant Lovable access to the organization.
   - This is the only UI step I cannot perform; everything else I can code/migrate.

2. Select the external project as the new backend
   - After the org is linked, choose the project you want to use.
   - Lovable will update the project connection and write new values into `.env`:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_PUBLISHABLE_KEY`
     - `VITE_SUPABASE_PROJECT_ID`
   - Verify the values in `.env` before proceeding.

3. Capture the current production schema
   - Read the full schema from Lovable Cloud (tables, functions, triggers, types, enums, policies, grants).
   - Do the same for RLS policies and storage buckets.

4. Migrate the schema to the new Supabase project
   - Use a single migration against the new project to create:
     - All tables and columns
     - All custom types/enums
     - All functions and triggers
     - All RLS policies and GRANT statements
     - Storage buckets and public settings
   - Avoid any `ALTER DATABASE ...` statements.
   - Re-run the `finance` and `internal_code` triggers/functions as they are today.

5. Migrate data
   - Export production data from Lovable Cloud for all tables (or a targeted dump if you want to exclude test data).
   - Import into the new project.
   - Preserve UUIDs, timestamps, and foreign-key relationships.
   - Rebuild any sequences after import so new inserts do not conflict with existing IDs.

6. Migrate auth users
   - Auth users live in the `auth` schema and are managed by Supabase.
   - If you have admin users, they must be recreated or migrated in the new project.
   - Re-apply `user_roles` and `profiles` rows so admin access works after cutover.

7. Update edge functions and secrets
   - The new project will have its own `SUPABASE_SERVICE_ROLE_KEY` and API keys.
   - Lovable normally updates these secrets automatically when the project connection changes.
   - If not, set them manually via Secrets.
   - No edge function code changes are needed unless the new project URL changes.

8. Verify the cutover
   - Run a build/typecheck.
   - Log in to the admin panel with a migrated admin user.
   - Check that the finance dashboard still reconciles (booking totals vs. finance entries).
   - Confirm product images load from storage.
   - Place a test rental booking and check the checkout flow.

DECISIONS YOU NEED TO MAKE BEFORE WE START
- Project ref/URL of the external Supabase project.
- Whether you want to keep any test data or migrate only production data.
- Whether you want to keep the staging project `rnyimfopoumlntlnzssh` separate (it is not touched in this plan).
- Whether you want to run this migration during a maintenance window or keep the app live.

RISKS
- During the cutover, the published app and admin will be briefly unavailable or may write data to the old backend.
- Auth users and storage files require explicit migration; they do not move automatically with the schema.
- If finance/audit triggers are recreated incorrectly, booking totals and owner payouts could drift.
- Rollback requires pointing `.env` back to Lovable Cloud; any data written to the new project after cutover would be lost on rollback.

RECOMMENDED APPROACH
1. First, add the organization and share the new project details with me.
2. I will run the schema migration on the new project (no data yet).
3. We then migrate data and auth users together.
4. I run a full verification checklist.
5. Only then do we publish the updated app.

Next: confirm the project you want to use and whether you want to proceed in this order. Once confirmed, I will start by building the schema migration.