'use client'
// ============================================================
// HoloCases Dashboard — /cases
// Create, find, and manage physical HoloCase QR cases.
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, QrCode, Loader2, ScanLine, Eye, EyeOff } from 'lucide-react'
import { CaseDetailModal } from '@/components/cases/CaseDetailModal'
import type { CaseWithCard } from '@/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'assigned' | 'empty'

export default function CasesPage() {
  const router = useRouter()

  const [cases, setCases]     = useState<CaseWithCard[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [filter, setFilter]   = useState<Filter>('all')
  const [codeInput, setCodeInput] = useState('')
  const [selected, setSelected]   = useState<CaseWithCard | null>(null)

  const fetchCases = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/cases')
      if (!res.ok) throw new Error()
      const data: CaseWithCard[] = await res.json()
      setCases(data)
      // Deep link: /cases?code=HC-XXXXXX opens that case (used by /c/[code] "Manage")
      const code = new URLSearchParams(window.location.search).get('code')
      if (code) {
        const match = data.find(c => c.short_code === code.toUpperCase())
        if (match) {
          setSelected(match)
          router.replace('/cases', { scroll: false })
        }
      }
    } catch {
      toast.error('Failed to load cases')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { fetchCases() }, [fetchCases])

  async function createCases(count: number) {
    setCreating(true)
    try {
      const res = await fetch('/api/cases', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ count }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const created: CaseWithCard[] = Array.isArray(data) ? data : [data]
      setCases(prev => [...created, ...prev])
      toast.success(count === 1
        ? `Case ${created[0].short_code} created`
        : `${created.length} cases created`)
      if (count === 1) setSelected(created[0])
    } catch {
      toast.error('Failed to create case')
    } finally {
      setCreating(false)
    }
  }

  function openByCode(e: React.FormEvent) {
    e.preventDefault()
    const code = codeInput.trim().toUpperCase()
    if (!code) return
    const normalized = code.startsWith('HC-') ? code : `HC-${code}`
    const match = cases.find(c => c.short_code === normalized)
    if (match) {
      setSelected(match)
      setCodeInput('')
    } else {
      toast.error(`No case ${normalized} in your account`)
    }
  }

  function handleChanged(updated: CaseWithCard | null) {
    if (updated === null) {
      setCases(prev => prev.filter(c => c.id !== selected?.id))
    } else {
      setCases(prev => prev.map(c => (c.id === updated.id ? updated : c)))
    }
  }

  const filtered = cases.filter(c =>
    filter === 'all' ? true : filter === 'assigned' ? !!c.user_card_id : !c.user_card_id
  )

  const counts = {
    all: cases.length,
    assigned: cases.filter(c => c.user_card_id).length,
    empty: cases.filter(c => !c.user_card_id).length,
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-5">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold flex items-center gap-2 mr-auto">
          <QrCode className="w-5 h-5 text-purple-400" /> HoloCases
        </h1>

        <form onSubmit={openByCode} className="relative">
          <ScanLine className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={codeInput}
            onChange={e => setCodeInput(e.target.value)}
            placeholder="Enter code (HC-…)"
            className="w-44 rounded-lg bg-zinc-900 border border-zinc-700 pl-9 pr-3 py-2 text-sm font-mono uppercase placeholder:font-sans placeholder:normal-case placeholder:text-zinc-600 focus:outline-none focus:border-purple-500"
          />
        </form>

        <div className="flex items-center rounded-lg overflow-hidden border border-purple-600/50">
          <button
            onClick={() => createCases(1)}
            disabled={creating}
            className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 px-3.5 py-2 text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            New case
          </button>
          <button
            onClick={() => {
              const n = parseInt(prompt('How many cases? (max 24)') ?? '', 10)
              if (n > 0) createCases(Math.min(n, 24))
            }}
            disabled={creating}
            title="Create a batch for a print run"
            className="bg-purple-600/40 hover:bg-purple-500/50 px-2.5 py-2 text-sm font-medium border-l border-purple-500/40 disabled:opacity-50 transition-colors"
          >
            ×N
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1.5">
        {(['all', 'assigned', 'empty'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors',
              filter === f
                ? 'bg-purple-500/20 text-purple-300'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
            )}
          >
            {f} <span className="text-xs opacity-60">{counts[f]}</span>
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <QrCode className="w-10 h-10 text-zinc-700" />
          <p className="text-zinc-400 text-sm max-w-sm">
            {cases.length === 0
              ? 'No HoloCases yet. Create one to get a unique QR code you can print and stick on a physical case.'
              : 'No cases match this filter.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map(c => (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className="group rounded-xl border border-zinc-800 bg-zinc-900/60 hover:border-purple-500/40 p-3 flex flex-col items-center gap-2 text-center transition-colors"
            >
              {c.user_card?.card.image_url_small ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.user_card.card.image_url_small}
                  alt={c.user_card.card.name}
                  className="w-20 rounded-md shadow-lg group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-20 aspect-[5/7] rounded-md border-2 border-dashed border-zinc-700 flex items-center justify-center text-zinc-600 text-[10px]">
                  Empty
                </div>
              )}
              <span className="font-mono text-xs text-zinc-300">{c.short_code}</span>
              <span className="text-xs text-zinc-500 truncate w-full">
                {c.user_card?.card.name ?? '—'}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 border',
                  c.is_public
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    : 'bg-zinc-500/10 text-zinc-400 border-zinc-600/40'
                )}
              >
                {c.is_public ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                {c.is_public ? 'Public' : 'Private'}
              </span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <CaseDetailModal
          holoCase={selected}
          onClose={() => setSelected(null)}
          onChanged={handleChanged}
        />
      )}
    </main>
  )
}
