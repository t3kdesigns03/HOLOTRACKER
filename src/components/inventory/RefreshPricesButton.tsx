'use client'
// ============================================================
// RefreshPricesButton — pulls condition-aware JustTCG prices
// for owned cards. Budget-aware: the API spends max ~8 JustTCG
// requests per click (free tier: 10/min) and reports progress.
// src/components/inventory/RefreshPricesButton.tsx
// ============================================================

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  /** Called after a successful refresh so the parent can re-fetch */
  onRefreshed?: () => void
}

export function RefreshPricesButton({ onRefreshed }: Props) {
  const [busy, setBusy] = useState(false)

  async function refresh() {
    setBusy(true)
    try {
      const res = await fetch('/api/prices/refresh', { method: 'POST' })
      const data = await res.json()

      if (res.status === 429) {
        toast.warning(data.error ?? 'Rate limited — try again in a minute')
        return
      }
      if (res.status === 501) {
        toast.info('JustTCG API key not configured')
        return
      }
      if (!res.ok) throw new Error(data.error)

      if (data.remaining > 0) {
        toast.success(
          `Prices updated for ${data.refreshed} card${data.refreshed === 1 ? '' : 's'} — ${data.remaining} to go, click again to continue`
        )
      } else if (data.refreshed > 0) {
        toast.success(`Prices up to date (${data.refreshed} refreshed)`)
      } else {
        toast.success('Prices already up to date')
      }
      if (data.unmatched > 0) {
        toast.info(`${data.unmatched} card${data.unmatched === 1 ? '' : 's'} couldn't be matched on JustTCG`)
      }
      if (data.refreshed > 0) onRefreshed?.()
    } catch (e: unknown) {
      toast.error(e instanceof Error && e.message ? e.message : 'Price refresh failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={refresh}
      disabled={busy}
      title="Refresh condition-aware prices (JustTCG)"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
        text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
    >
      <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
      Prices
    </button>
  )
}
