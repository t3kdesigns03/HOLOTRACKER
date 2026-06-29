'use client'
// ============================================================
// CardViewer — fullscreen card lightbox to admire a card in 3D
// src/components/card/CardViewer.tsx
// ============================================================

import { useEffect } from 'react'
import { X, BarChart2 } from 'lucide-react'
import { HoloCard } from './HoloCard'
import type { PrintType } from '@/types'

interface CardViewerProps {
  imageUrl: string | null
  imageUrlSmall?: string | null
  name: string
  setName: string
  cardNumber: string
  rarity?: string | null
  printType?: PrintType
  marketPrice?: number | null
  onClose: () => void
  onViewAnalytics?: () => void
}

export function CardViewer({
  imageUrl,
  imageUrlSmall,
  name,
  setName,
  cardNumber,
  rarity,
  printType,
  marketPrice,
  onClose,
  onViewAnalytics,
}: CardViewerProps) {
  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Dark backdrop */}
      <div
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-5 right-5 z-10 p-2 rounded-full bg-zinc-800/80
          hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Card + info */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-4">
        {/* The star of the show */}
        <HoloCard
          imageUrl={imageUrl}
          imageUrlSmall={imageUrlSmall}
          name={name}
          rarity={rarity}
          printType={printType}
          width={300}
        />

        {/* Card info */}
        <div className="text-center space-y-1">
          <div className="text-xl font-bold text-white tracking-tight">{name}</div>
          <div className="text-sm text-zinc-500">
            {setName} &middot; #{cardNumber}
          </div>
          {rarity && (
            <div className="text-xs text-purple-400 font-medium">{rarity}</div>
          )}
          {marketPrice != null && (
            <div className="text-lg font-mono font-semibold text-emerald-400 mt-2">
              ${marketPrice.toFixed(2)}
            </div>
          )}
        </div>

        {/* Analytics CTA */}
        {onViewAnalytics && (
          <button
            onClick={onViewAnalytics}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl
              bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-500
              text-sm font-medium text-zinc-300 hover:text-white transition-all"
          >
            <BarChart2 className="w-4 h-4" />
            View Analytics
          </button>
        )}
      </div>
    </div>
  )
}
