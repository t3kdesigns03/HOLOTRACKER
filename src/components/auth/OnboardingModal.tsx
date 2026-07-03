'use client'
// ============================================================
// OnboardingModal — profile setup on first login.
// Split layout matching /login: holo card hero + clear form.
// Self-contained styling (no dependency on globals-additions).
// src/components/auth/OnboardingModal.tsx
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Check, X, User, AtSign, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { HeroHoloCard, fetchRandomCard, type HeroCardData } from '@/components/card/HeroHoloCard'

const USERNAME_RE = /^[a-z0-9_-]{3,24}$/

// 16px font on inputs is deliberate — anything smaller makes iOS zoom the
// viewport on focus. Do not shrink below text-base.
const INPUT_CLASS = `w-full px-3.5 py-3 bg-zinc-900 border border-zinc-700 rounded-xl
  text-white text-base placeholder:text-zinc-600
  focus:outline-none focus:ring-2 focus:ring-purple-500/60 focus:border-purple-500
  transition-colors`

export function OnboardingModal() {
  const [username,         setUsername]         = useState('')
  const [displayName,      setDisplayName]      = useState('')
  const [bio,              setBio]              = useState('')
  const [collectionPublic, setCollectionPublic] = useState(false)
  const [status,           setStatus]           = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [saving,           setSaving]           = useState(false)
  const [error,            setError]            = useState<string | null>(null)
  const [card,             setCard]             = useState<HeroCardData | null>(null)
  const [cardLoading,      setCardLoading]      = useState(true)
  const router = useRouter()
  const supabase = createClient()

  const loadCard = useCallback(async () => {
    setCardLoading(true)
    setCard(await fetchRandomCard())
    setCardLoading(false)
  }, [])

  useEffect(() => { loadCard() }, [loadCard])

  // Debounced username availability check
  useEffect(() => {
    if (!username) { setStatus('idle'); return }
    if (!USERNAME_RE.test(username)) { setStatus('invalid'); return }

    setStatus('checking')
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .maybeSingle()
      setStatus(data ? 'taken' : 'available')
    }, 400)
    return () => clearTimeout(t)
  }, [username, supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status !== 'available') return
    setSaving(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not logged in'); setSaving(false); return }

    const { error: err } = await supabase
      .from('profiles')
      .update({
        username,
        display_name:      displayName || null,
        bio:               bio || null,
        collection_public: collectionPublic,
      })
      .eq('id', user.id)

    if (err) {
      setError(err.message.includes('unique') ? 'Username taken' : err.message)
      setSaving(false)
      return
    }

    router.replace('/inventory')
    router.refresh()
  }

  const usernameHint = {
    idle:      'Lowercase letters, numbers, - and _ · 3–24 characters',
    checking:  'Checking availability…',
    available: 'Available!',
    taken:     'That username is already taken',
    invalid:   'Use 3–24 lowercase letters, numbers, - or _',
  }[status]

  const usernameHintColor = {
    idle:      'text-zinc-600',
    checking:  'text-zinc-500',
    available: 'text-emerald-400',
    taken:     'text-red-400',
    invalid:   'text-red-400',
  }[status]

  return (
    <>
      <style>{`
        @keyframes htSkeletonShimmer { 0%,100%{ background-position:-200% 0; } 50%{ background-position:200% 0; } }
        @keyframes htGlowPulse {
          from { filter: drop-shadow(0 0 22px rgba(168,85,247,.55)); }
          to   { filter: drop-shadow(0 0 44px rgba(200,140,255,.9)); }
        }
        .ht-onboard-grid {
          min-height: 100svh;
          display: grid;
          grid-template-columns: 1fr 1fr;
          background: #04040e;
        }
        .ht-onboard-card-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 40px 24px;
          background: radial-gradient(ellipse 80% 70% at 50% 50%, rgba(80,20,160,.25) 0%, transparent 70%);
        }
        .ht-onboard-form-col {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 32px;
          border-left: 1px solid rgba(255,255,255,0.04);
        }
        @media (max-width: 768px) {
          .ht-onboard-grid {
            grid-template-columns: 1fr;
            grid-template-rows: auto 1fr;
          }
          .ht-onboard-card-col {
            padding: 28px 24px 12px;
            gap: 10px;
            background: radial-gradient(ellipse 100% 80% at 50% 60%, rgba(80,20,160,.3) 0%, transparent 70%);
          }
          .ht-onboard-card-col .ht-card-scale { transform: scale(0.8); margin: -35px 0; }
          .ht-onboard-form-col {
            border-left: none;
            border-top: 1px solid rgba(255,255,255,0.04);
            padding: 24px 20px calc(40px + env(safe-area-inset-bottom));
          }
        }
      `}</style>

      <div className="ht-onboard-grid">

        {/* Card hero — top on mobile, left on desktop */}
        <div className="ht-onboard-card-col">
          <div className="ht-card-scale">
            <HeroHoloCard card={card} loading={cardLoading} />
          </div>
          <button
            onClick={loadCard}
            disabled={cardLoading}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '0.5px solid rgba(168,85,247,.22)', borderRadius: 20, color: 'rgba(168,85,247,.55)', fontSize: 10, fontFamily: 'system-ui,sans-serif', padding: '4px 10px', cursor: 'pointer' }}
          >
            ↻ {cardLoading ? 'Loading…' : 'New card'}
          </button>
          <p style={{ color: 'rgba(130,90,190,.35)', fontSize: 9, fontFamily: 'system-ui,sans-serif', letterSpacing: '0.08em', marginTop: 0 }}>drag to reveal foil</p>
        </div>

        {/* Form — bottom on mobile, right on desktop */}
        <div className="ht-onboard-form-col">
          <div className="w-full max-w-sm">

            <div className="text-center mb-8">
              <h1
                className="text-[28px] font-extrabold tracking-tight"
                style={{ background: 'linear-gradient(130deg,#fff 0%,#c084fc 60%,#a855f7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', animation: 'htGlowPulse 3s ease-in-out infinite alternate' }}
              >
                Welcome to HOLOTrakr
              </h1>
              <p className="text-sm text-zinc-500 mt-1.5">
                One quick step — set up your collector profile
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">

              {/* Username */}
              <div>
                <label htmlFor="ob-username" className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  <AtSign className="w-3.5 h-3.5 text-purple-400" /> Username <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    id="ob-username"
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="ash-ketchum"
                    maxLength={24}
                    required
                    autoFocus
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className={`${INPUT_CLASS} pr-10`}
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    {status === 'checking'  && <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />}
                    {status === 'available' && <Check className="w-4 h-4 text-emerald-400" />}
                    {(status === 'taken' || status === 'invalid') && <X className="w-4 h-4 text-red-400" />}
                  </div>
                </div>
                <p className={`text-xs mt-1.5 ${usernameHintColor}`}>{usernameHint}</p>
                {username && status === 'available' && (
                  <p className="text-xs text-zinc-600 mt-0.5">
                    Your public page: <span className="text-zinc-400 font-mono">holotrakr.t3kdesigns.app/u/{username}</span>
                  </p>
                )}
              </div>

              {/* Display name */}
              <div>
                <label htmlFor="ob-displayname" className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  <User className="w-3.5 h-3.5 text-purple-400" /> Display Name
                  <span className="normal-case font-normal text-zinc-600">· optional</span>
                </label>
                <input
                  id="ob-displayname"
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Ash Ketchum"
                  maxLength={64}
                  autoComplete="name"
                  className={INPUT_CLASS}
                />
                <p className="text-xs text-zinc-600 mt-1.5">Shown on your profile instead of your username</p>
              </div>

              {/* Bio */}
              <div>
                <label htmlFor="ob-bio" className="flex items-center justify-between text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  <span>Bio <span className="normal-case font-normal text-zinc-600">· optional</span></span>
                  <span className="font-normal normal-case text-zinc-600">{bio.length}/280</span>
                </label>
                <textarea
                  id="ob-bio"
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Collecting Charizards since '99…"
                  maxLength={280}
                  rows={3}
                  className={`${INPUT_CLASS} resize-none`}
                />
              </div>

              {/* Collection visibility */}
              <button
                type="button"
                role="switch"
                aria-checked={collectionPublic}
                onClick={() => setCollectionPublic(v => !v)}
                className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors ${
                  collectionPublic
                    ? 'border-purple-500/50 bg-purple-500/10'
                    : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
                }`}
              >
                <span className="flex items-center gap-3">
                  {collectionPublic
                    ? <Eye className="w-4 h-4 text-purple-400 shrink-0" />
                    : <EyeOff className="w-4 h-4 text-zinc-600 shrink-0" />}
                  <span>
                    <span className="block text-sm font-medium text-white">Public collection</span>
                    <span className="block text-xs text-zinc-500 mt-0.5">Let others browse your inventory — you can change this anytime</span>
                  </span>
                </span>
                <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  collectionPublic ? 'bg-purple-600' : 'bg-zinc-700'
                }`}>
                  <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    collectionPublic ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </span>
              </button>

              {error && (
                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={status !== 'available' || saving}
                className="w-full px-4 py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500
                  text-white text-base font-semibold transition-colors
                  disabled:opacity-40 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Setting up…</>
                ) : (
                  'Create Profile & Start Collecting →'
                )}
              </button>

              {status !== 'available' && !saving && (
                <p className="text-xs text-zinc-600 text-center -mt-2">
                  Pick an available username to continue
                </p>
              )}
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
