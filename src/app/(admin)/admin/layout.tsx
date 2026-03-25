import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/watch')

  return (
    <div className="flex min-h-screen bg-fv-base">
      <Sidebar isAdmin />
      <div className="flex-1 md:ml-[200px]">
        <div className="h-12 bg-fv-surface border-b border-fv-border flex items-center px-4 md:px-6 gap-3">
          <span className="text-xs text-fv-ember font-display font-semibold tracking-wider uppercase">Admin</span>
          <span className="text-fv-border">·</span>
          <span className="text-xs text-fv-text-muted">First Valley Control Center</span>
        </div>
        <main className="pt-0 min-h-screen">
          {children}
        </main>
      </div>
    </div>
  )
}
