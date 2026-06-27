'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

// ─── Card fetch ───────────────────────────────────────────────────────────────
interface CardData {
  id: string; name: string; images: { large: string }
  hp?: string; types?: string[]; set: { name: string }
}
const RARITY_QUERIES = [
  'rarity:"Special Illustration Rare"',
  'rarity:"Illustration Rare"',
  'rarity:"Hyper Rare"',
  'rarity:"Ultra Rare"',
]
async function fetchRandomCard(): Promise<CardData | null> {
  try {
    const q = RARITY_QUERIES[Math.floor(Math.random() * RARITY_QUERIES.length)]
    const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&page=${Math.floor(Math.random() * 8) + 1}&pageSize=20&select=id,name,images,hp,types,set`)
    if (!res.ok) return null
    const data = await res.json()
    const cards: CardData[] = data.data ?? []
    return cards.length ? cards[Math.floor(Math.random() * cards.length)] : null
  } catch { return null }
}

// ─── Holo card display ────────────────────────────────────────────────────────
function HeroHoloCard({ card, loading }: { card: CardData | null; loading: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const holoRef = useRef<HTMLDivElement>(null)
  const shimmerRef = useRef<HTMLDivElement>(null)
  const rainbowRef = useRef<HTMLDivElement>(null)
  const foilRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const idleRef = useRef(true)
  const angleRef = useRef(0)

  const typeColor: Record<string, string> = {
    Fire: '#f97316', Water: '#38bdf8', Grass: '#4ade80', Electric: '#fbbf24',
    Psychic: '#c084fc', Dark: '#6366f1', Dragon: '#818cf8', Colorless: '#94a3b8',
    Fighting: '#d97706', Metal: '#94a3b8', Fairy: '#f472b6',
  }
  const glowColor = typeColor[card?.types?.[0] ?? ''] ?? '#a855f7'

  useEffect(() => {
    const scene = sceneRef.current; const wrap = wrapRef.current
    const holo = holoRef.current; const shimmer = shimmerRef.current
    const rainbow = rainbowRef.current; const foil = foilRef.current
    if (!scene || !wrap || !holo || !shimmer || !rainbow || !foil) return

    function idleFloat() {
      if (!idleRef.current) return
      angleRef.current += 0.007
      wrap!.style.transform = `rotateX(${Math.sin(angleRef.current) * 7}deg) rotateY(${Math.cos(angleRef.current * 0.7) * 5}deg)`
      holo!.style.opacity = '0.14'; foil!.style.opacity = '0.45'
      rafRef.current = requestAnimationFrame(idleFloat)
    }
    rafRef.current = requestAnimationFrame(idleFloat)

    function onMove(clientX: number, clientY: number) {
      idleRef.current = false; cancelAnimationFrame(rafRef.current)
      const rect = scene!.getBoundingClientRect()
      const dx = (clientX - rect.left - rect.width / 2) / (rect.width / 2)
      const dy = (clientY - rect.top - rect.height / 2) / (rect.height / 2)
      wrap!.style.transform = `rotateX(${-dy * 24}deg) rotateY(${dx * 24}deg)`
      shimmer!.style.setProperty('--mx', (((clientX - rect.left) / rect.width) * 100).toFixed(1) + '%')
      shimmer!.style.setProperty('--my', (((clientY - rect.top) / rect.height) * 100).toFixed(1) + '%')
      const intensity = Math.sqrt(dx * dx + dy * dy)
      holo!.style.opacity = Math.min(0.3 + intensity * 0.4, 0.75).toFixed(2)
      shimmer!.style.opacity = Math.min(0.45 + intensity * 0.45, 0.95).toFixed(2)
      rainbow!.style.opacity = Math.min(0.35 + intensity * 0.45, 0.85).toFixed(2)
      rainbow!.style.setProperty('--angle', (Math.atan2(dy, dx) * 180 / Math.PI + 135) + 'deg')
      foil!.style.opacity = Math.min(0.55 + intensity * 0.55, 1).toFixed(2)
    }
    const onMouseLeave = () => { idleRef.current = true; shimmer!.style.opacity = '0'; rainbow!.style.opacity = '0'; rafRef.current = requestAnimationFrame(idleFloat) }
    const onTouchEnd = () => { idleRef.current = true; shimmer!.style.opacity = '0'; rainbow!.style.opacity = '0'; rafRef.current = requestAnimationFrame(idleFloat) }
    scene.addEventListener('mousemove', e => onMove(e.clientX, e.clientY))
    scene.addEventListener('mouseleave', onMouseLeave)
    scene.addEventListener('touchmove', e => { e.preventDefault(); onMove(e.touches[0].clientX, e.touches[0].clientY) }, { passive: false })
    scene.addEventListener('touchend', onTouchEnd)
    return () => { cancelAnimationFrame(rafRef.current) }
  }, [])

  return (
    <div ref={sceneRef} style={{ perspective: '1000px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div ref={wrapRef} style={{ transformStyle: 'preserve-3d', transition: 'transform 0.07s ease-out', willChange: 'transform', cursor: 'grab' }}>
        <div style={{ width: 280, height: 390, borderRadius: 18, position: 'relative', overflow: 'hidden', boxShadow: `0 40px 100px ${glowColor}55, 0 0 0 1px rgba(255,255,255,0.13), 0 0 80px ${glowColor}30` }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(145deg,#08081a 0%,#100f2a 40%,#09091f 100%)' }} />
          {card && <img src={card.images.large} alt={card.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 18, transition: 'opacity 0.6s ease' }} />}
          {loading && <div style={{ position: 'absolute', inset: 0, borderRadius: 18, background: 'linear-gradient(90deg, rgba(168,85,247,0.05) 25%, rgba(168,85,247,0.12) 50%, rgba(168,85,247,0.05) 75%)', backgroundSize: '200% 100%', animation: 'htSkeletonShimmer 1.6s ease-in-out infinite' }} />}
          <div ref={foilRef} style={{ position: 'absolute', inset: 0, borderRadius: 18, pointerEvents: 'none', opacity: 0, transition: 'opacity 0.1s', backgroundImage: 'repeating-linear-gradient(108deg, transparent 0px, transparent 2px, rgba(255,255,255,0.022) 2px, rgba(255,255,255,0.022) 3px)' }} />
          <div ref={holoRef} style={{ position: 'absolute', inset: 0, opacity: 0, transition: 'opacity 0.1s', pointerEvents: 'none', background: 'conic-gradient(from 0deg at 50% 50%, #ff006685, #ff6b0085, #ffff0085, #00ff8885, #00b4ff85, #7b2fff85, #ff006685)', mixBlendMode: 'screen', borderRadius: 18 }} />
          <div ref={rainbowRef} style={{ position: 'absolute', inset: 0, borderRadius: 18, opacity: 0, transition: 'opacity 0.1s', pointerEvents: 'none', background: 'linear-gradient(var(--angle,135deg), rgba(255,0,80,0.3), rgba(255,160,0,0.3), rgba(80,255,0,0.3), rgba(0,180,255,0.3), rgba(140,0,255,0.3))', mixBlendMode: 'screen' } as React.CSSProperties} />
          <div ref={shimmerRef} style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 55% 35% at var(--mx,50%) var(--my,50%), rgba(255,255,255,0.22) 0%, transparent 70%)', transition: 'opacity 0.1s' } as React.CSSProperties} />
          {card && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, transparent 100%)', padding: '28px 12px 12px', borderRadius: '0 0 18px 18px', pointerEvents: 'none' }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 8, fontFamily: 'system-ui,sans-serif', letterSpacing: '0.1em', fontWeight: 600, margin: '0 0 2px', textTransform: 'uppercase' }}>{card.set.name}</p>
              <p style={{ color: '#fff', fontSize: 12, fontFamily: 'system-ui,sans-serif', fontWeight: 700, margin: 0, textShadow: `0 0 12px ${glowColor}` }}>{card.name}</p>
            </div>
          )}
          <div style={{ position: 'absolute', inset: 7, border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: 12, pointerEvents: 'none', zIndex: 30 }} />
        </div>
      </div>
    </div>
  )
}

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
  const [card, setCard] = useState<CardData | null>(null)
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
                  className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
                  className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500" />
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
