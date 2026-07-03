'use client'
// ============================================================
// ConfirmRemoveDialog — themed replacement for browser confirm()
// Quantity-aware: owning 3 copies offers "Remove one" vs "Remove all".
// src/components/inventory/ConfirmRemoveDialog.tsx
// ============================================================

import { useEffect, useState } from 'react'
import { Trash2, Minus, Loader2, X } from 'lucide-react'
import type { InventoryCard } from '@/types'
import { toast } from 'sonner'

interface Props {
  card: InventoryCard
  onClose: () => void
  /** Called with the updated row (decrement) or null (fully removed) */
  onRemoved: (updated: InventoryCard | null) => void
}

export function ConfirmRemoveDialog({ card, onClose, onRemoved }: Props) {
  const [busy, setBusy] = useState<'one' | 'all' | null>(null)

  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose()
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose, busy])

  async function removeAll() {
    setBusy('all')
    try {
      const res = await fetch(`/api/inventory/${card.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success(`${card.card.name} removed from inventory`)
      onRemoved(null)
      onClose()
    } catch {
      toast.error('Failed to remove card')
      setBusy(null)
    }
  }

  async function removeOne() {
    setBusy('one')
    try {
      const res = await fetch(`/api/inventory/${card.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ quantity: card.quantity - 1 }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      toast.success(`Removed one — ${card.quantity - 1} left`)
      onRemoved(updated)
      onClose()
    } catch {
      toast.error('Failed to update quantity')
      setBusy(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          {card.card.image_url_small && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.card.image_url_small}
              alt={card.card.name}
              className="w-14 rounded-md shadow-lg shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-white leading-tight">
              Remove {card.card.name}?
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              {card.card.set_name} #{card.card.number}
              {card.quantity > 1 && (
                <span className="text-zinc-400"> · you have ×{card.quantity}</span>
              )}
            </p>
            <p className="text-xs text-zinc-600 mt-2">
              This only removes it from your inventory — sales history is kept.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={!!busy}
            className="p-1 text-zinc-600 hover:text-zinc-400 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-2 mt-5">
          {card.quantity > 1 && (
            <button
              onClick={removeOne}
              disabled={!!busy}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-zinc-700
                py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >
              {busy === 'one' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Minus className="w-4 h-4" />}
              Remove one (keep {card.quantity - 1})
            </button>
          )}
          <button
            onClick={removeAll}
            disabled={!!busy}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-600/90 hover:bg-red-600
              py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition-colors"
          >
            {busy === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {card.quantity > 1 ? `Remove all ${card.quantity}` : 'Remove card'}
          </button>
          <button
            onClick={onClose}
            disabled={!!busy}
            className="w-full py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
