'use client'
// ============================================================
// EditInventoryModal — pre-filled form for updating a user_card
// src/components/inventory/EditInventoryModal.tsx
// ============================================================

import { useState, useEffect } from 'react'
import { X, Plus, Minus, Loader2, ChevronDown, Save } from 'lucide-react'
import { HoloCard } from '@/components/card/HoloCard'
import {
  CONDITION_LABELS, PRINT_TYPE_LABELS, STATUS_LABELS,
  getMarketPrice, getAvailablePrintTypes,
  type AddCardForm, type InventoryCard,
  type CardCondition, type PrintType, type CardStatus,
  type TCGPlayerPrices,
} from '@/types'

interface Props {
  card: InventoryCard
  onClose: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSuccess: (updated: any) => void
}

const CONDITIONS: CardCondition[] = ['NM', 'LP', 'MP', 'HP', 'DMG']

function toForm(card: InventoryCard): AddCardForm {
  return {
    card_id:           card.card_id,
    quantity:          card.quantity,
    condition:         card.condition,
    print_type:        card.print_type,
    cost_basis:        card.cost_basis != null ? String(card.cost_basis) : '',
    acquired_at:       card.acquired_at?.split('T')[0] ?? new Date().toISOString().split('T')[0],
    acquisition_notes: card.acquisition_notes ?? '',
    storage_location:  card.storage_location ?? '',
    status:            card.status,
    is_public:         card.is_public,
    asking_price:      card.asking_price != null ? String(card.asking_price) : '',
    is_graded:         card.is_graded,
    grading_company:   card.grading_company ?? '',
    grade:             card.grade ?? '',
    cert_number:       card.cert_number ?? '',
  }
}

