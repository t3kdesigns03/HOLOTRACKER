'use client'
// ============================================================
// GlobalNav — one header everywhere, mounted in the root layout.
//   • Logo always returns to the dashboard (/inventory) — never logs out
//   • Auth-aware: full tabs + sign-out when logged in, Sign In when not
//   • Hidden on /login, /onboarding and public /c/* case pages
// src/components/ui/GlobalNav.tsx
// ============================================================

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LayoutGrid, Search, LogOut, TrendingUp, QrCode, LogIn } from 'lucide-react'
import { BrandWordmark } from '@/components/ui/BrandWordmark'

const links = [
  { href: '/inventory', label: 'Inventory',  icon: LayoutGrid  },
  { href: '/search',    label: 'Add Cards',  icon: Search      },
  { href: '/market',    label: 'HoloDex',    icon: TrendingUp  },
  { href: '/cases',     label: 'HoloCases',  icon: QrCode      },
]

// Routes with their own full-screen experience — no global header
const HIDDEN_PREFIXES = ['/login', '/onboarding', '/c/']

/** Small holographic card-stack logo mark */
function LogoMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="htLogoGrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7dd3fc" />
          <stop offset="0.5" stopColor="#818cf8" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      {/* back card */}
      <rect x="8" y="2.5" width="11.5" height="16" rx="2.2"
        transform="rotate(9 13.75 10.5)"
        stroke="url(#htLogoGrad)" strokeWidth="1.5" opacity="0.4" />
      {/* front card */}
      <rect x="3.5" y="5" width="11.5" height="16" rx="2.2"
        transform="rotate(-7 9.25 13)"
        stroke="url(#htLogoGrad)" strokeWidth="1.5" fill="rgba(56,189,248,0.07)" />
      {/* holo sparkle */}
      <path d="M9 9.6 L10 12 L12.4 13 L10 14 L9 16.4 L8 14 L5.6 13 L8 12 Z"
        fill="url(#htLogoGrad)" opacity="0.9" />
    </svg>
  )
}

export function GlobalNav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [authed, setAuthed] = useState<boolean | null>(null) // null = unknown

  useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (mounted) setAuthed(!!user)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (mounted) setAuthed(!!session?.user)
    })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [supabase])

  if (HIDDEN_PREFIXES.some(p => pathname.startsWith(p))) return null
  // Marketing homepage keeps its own CTAs for visitors; header appears once you're signed in
  if (pathname === '/' && authed !== true) return null

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="h-14 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-40 flex items-center px-3 sm:px-4 gap-2 sm:gap-6">
      {/* Logo → dashboard. Never a logout. */}
      <Link
        href={authed ? '/inventory' : '/'}
        title="Back to dashboard"
        className="font-bold text-white text-lg flex items-center gap-2 sm:mr-4 shrink-0"
      >
        <LogoMark />
        <BrandWordmark />
      </Link>

      <div className="flex items-center gap-0.5 sm:gap-1 flex-1 min-w-0 overflow-x-auto">
        {authed && links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0
              ${pathname.startsWith(href)
                ? 'bg-purple-500/20 text-purple-300'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        ))}
      </div>

      {authed === true && (
        <button
          onClick={signOut}
          title="Sign out"
          className="text-zinc-600 hover:text-zinc-400 transition-colors p-1.5 rounded-lg hover:bg-zinc-800 shrink-0"
        >
          <LogOut className="w-4 h-4" />
        </button>
      )}
      {authed === false && (
        <Link
          href="/login"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-sm font-medium text-white transition-colors shrink-0"
        >
          <LogIn className="w-4 h-4" />
          Sign In
        </Link>
      )}
    </nav>
  )
}
