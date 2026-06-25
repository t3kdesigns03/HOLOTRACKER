'use client'
// src/components/inventory/InventoryTableRow.tsx

import { useState } from 'react'
import { MoreHorizontal, Trash2, DollarSign, Edit2, Eye } from 'lucide-react'
import { MiniCard } from '@/components/card/HoloCard'
import {
  CONDITION_COLORS, PRINT_TYPE_LABELS, STATUS_COLORS, STATUS_LABELS,
  type InventoryCard
} from '@/types'
import { cn } from '@/lib/utils'
import { RecordSaleModal } from './RecordSaleModal'

interface Props {
  card: InventoryCard
  onDelete: (id: string) => void
  onRefresh: () => void
}

export function InventoryTableRow({ card, onDelete, onRefresh }: Props) {
  const [showMenu,    setShowMenu]    = useState(false)
  const [showSellModal, setShowSellModal] = useState(false)

  const pl = card.unrealized_pl
  const plColor = pl == null ? 'text-zinc-700'
    : pl > 0 ? 'text-emerald-400'
    : pl < 0 ? 'text-red-400'
    : 'text-zinc-500'

  const plPct = pl != null && card.cost_basis
    ? ((pl / (card.cost_basis * card.quantity)) * 100)
    : null

  return (
    <>
      <tr className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors group">
        {/* Card */}
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <MiniCard
              imageUrl={card.card.image_url}
              imageUrlSmall={card.card.image_url_small}
              name={card.card.name}
              rarity={card.card.rarity}
              printType={card.print_type as Parameters<typeof MiniCard>[0]['printType']}
              size={44}
            />
            <div className="min-w-0">
              <div className="font-medium text-white text-sm truncate max-w-[160px]">
                {card.card.name}
              </div>
              <div className="text-xs text-zinc-600 truncate">
                {card.card.set_name} · #{card.card.number}
              </div>
            </div>
          </div>
        </td>

        {/* Print / Condition */}
        <td className="px-3 py-2.5">
          <div className="text-xs text-zinc-400">
            {PRINT_TYPE_LABELS[card.print_type as keyof typeof PRINT_TYPE_LABELS] ?? card.print_type}
          </div>
          <div className={`text-xs mt-0.5 ${CONDITION_COLORS[card.condition] ?? 'text-zinc-500'}`}>
            {card.condition}
          </div>
        </td>

        {/* Qty */}
        <td className="px-3 py-2.5 text-sm text-zinc-300 font-mono">
          {card.quantity}
        </td>

        {/* Cost */}
        <td className="px-3 py-2.5 font-mono text-xs">
          {card.cost_basis != null ? (
            <div>
              <div className="text-zinc-400">${card.cost_basis.toFixed(2)}</div>
              {card.quantity > 1 && (
                <div className="text-zinc-700">${(card.cost_basis * card.quantity).toFixed(2)} total</div>
              )}
            </div>
          ) : (
            <span className="text-zinc-700">—</span>
          )}
        </td>

        {/* Market value */}
        <td className="px-3 py-2.5 font-mono text-xs">
          {card.market_price != null ? (
            <div>
              <div className="text-emerald-400">${card.market_price.toFixed(2)}</div>
              {card.quantity > 1 && (
                <div className="text-zinc-600">${(card.market_price * card.quantity).toFixed(2)} total</div>
              )}
            </div>
          ) : (
            <span className="text-zinc-700">—</span>
          )}
        </td>

        {/* P/L */}
        <td className="px-3 py-2.5 font-mono text-xs">
          {pl != null ? (
            <div>
              <div className={plColor}>
                {pl >= 0 ? '+' : ''}${pl.toFixed(2)}
              </div>
              {plPct != null && (
                <div className={cn('text-[10px]', plColor, 'opacity-70')}>
                  {plPct >= 0 ? '+' : ''}{plPct.toFixed(1)}%
                </div>
              )}
            </div>
          ) : (
            <span className="text-zinc-700">—</span>
          )}
        </td>

        {/* Status */}
        <td className="px-3 py-2.5">
          <span className={cn(
            'text-[10px] px-1.5 py-0.5 rounded border font-medium',
            STATUS_COLORS[card.status]
          )}>
            {STATUS_LABELS[card.status]}
          </span>
        </td>

        {/* Actions */}
        <td className="px-3 py-2.5">
          <div className="relative">
            <button
              onClick={() => setShowMenu(v => !v)}
              className="p-1.5 rounded-lg text-zinc-700 hover:text-zinc-300 hover:bg-zinc-700
                transition-colors opacity-0 group-hover:opacity-100"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-8 z-20 w-40
                  bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
                  <button
                    onClick={() => { setShowMenu(false); setShowSellModal(true) }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-zinc-300
                      hover:bg-zinc-800 transition-colors text-left"
                  >
                    <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                    Record Sale
                  </button>
                  <button
                    onClick={() => { setShowMenu(false) }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-zinc-300
                      hover:bg-zinc-800 transition-colors text-left"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                    Edit
                  </button>
                  <div className="border-t border-zinc-800 my-0.5" />
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      if (confirm('Remove this card from inventory?')) onDelete(card.id)
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-400
                      hover:bg-zinc-800 transition-colors text-left"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
                </div>
              </>
            )}
          </div>
        </td>
      </tr>

      {showSellModal && (
        <RecordSaleModal
          card={card}
          onClose={() => setShowSellModal(false)}
          onSuccess={() => { setShowSellModal(false); onRefresh() }}
        />
      )}
    </>
  )
}
