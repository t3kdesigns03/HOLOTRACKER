'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { HeroHoloCard, fetchRandomCard, type HeroCardData } from '@/components/card/HeroHoloCard'

// ─── Login form ───────────────────────────────────────────────────────────────
function LoginForm() {
  const searchParams = useSearchParams()
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [card, setCard] = useState<HeroCardData | null>(null)
  const [cardLoading, setCardLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  const loadCard = useCallback(async () => {
    setCardLoading(true)
    setCard(await fetchRandomCard())
    setCardLoading(false)
  }, [])

  useEffect(() => { loadCard() }, [loadCard])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null); setMessage(null)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        const msg = error.message && error.message !== '{}'
          ? error.message
          : 'Sign in failed. Check your email and password.'
        setError(msg); setLoading(false); return
      }
      router.push('/inventory'); router.refresh()
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        const msg = error.message && error.message !== '{}'
          ? error.message
          : 'Sign up failed — the server returned an error. Check that your Supabase project is active and email signup is enabled.'
        setError(msg); setLoading(false); return
      }
      setMessage('Check your email to confirm your account, then sign in.')
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @keyframes htSkeletonShimmer { 0%,100%{ background-position:-200% 0; } 50%{ background-position:200% 0; } }
        @keyframes htGlowPulse {
          from { filter: drop-shadow(0 0 22px rgba(168,85,247,.55)); }
          to   { filter: drop-shadow(0 0 44px rgba(200,140,255,.9)); }
        }
        .ht-login-grid {
          min-height: 100svh;
          display: grid;
          grid-template-columns: 1fr 1fr;
          background: #04040e;
        }
        .ht-card-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 40px 24px;
          background: radial-gradient(ellipse 80% 70% at 50% 50%, rgba(80,20,160,.25) 0%, transparent 70%);
        }
        .ht-form-col {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 32px;
          border-left: 1px solid rgba(255,255,255,0.04);
        }
        @media (max-width: 768px) {
          .ht-login-grid {
            grid-template-columns: 1fr;
            grid-template-rows: auto 1fr;
          }
          .ht-card-col {
            padding: 32px 24px 16px;
            gap: 10px;
            background: radial-gradient(ellipse 100% 80% at 50% 60%, rgba(80,20,160,.3) 0%, transparent 70%);
          }
          .ht-form-col {
            border-left: none;
            border-top: 1px solid rgba(255,255,255,0.04);
            padding: 28px 24px 40px;
          }
        }
      `}</style>
      <div className="ht-login-grid">

        {/* Top on mobile / Left on desktop — card display */}
        <div className="ht-card-col">
          <HeroHoloCard card={card} loading={cardLoading} />
          <button
            onClick={loadCard}
            disabled={cardLoading}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '0.5px solid rgba(168,85,247,.22)', borderRadius: 20, color: 'rgba(168,85,247,.55)', fontSize: 10, fontFamily: 'system-ui,sans-serif', padding: '4px 10px', cursor: 'pointer' }}
          >
            ↻ {cardLoading ? 'Loading…' : 'New card'}
          </button>
          <p style={{ color: 'rgba(130,90,190,.35)', fontSize: 9, fontFamily: 'system-ui,sans-serif', letterSpacing: '0.08em', marginTop: 0 }}>drag to reveal foil</p>
        </div>

        {/* Bottom on mobile / Right on desktop — form */}
        <div className="ht-form-col">
          <div style={{ width: '100%', maxWidth: 340 }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', fontFamily: 'system-ui,sans-serif', margin: '0 0 6px', background: 'linear-gradient(130deg,#fff 0%,#c084fc 60%,#a855f7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', animation: 'htGlowPulse 3s ease-in-out infinite alternate' }}>
                HoloTracker
              </h1>
              <p style={{ color: 'rgba(160,140,200,.5)', fontSize: 13, fontFamily: 'system-ui,sans-serif', margin: 0 }}>
                {mode === 'signup' ? 'Create your account' : 'Welcome back'}
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com"
                  className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-base placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
                  className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-base placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500" />
              </div>

              {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
              {message && <div className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">{message}</div>}

              <button type="submit" disabled={loading}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-1">
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />{mode === 'login' ? 'Signing in…' : 'Creating account…'}</>
                  : mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>

              <button type="button" onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError(null); setMessage(null) }}
                className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors text-center">
                {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
