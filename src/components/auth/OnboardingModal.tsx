'use client'
// ============================================================
// OnboardingModal — username setup on first login
// src/components/auth/OnboardingModal.tsx
// ============================================================

import { useState, useEffect } from 'react'
import { Loader2, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const USERNAME_RE = /^[a-z0-9_-]{3,24}$/

export function OnboardingModal() {
  const [username,    setUsername]    = useState('')
  const [displayName, setDisplayName] = useState('')
  const [status,      setStatus]      = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)
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
      .update({ username, display_name: displayName || null })
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
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🃏</div>
          <h1 className="text-2xl font-bold text-white">Welcome to Jokemon</h1>
          <p className="text-zinc-500 text-sm mt-2">
            Set up your profile to get started
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Username */}
          <div>
            <label className="field-label">
              Username
              <span className="text-zinc-600 font-normal ml-1">— your public URL</span>
            </label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-sm">
                jokemon.app/u/
              </span>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                placeholder="your-name"
                maxLength={24}
                required
                className="field pl-[108px] pr-9"
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

          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20
              rounded-lg px-3 py-2">
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
