'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LayoutGrid, Search, LogOut, TrendingUp, QrCode } from 'lucide-react'

const links = [
  { href: '/inventory', label: 'Inventory',  icon: LayoutGrid  },
  { href: '/search',    label: 'Add Cards',  icon: Search      },
  { href: '/market',    label: 'HoloDex',    icon: TrendingUp  },
  { href: '/cases',     label: 'HoloCases',  icon: QrCode      },
]

export function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="h-14 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-40 flex items-center px-4 gap-6">
      <Link href="/inventory" className="font-bold text-white text-lg flex items-center gap-2 mr-4">
        🃏 <span className="text-purple-400">Holo</span>Tracker
      </Link>
      <div className="flex items-center gap-1 flex-1">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${pathname.startsWith(href)
                ? 'bg-purple-500/20 text-purple-300'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}
      </div>
      <button onClick={signOut} className="text-zinc-600 hover:text-zinc-400 transition-colors p-1.5 rounded-lg hover:bg-zinc-800">
        <LogOut className="w-4 h-4" />
      </button>
    </nav>
  )
}