export function EditInventoryModal({ card, onClose, onSuccess }: Props) {
  const [form, setForm]             = useState<AddCardForm>(() => toForm(card))
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const tcgPrices = card.card.tcgplayer_prices as TCGPlayerPrices | null
  const availablePrints = getAvailablePrintTypes(tcgPrices) as PrintType[]
  const marketPrice     = getMarketPrice(tcgPrices, form.print_type)

  // ESC to close
  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  function set<K extends keyof AddCardForm>(k: K, v: AddCardForm[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const body = {
        quantity:          form.quantity,
        condition:         form.condition,
        print_type:        form.print_type,
        cost_basis:        form.cost_basis ? parseFloat(form.cost_basis) : null,
        acquired_at:       form.acquired_at || null,
        acquisition_notes: form.acquisition_notes || null,
        storage_location:  form.storage_location || null,
        status:            form.status,
        is_public:         form.is_public,
        asking_price:      form.asking_price ? parseFloat(form.asking_price) : null,
        is_graded:         form.is_graded,
        grading_company:   form.grading_company || null,
        grade:             form.grade || null,
        cert_number:       form.cert_number || null,
      }
      const res = await fetch(`/api/inventory/${card.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to save changes')
      }
      onSuccess(await res.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const totalCost = form.cost_basis
    ? (parseFloat(form.cost_basis) * form.quantity).toFixed(2)
    : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto
        bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4
          bg-zinc-950/95 backdrop-blur border-b border-zinc-800">
          <div>
            <h2 className="font-semibold text-white">Edit Card</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {card.card.set_name} · #{card.card.number}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <div className="flex gap-5">

            {/* Card preview */}
            <div className="shrink-0 flex flex-col items-center gap-2">
              <HoloCard
                imageUrl={card.card.image_url}
                imageUrlSmall={card.card.image_url_small}
                name={card.card.name}
                rarity={card.card.rarity}
                printType={form.print_type}
                width={150}
              />
              <div className="text-center">
                <div className="font-semibold text-white text-sm">{card.card.name}</div>
                {marketPrice != null && (
                  <div className="text-emerald-400 text-sm font-mono">
                    ${marketPrice.toFixed(2)}
                    <span className="text-zinc-600 text-xs ml-1">market</span>
                  </div>
                )}
              </div>
            </div>

            {/* Form fields */}
            <div className="flex-1 min-w-0 flex flex-col gap-4">

              {/* Quantity */}
              <div>
                <label className="field-label">Quantity</label>
                <div className="flex items-center gap-2 mt-1">
                  <button type="button" onClick={() => set('quantity', Math.max(1, form.quantity - 1))} className="icon-btn">
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number" min={1} max={9999}
                    value={form.quantity}
                    onChange={e => set('quantity', Math.max(1, parseInt(e.target.value) || 1))}
                    className="field w-16 text-center font-mono"
                  />
                  <button type="button" onClick={() => set('quantity', form.quantity + 1)} className="icon-btn">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Condition */}
              <div>
                <label className="field-label">Condition</label>
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  {CONDITIONS.map(c => (
                    <button key={c} type="button" onClick={() => set('condition', c)}
                      className={`px-2.5 py-1 text-xs rounded-lg border transition-colors font-medium
                        ${form.condition === c
                          ? 'bg-purple-500/20 border-purple-500/60 text-purple-300'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'}`}>
                      {c}
                    </button>
                  ))}
                </div>
                <div className="text-[11px] text-zinc-600 mt-1">
                  {CONDITION_LABELS[form.condition]}
                </div>
              </div>

              {/* Print type */}
              <div>
                <label className="field-label">Print Type</label>
                <select value={form.print_type}
                  onChange={e => set('print_type', e.target.value as PrintType)}
                  className="field mt-1">
                  {availablePrints.length > 0
                    ? availablePrints.map(pt => (
                        <option key={pt} value={pt}>{PRINT_TYPE_LABELS[pt] ?? pt}</option>
                      ))
                    : Object.entries(PRINT_TYPE_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))
                  }
                </select>
              </div>

              {/* Cost basis */}
              <div>
                <label className="field-label">
                  Purchase Price
                  <span className="text-zinc-600 font-normal ml-1">(per card)</span>
                </label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                  <input type="number" min={0} step="0.01"
                    value={form.cost_basis}
                    onChange={e => set('cost_basis', e.target.value)}
                    placeholder="0.00"
                    className="field pl-6"
                  />
                </div>
                {totalCost && form.quantity > 1 && (
                  <div className="text-[11px] text-zinc-600 mt-1">
                    Total: ${totalCost} for {form.quantity} cards
                  </div>
                )}
                {marketPrice != null && form.cost_basis && (
                  <div className="text-[11px] mt-1">
                    {parseFloat(form.cost_basis) < marketPrice
                      ? <span className="text-emerald-500">↑ ${(marketPrice - parseFloat(form.cost_basis)).toFixed(2)} below market</span>
                      : <span className="text-red-400">↓ ${(parseFloat(form.cost_basis) - marketPrice).toFixed(2)} above market</span>
                    }
                  </div>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="field-label">Status</label>
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  {(['collection','for_sale','pending','traded'] as CardStatus[]).map(s => (
                    <button key={s} type="button" onClick={() => set('status', s)}
                      className={`px-2.5 py-1 text-xs rounded-lg border transition-colors
                        ${form.status === s
                          ? 'bg-purple-500/20 border-purple-500/60 text-purple-300'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'}`}>
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Asking price when for_sale */}
              {form.status === 'for_sale' && (
                <div>
                  <label className="field-label">Asking Price</label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                    <input type="number" min={0} step="0.01"
                      value={form.asking_price}
                      onChange={e => set('asking_price', e.target.value)}
                      placeholder="0.00"
                      className="field pl-6"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Advanced fields */}
          <div className="mt-4">
            <button type="button" onClick={() => setShowAdvanced(v => !v)}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              Advanced options
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-2 gap-3 mt-3 p-4 bg-zinc-900 rounded-xl border border-zinc-800">
                <div>
                  <label className="field-label">Date Acquired</label>
                  <input type="date" value={form.acquired_at}
                    onChange={e => set('acquired_at', e.target.value)}
                    className="field mt-1" />
                </div>
                <div>
                  <label className="field-label">Storage Location</label>
                  <input type="text" value={form.storage_location}
                    onChange={e => set('storage_location', e.target.value)}
                    placeholder="Binder A, Box 3…"
                    className="field mt-1" />
                </div>
                <div className="col-span-2">
                  <label className="field-label">Notes</label>
                  <textarea value={form.acquisition_notes}
                    onChange={e => set('acquisition_notes', e.target.value)}
                    placeholder="Any notes about this card…"
                    rows={2} className="field mt-1 resize-none" />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <input type="checkbox" id="edit_is_public" checked={form.is_public}
                    onChange={e => set('is_public', e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-800 text-purple-500 focus:ring-purple-500" />
                  <label htmlFor="edit_is_public" className="text-xs text-zinc-400 cursor-pointer">
                    Make this card visible in my public collection
                  </label>
                </div>
                <div className="col-span-2 border-t border-zinc-800 pt-3">
                  <div className="flex items-center gap-2 mb-3">
                    <input type="checkbox" id="edit_is_graded" checked={form.is_graded}
                      onChange={e => set('is_graded', e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-800 text-purple-500 focus:ring-purple-500" />
                    <label htmlFor="edit_is_graded" className="text-xs text-zinc-400 cursor-pointer">
                      This is a graded card (PSA / BGS / CGC)
                    </label>
                  </div>
                  {form.is_graded && (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="field-label">Grader</label>
                        <select value={form.grading_company}
                          onChange={e => set('grading_company', e.target.value as 'PSA'|'BGS'|'CGC'|'')}
                          className="field mt-1">
                          <option value="">Select…</option>
                          <option value="PSA">PSA</option>
                          <option value="BGS">BGS</option>
                          <option value="CGC">CGC</option>
                        </select>
                      </div>
                      <div>
                        <label className="field-label">Grade</label>
                        <input type="text" value={form.grade}
                          onChange={e => set('grade', e.target.value)}
                          placeholder="10, 9.5…" className="field mt-1" />
                      </div>
                      <div>
                        <label className="field-label">Cert #</label>
                        <input type="text" value={form.cert_number}
                          onChange={e => set('cert_number', e.target.value)}
                          placeholder="12345678" className="field mt-1" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-2 mt-5">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700
                text-zinc-400 text-sm font-medium hover:bg-zinc-700 hover:text-white transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500
                text-white text-sm font-semibold transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center justify-center gap-2">
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                : <><Save className="w-4 h-4" /> Save Changes</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
