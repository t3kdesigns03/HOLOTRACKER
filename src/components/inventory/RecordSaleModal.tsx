'use client'
// src/components/inventory/RecordSaleModal.tsx

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { MiniCard } from '@/components/card/HoloCard'
import type { InventoryCard, RecordSaleForm } from '@/types'
import { toast } from 'sonner'

interface Props {
  card: InventoryCard
  onClose: () => void
  onSuccess: () => void
}

const PLATFORMS = ['TCGPlayer', 'eBay', 'Local', 'Facebook', 'Mercari', 'Other']

export function RecordSaleModal({ card, onClose, onSuccess }: Props) {
  const [form, setForm] = useState<RecordSaleForm>({
    user_card_id:  card.id,
    quantity_sold: 1,
    sale_price:    '',
    platform:      'TCGPlayer',
    fees:          '',
    sold_at:       new Date().toISOString().split('T')[0],
    notes:         '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  function set<K extends keyof RecordSaleForm>(k: K, v: RecordSaleForm[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  const salePrice = parseFloat(form.sale_price) || 0
  const fees      = parseFloat(form.fees) || 0
  const costBasis = (card.cost_basis ?? 0) * form.quantity_sold
  const netProfit = salePrice - fees - costBasis
  const margin    = costBasis > 0 ? ((netProfit / costBasis) * 100) : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/inventory/${card.id}/sell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to record sale')
      }
      toast.success('Sale recorded!')
      onSuccess()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-md bg-zinc-950 border border-zinc-800
        rounded-2xl shadow-2xl overflow-hidden">

        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="font-semibold text-white">Record Sale</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {/* Card preview */}
          <div className="flex items-center gap-3 p-3 bg-zinc-900 rounded-xl border border-zinc-800">
            <MiniCard
              imageUrl={card.card.image_url}
              name={card.card.name}
              rarity={card.card.rarity}
              printType={card.print_type as Parameters<typeof MiniCard>[0]['printType']}
              size={40}
            />
            <div>
              <div className="font-medium text-white text-sm">{card.card.name}</div>
              <div className="text-xs text-zinc-500">{card.condition} · {card.print_type}</div>
              <div className="text-xs text-zinc-600">
                {card.quantity} in inventory
                {card.cost_basis && ` · Cost: $${card.cost_basis.toFixed(2)}/ea`}
              </div>
            </div>
          </div>

          {/* Qty sold */}
          <div>
            <label className="field-label">Quantity Sold</label>
            <input
              type="number"
              min={1}
              max={card.quantity}
              value={form.quantity_sold}
              onChange={e => set('quantity_sold', parseInt(e.target.value) || 1)}
              className="field mt-1 w-24"
            />
          </div>

          {/* Sale price */}
          <div>
            <label className="field-label">Sale Price (total)</label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.sale_price}
                onChange={e => set('sale_price', e.target.value)}
                placeholder="0.00"
                required
                className="field pl-6"
              />
            </div>
          </div>

          {/* Platform + fees */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Platform</label>
              <select
                value={form.platform}
                onChange={e => set('platform', e.target.value)}
                className="field mt-1"
              >
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Fees</label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.fees}
                  onChange={e => set('fees', e.target.value)}
                  placeholder="0.00"
                  className="field pl-6"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="field-label">Date Sold</label>
            <input
              type="date"
              value={form.sold_at}
              onChange={e => set('sold_at', e.target.value)}
              className="field mt-1"
            />
          </div>

          {/* P/L preview */}
          {salePrice > 0 && (
            <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[10px] text-zinc-600 mb-0.5">Net Received</div>
                <div className="text-sm font-mono text-white">${(salePrice - fees).toFixed(2)}</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-600 mb-0.5">Net Profit</div>
                <div className={`text-sm font-mono ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {netProfit >= 0 ? '+' : ''}${netProfit.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-600 mb-0.5">Margin</div>
                <div className={`text-sm font-mono ${margin != null && margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {margin != null ? `${margin >= 0 ? '+' : ''}${margin.toFixed(1)}%` : '—'}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl
              bg-zinc-800 border border-zinc-700 text-zinc-400 text-sm font-medium
              hover:bg-zinc-700 hover:text-white transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl
              bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold
              transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Record Sale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
