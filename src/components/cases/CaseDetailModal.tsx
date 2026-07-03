'use client'
// ============================================================
// CaseDetailModal — manage one HoloCase:
// QR / label, visibility toggles, location & notes, assignment
// src/components/cases/CaseDetailModal.tsx
// ============================================================

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { X, Link2, Unlink, Trash2, Copy, ExternalLink, Loader2 } from 'lucide-react'
import { CaseQR } from './CaseQR'
import { AssignCardModal } from './AssignCardModal'
import { getCaseUrl } from '@/lib/holocase'
import { PRINT_TYPE_LABELS, type CaseWithCard } from '@/types'
import { toast } from 'sonner'

interface Props {
  holoCase: CaseWithCard
  onClose: () => void
  onChanged: (updated: CaseWithCard | null) => void  // null = deleted
}

const VISIBILITY_FLAGS = [
  { key: 'is_public',  label: 'Public page',      hint: 'Anyone with the QR can view' },
  { key: 'show_value', label: 'Show est. value',  hint: 'TCGplayer market price' },
  { key: 'show_grade', label: 'Show grade',       hint: 'PSA/BGS/CGC grade + cert' },
  { key: 'show_tags',  label: 'Show tags',        hint: 'Inventory tags' },
  { key: 'show_notes', label: 'Show case notes',  hint: 'The notes field below' },
] as const

export function CaseDetailModal({ holoCase, onClose, onChanged }: Props) {
  const [c, setC] = useState<CaseWithCard>(holoCase)
  const [location, setLocation] = useState(holoCase.location ?? '')
  const [notes, setNotes]       = useState(holoCase.notes ?? '')
  const [assigning, setAssigning] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && !assigning && onClose()
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose, assigning])

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true)
    try {
      const res = await fetch(`/api/cases/${c.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Update failed')
      }
      const updated: CaseWithCard = await res.json()
      setC(updated)
      onChanged(updated)
      return true
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete case ${c.short_code}? Its QR code will stop working.`)) return
    setBusy(true)
    const res = await fetch(`/api/cases/${c.id}`, { method: 'DELETE' })
    setBusy(false)
    if (res.ok) {
      toast.success('Case deleted')
      onChanged(null)
      onClose()
    } else {
      toast.error('Failed to delete case')
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(getCaseUrl(c.short_code))
      .then(() => toast.success('Link copied'))
      .catch(() => toast.error('Copy failed'))
  }

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
          <h2 className="font-semibold">
            HoloCase <span className="font-mono text-purple-300">{c.short_code}</span>
          </h2>
          <div className="flex items-center gap-1">
            <button onClick={copyLink} title="Copy public link" className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-zinc-800">
              <Copy className="w-4 h-4" />
            </button>
            <Link href={`/c/${c.short_code}`} target="_blank" title="Open public page" className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-zinc-800">
              <ExternalLink className="w-4 h-4" />
            </Link>
            <button onClick={onClose} className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-zinc-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 grid gap-6 sm:grid-cols-[auto_1fr]">
          {/* QR block */}
          <div className="flex flex-col items-center gap-4">
            <CaseQR shortCode={c.short_code} cardName={c.user_card?.card.name} />
          </div>

          {/* Settings */}
          <div className="flex flex-col gap-5 min-w-0">
            {/* Assignment */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">Card inside</h3>
              {c.user_card ? (
                <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                  {c.user_card.card.image_url_small && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.user_card.card.image_url_small} alt="" className="w-10 rounded-sm" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.user_card.card.name}</p>
                    <p className="text-xs text-zinc-500 truncate">
                      {c.user_card.card.set_name} #{c.user_card.card.number} · {PRINT_TYPE_LABELS[c.user_card.print_type]}
                    </p>
                  </div>
                  <button
                    onClick={() => patch({ user_card_id: null }).then(ok => ok && toast.success('Card unassigned'))}
                    disabled={busy}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                  >
                    <Unlink className="w-3.5 h-3.5" /> Unassign
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAssigning(true)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 py-3 text-sm text-zinc-400 hover:border-purple-500/50 hover:text-purple-300 transition-colors"
                >
                  <Link2 className="w-4 h-4" /> Assign a card from your inventory
                </button>
              )}
            </section>

            {/* Visibility */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">Public visibility</h3>
              <div className="rounded-lg border border-zinc-800 divide-y divide-zinc-800">
                {VISIBILITY_FLAGS.map(({ key, label, hint }) => (
                  <label key={key} className="flex items-center justify-between gap-3 px-3 py-2.5 cursor-pointer">
                    <span>
                      <span className="block text-sm">{label}</span>
                      <span className="block text-xs text-zinc-500">{hint}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={c[key]}
                      disabled={busy || (key !== 'is_public' && !c.is_public)}
                      onChange={e => patch({ [key]: e.target.checked })}
                      className="w-4 h-4 accent-purple-500 disabled:opacity-40"
                    />
                  </label>
                ))}
              </div>
            </section>

            {/* Location + notes */}
            <section className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1.5">
                  Location <span className="normal-case font-normal">(private, never shown)</span>
                </label>
                <input
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  onBlur={() => location !== (c.location ?? '') && patch({ location: location || null })}
                  placeholder="Binder A, page 3"
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1.5">
                  Case notes {c.show_notes && c.is_public ? '(shown on public page)' : '(hidden)'}
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  onBlur={() => notes !== (c.notes ?? '') && patch({ notes: notes || null })}
                  rows={3}
                  placeholder="Pulled from a 2023 Paldea Evolved booster box…"
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>
            </section>

            {/* Danger */}
            <button
              onClick={handleDelete}
              disabled={busy}
              className="self-start inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-red-400/80 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Delete case
            </button>
          </div>
        </div>
      </div>
    </div>

    {assigning && (
      <AssignCardModal
        caseId={c.id}
        shortCode={c.short_code}
        onClose={() => setAssigning(false)}
        onAssigned={updated => {
          setAssigning(false)
          setC(updated as CaseWithCard)
          onChanged(updated as CaseWithCard)
        }}
      />
    )}
    </>
  )
}
