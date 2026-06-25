'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      router.push('/inventory')
      router.refresh()
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      setMessage('Check your email to confirm your account, then log in.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🃏</div>
          <h1 className="text-2xl font-bold text-white">HoloTracker</h1>
          <p className="text-zinc-500 text-sm mt-1">Pokémon TCG Inventory & Profit Tracker</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
          {message && <div className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">{message}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />{mode === 'login' ? 'Signing in…' : 'Creating account…'}</> : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          <button
            type="button"
            onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError(null); setMessage(null) }}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors text-center"
          >
            {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
