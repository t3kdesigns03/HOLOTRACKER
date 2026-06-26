'use client'
// ============================================================
// OnboardingModal — profile setup on first login
// src/components/auth/OnboardingModal.tsx
// ============================================================

import { useState, useEffect } from 'react'
import { Loader2, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const USERNAME_RE = /^[a-z0-9_-]{3,24}$/

export function OnboardingModal() {
  const [username,         setUsername]         = useState('')
  const [displayName,      setDisplayName]      = useState('')
  const [bio,              setBio]              = useState('')
  const [collectionPublic, setCollectionPublic] = useState(false)
  const [status,           setStatus]           = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [saving,           setSaving]           = useState(false)
  const [error,            setError]            = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Debounce username availability check
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

  const statusIcon = {
    idle:      null,
    checking:  <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />,
    available: <Check className="w-4 h-4 text-emerald-400" />,
    taken:     <X className="w-4 h-4 text-red-400" />,
    invalid:   <X className="w-4 h-4 text-red-400" />,
  }[status]

  const statusMsg = {
    idle:      '',
    checking:  'Checking…',
    available: '✓ Available',
    taken:     'Already taken',
    invalid:   '3–24 chars, letters/numbers/_ only',
  }[status]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <style>{`
            @keyframes holoShift {
              0%   { background-position: 0% 50%;   filter: hue-rotate(0deg)   brightness(1.15); }
              50%  { background-position: 100% 50%; filter: hue-rotate(200deg) brightness(1.4);  }
              100% { background-position: 0% 50%;   filter: hue-rotate(360deg) brightness(1.15); }
            }
            @keyframes holoPulse {
              0%, 100% { opacity: 1;    transform: scale(1); }
              50%       { opacity: 0.88; transform: scale(1.015); }
            }
            .holo-title {
              background: linear-gradient(
                90deg,
                #ff6ec7, #bf5fff, #5b8fff, #00d4ff, #00ffb3, #fff700, #ff6ec7
              );
              background-size: 300% 100%;
              -webkit-background-clip: text;
              background-clip: text;
              -webkit-text-fill-color: transparent;
              animation:
                holoShift 3.5s linear infinite,
                holoPulse  2.8s ease-in-out infinite;
            }
          `}</style>
          <div className="text-4xl mb-3">✨</div>
          <h1 className="text-3xl font-extrabold holo-title tracking-tight">HoloTrakr</h1>
          <p className="text-zinc-400 text-sm mt-2 font-medium">Set up your profile to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Username */}
          <div>
            <label className="field-label">
              Username
              <span className="text-zinc-600 font-normal ml-1">— your public URL</span>
            </label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-sm select-none">
                holotrakr.app/u/
              </span>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                placeholder="your-name"
                maxLength={24}
                required
                className="field pl-[120px] pr-9"
                autoFocus
              />
              {statusIcon && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {statusIcon}
                </div>
              )}
            </div>
            {statusMsg && (
              <div className={`text-xs mt-1 ${
                status === 'available' ? 'text-emerald-400'
                : status === 'idle' || status === 'checking' ? 'text-zinc-600'
                : 'text-red-400'
              }`}>
                {statusMsg}
              </div>
            )}
          </div>

          {/* Display name */}
          <div>
            <label className="field-label">
              Display Name
              <span className="text-zinc-600 font-normal ml-1">(optional)</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
              maxLength={64}
              className="field mt-1"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="field-label">
              Bio
              <span className="text-zinc-600 font-normal ml-1">(optional)</span>
            </label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Tell the community about your collection…"
              maxLength={280}
              rows={3}
              className="field mt-1 resize-none"
            />
            <div className="text-xs text-zinc-600 mt-1 text-right">{bio.length}/280</div>
          </div>

          {/* Collection visibility */}
          <div className="flex items-center justify-between rounded-xl border border-zinc-800 px-4 py-3">
            <div>
              <div className="text-sm font-medium text-white">Public collection</div>
              <div className="text-xs text-zinc-500 mt-0.5">Let others browse your inventory</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={collectionPublic}
              onClick={() => setCollectionPublic(v => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                collectionPublic ? 'bg-purple-600' : 'bg-zinc-700'
              }`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                collectionPublic ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={status !== 'available' || saving}
            className="w-full px-4 py-3 rounded-xl bg-purple-600 hover:bg-purple-500
              text-white font-semibold transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed
              flex items-center justify-center gap-2 mt-2"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Setting up…</>
            ) : (
              'Create Profile & Go to Inventory →'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
