'use client'
// ============================================================
// AssignCardModal — pick an inventory item to place in a case
// src/components/cases/AssignCardModal.tsx
// ============================================================

import { useState, useEffect } from 'react'
import { X, Search, Loader2 } from 'lucide-react'
import { PRINT_TYPE_LABELS, CONDITION_LABELS, type InventoryCard } from '@/types'
import { toast } from 'sonner'

interface Props {
  caseId: string
  shortCode: string
  onClose: () => void
  onAssigned: (updatedCase: unknown) => void
}

export function AssignCardModal({ caseId, shortCode, onClose, onAssigned }: Props) {
  const [items, setItems]     = useState<InventoryCard[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState<string | null>(null)
  const [search, setSearch]   = useState('')

  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  useEffect(() => {
    fetch('/api/inventory')
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(setItems)
      .catch(() => toast.error('Failed to load inventory'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = items.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.card.name.toLowerCase().includes(q) ||
      c.card.set_name.toLowerCase().includes(q) ||
      c.card.number.includes(q)
    )
  })

  async function assign(userCardId: string) {
    setSaving(userCardId)
    try {
      const res = await fetch(`/api/cases/${caseId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ user_card_id: userCardId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to assign card')
      }
      toast.success(`Card assigned to ${shortCode}`)
      onAssigned(await res.json())
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to assign card')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[80dvh] flex flex-col rounded-xl border border-zinc-800 bg-zinc-900"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h2 className="font-semibold">
            Assign a card to <span className="font-mono text-purple-300">{shortCode}</span>
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 border-b border-zinc-800">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search your inventory…"
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 pl-9 pr-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1 divide-y divide-zinc-800/60">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-zinc-500 py-10">
              {search ? 'No cards match your search.' : 'Your inventory is empty.'}
            </p>
          ) : (
            filtered.map(c => (
              <button
                key={c.id}
                onClick={() => assign(c.id)}
                disabled={saving !== null}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-800/60 disabled:opacity-50 transition-colors"
              >
                {c.card.image_url_small && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.card.image_url_small} alt="" className="w-9 rounded-sm" />
                )}
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{c.card.name}</span>
                  <span className="block text-xs text-zinc-500 truncate">
                    {c.card.set_name} #{c.card.number} · {PRINT_TYPE_LABELS[c.print_type]} · {CONDITION_LABELS[c.condition]}
                    {c.quantity > 1 ? ` · ×${c.quantity}` : ''}
                  </span>
                </span>
                {saving === c.id && <Loader2 className="w-4 h-4 animate-spin text-purple-400" />}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
