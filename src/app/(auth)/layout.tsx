import Link from 'next/link'
import { Flame } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-fv-void flex flex-col">
      <div className="px-6 py-5">
        <Link href="/" className="flex items-center gap-2.5 w-fit">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-fv-ember to-fv-gold flex items-center justify-center">
            <Flame className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold text-fv-moon text-sm tracking-wide">First Valley</span>
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        {children}
      </div>
      <div className="text-center py-4 text-xs text-fv-text-dim">
        © 2026 First Valley · <Link href="/pricing" className="hover:text-fv-text-muted transition-colors">Pricing</Link>
      </div>
    </div>
  )
}
