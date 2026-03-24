// Legacy db module - now points to Supabase admin client
// Use @/lib/supabase/admin directly in new code
export { createAdminClient as createDb } from '@/lib/supabase/admin'
