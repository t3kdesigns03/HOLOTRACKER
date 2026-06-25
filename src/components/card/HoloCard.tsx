'use client'
// ============================================================
// HoloCard — 3D tilt + holographic shine for real Pokémon cards
// src/components/card/HoloCard.tsx
//
// Adapted from the original JokeMon 3D viewer but redesigned
// to work with real card images from pokemontcg.io.
// No R3F required — pure CSS transforms + canvas grain.
// ============================================================

import React, { useRef, useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { isHoloCard, type PrintType } from '@/types'

export interface HoloCardProps {
  imageUrl: string | null
  imageUrlSmall?: string | null
  name: string
  rarity?: string | null
  printType?: PrintType
  /** px — rendered size. Card is always 2.5:3.5 ratio */
  width?: number
  /** If true, card is in a gallery — smaller effects */
  compact?: boolean
  /** Disable all hover effects (e.g. in table rows) */
  static?: boolean
  onClick?: () => void
  className?: string
}

// Rarity → effect intensity
function getEffectConfig(rarity?: string | null, printType?: PrintType) {
  const holo = isHoloCard(rarity, printType)

  if (rarity?.includes('Hyper') || rarity?.includes('Rainbow') || rarity?.includes('Special Illustration')) {
    return { shine: 1.0, rainbow: true, shimmer: true, grain: 0.4, tiltMax: 20 }
  }
  if (rarity?.includes('Full Art') || rarity?.includes('Alt Art') || rarity?.includes('Illustration Rare')) {
    return { shine: 0.85, rainbow: false, shimmer: true, grain: 0.3, tiltMax: 18 }
  }
  if (rarity?.includes('Rare Secret') || rarity?.includes('Rare Ultra')) {
    return { shine: 0.8, rainbow: true, shimmer: true, grain: 0.35, tiltMax: 18 }
  }
  if (holo) {
    return { shine: 0.65, rainbow: false, shimmer: true, grain: 0.25, tiltMax: 15 }
  }
  if (printType === 'reverseHolofoil') {
    return { shine: 0.45, rainbow: false, shimmer: true, grain: 0.15, tiltMax: 12 }
  }
  // Common / non-holo
  return { shine: 0.2, rainbow: false, shimmer: false, grain: 0.0, tiltMax: 10 }
}

export function HoloCard({
  imageUrl,
  imageUrlSmall,
  name,
  rarity,
  printType = 'normal',
  width = 220,
  compact = false,
  static: isStatic = false,
  onClick,
  className = '',
}: HoloCardProps) {
  const cardRef   = useRef<HTMLDivElement>(null)
  const grainRef  = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)

  const [tilt, setTilt]     = useState({ x: 0, y: 0 })
  const [shine, setShine]   = useState({ x: 50, y: 50 })
  const [hovered, setHovered] = useState(false)

  const cfg = getEffectConfig(rarity, printType)
  const height = Math.round(width * (3.5 / 2.5))

  // ── Grain canvas ──────────────────────────────────────────
  useEffect(() => {
    if (!cfg.grain || isStatic) return
    const canvas = grainRef.current
    if (!canvas) return
    canvas.width  = 256
    canvas.height = 358
    const ctx = canvas.getContext('2d')!
    const data = ctx.createImageData(256, 358)

    function regenerate() {
      for (let i = 0; i < data.data.length; i += 4) {
        const v = Math.random() * 255
        data.data[i]     = v
        data.data[i + 1] = v
        data.data[i + 2] = v
        data.data[i + 3] = Math.random() * 40 * cfg.grain
      }
      ctx.putImageData(data, 0, 0)
      rafRef.current = requestAnimationFrame(regenerate)
    }
    regenerate()
    return () => cancelAnimationFrame(rafRef.current)
  }, [cfg.grain, isStatic])

  // ── Mouse handlers ────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isStatic || !cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width   // 0..1
    const y = (e.clientY - rect.top)  / rect.height  // 0..1

    const rotY =  (x - 0.5) * cfg.tiltMax * 2
    const rotX = -(y - 0.5) * cfg.tiltMax * 2

    setTilt({ x: rotX, y: rotY })
    setShine({ x: x * 100, y: y * 100 })
  }, [isStatic, cfg.tiltMax])

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 })
    setShine({ x: 50, y: 50 })
    setHovered(false)
  }, [])

  // ── Shine gradient string ─────────────────────────────────
  const shineGradient = cfg.rainbow
    ? `
      radial-gradient(
        ellipse at ${shine.x}% ${shine.y}%,
        rgba(255,255,255,0.0) 10%,
        rgba(255,255,255,0.08) 30%,
        rgba(255,255,255,0.0) 60%
      ),
      linear-gradient(
        ${125 + tilt.y * 2}deg,
        transparent 10%,
        rgba(255, 80, 80, ${cfg.shine * 0.35}) 25%,
        rgba(255, 200, 80, ${cfg.shine * 0.35}) 35%,
        rgba(80, 255, 120, ${cfg.shine * 0.35}) 45%,
        rgba(80, 180, 255, ${cfg.shine * 0.35}) 55%,
        rgba(160, 80, 255, ${cfg.shine * 0.35}) 65%,
        transparent 80%
      )
    `
    : cfg.shimmer
    ? `
      radial-gradient(
        ellipse at ${shine.x}% ${shine.y}%,
        rgba(255,255,255,${cfg.shine * 0.55}) 0%,
        rgba(200,220,255,${cfg.shine * 0.3}) 35%,
        transparent 70%
      )
    `
    : `
      radial-gradient(
        ellipse at ${shine.x}% ${shine.y}%,
        rgba(255,255,255,${cfg.shine * 0.3}) 0%,
        transparent 60%
      )
    `

  const cardStyle: React.CSSProperties = {
    width,
    height,
    transform: isStatic
      ? 'none'
      : `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${hovered ? 1.04 : 1})`,
    transition: hovered
      ? 'transform 0.05s ease-out'
      : 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
  }

  const fallback = (
    <div
      className="flex items-center justify-center text-zinc-600 text-xs font-mono"
      style={{ width, height }}
    >
      <div className="text-center p-2">
        <div className="text-2xl mb-1">🃏</div>
        <div>{name}</div>
      </div>
    </div>
  )

  return (
    <div
      ref={cardRef}
      className={`relative select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={cardStyle}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      {/* Card image */}
      <div
        className="relative w-full h-full rounded-[4.5%] overflow-hidden"
        style={{
          boxShadow: hovered && !isStatic
            ? `0 ${14 + Math.abs(tilt.x) * 0.8}px ${40 + Math.abs(tilt.y) * 2}px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.08)`
            : '0 4px 16px rgba(0,0,0,0.5)',
        }}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes={`${width}px`}
            className="object-contain"
            priority={false}
            placeholder={imageUrlSmall ? 'blur' : 'empty'}
            blurDataURL={imageUrlSmall ?? undefined}
          />
        ) : fallback}

        {/* Holographic shine overlay */}
        {!isStatic && (hovered || compact) && (
          <div
            className="absolute inset-0 rounded-[4.5%] pointer-events-none mix-blend-screen"
            style={{ background: shineGradient, opacity: hovered ? 1 : 0.4 }}
          />
        )}

        {/* Always-on subtle sheen for holo cards in compact mode */}
        {isStatic && cfg.shimmer && (
          <div
            className="absolute inset-0 rounded-[4.5%] pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, transparent 40%, rgba(160,200,255,0.12) 60%, transparent 70%)',
            }}
          />
        )}

        {/* Grain texture */}
        {cfg.grain > 0 && !isStatic && (
          <canvas
            ref={grainRef}
            className="absolute inset-0 w-full h-full rounded-[4.5%] pointer-events-none mix-blend-overlay"
            style={{ opacity: hovered ? 0.6 : 0 }}
          />
        )}

        {/* Edge glare */}
        {hovered && !isStatic && (
          <div
            className="absolute inset-0 rounded-[4.5%] pointer-events-none"
            style={{
              background: `linear-gradient(
                ${160 + tilt.y * 3}deg,
                rgba(255,255,255,${0.05 + (tilt.x / cfg.tiltMax) * 0.05}) 0%,
                transparent 40%,
                transparent 60%,
                rgba(0,0,0,${0.05 + (-tilt.x / cfg.tiltMax) * 0.05}) 100%
              )`,
            }}
          />
        )}
      </div>

      {/* Rarity badge (compact mode) */}
      {compact && rarity && (
        <div className="absolute -bottom-5 left-0 right-0 flex justify-center">
          <span className="text-[9px] text-zinc-500 truncate max-w-full px-1">{rarity}</span>
        </div>
      )}
    </div>
  )
}

// ── Mini card (for table rows) ────────────────────────────────

export function MiniCard({
  imageUrl,
  imageUrlSmall,
  name,
  rarity,
  printType,
  size = 48,
}: {
  imageUrl: string | null
  imageUrlSmall?: string | null
  name: string
  rarity?: string | null
  printType?: PrintType
  size?: number
}) {
  return (
    <HoloCard
      imageUrl={imageUrl}
      imageUrlSmall={imageUrlSmall}
      name={name}
      rarity={rarity}
      printType={printType}
      width={size}
      static
    />
  )
}
