'use client'
// ============================================================
// HeroHoloCard — interactive 3D holo card + random-card fetch
// Shared by the login and onboarding screens.
// src/components/card/HeroHoloCard.tsx
// ============================================================

import { useEffect, useRef } from 'react'

export interface HeroCardData {
  id: string; name: string; images: { large: string }
  hp?: string; types?: string[]; set: { name: string }
}

const RARITY_QUERIES = [
  'rarity:"Special Illustration Rare"',
  'rarity:"Illustration Rare"',
  'rarity:"Hyper Rare"',
  'rarity:"Ultra Rare"',
]

export async function fetchRandomCard(): Promise<HeroCardData | null> {
  try {
    const q = RARITY_QUERIES[Math.floor(Math.random() * RARITY_QUERIES.length)]
    const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&page=${Math.floor(Math.random() * 8) + 1}&pageSize=20&select=id,name,images,hp,types,set`)
    if (!res.ok) return null
    const data = await res.json()
    const cards: HeroCardData[] = data.data ?? []
    return cards.length ? cards[Math.floor(Math.random() * cards.length)] : null
  } catch { return null }
}

export function HeroHoloCard({ card, loading }: { card: HeroCardData | null; loading: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const holoRef = useRef<HTMLDivElement>(null)
  const shimmerRef = useRef<HTMLDivElement>(null)
  const rainbowRef = useRef<HTMLDivElement>(null)
  const foilRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const idleRef = useRef(true)
  const angleRef = useRef(0)

  const typeColor: Record<string, string> = {
    Fire: '#f97316', Water: '#38bdf8', Grass: '#4ade80', Electric: '#fbbf24',
    Psychic: '#c084fc', Dark: '#6366f1', Dragon: '#818cf8', Colorless: '#94a3b8',
    Fighting: '#d97706', Metal: '#94a3b8', Fairy: '#f472b6',
  }
  const glowColor = typeColor[card?.types?.[0] ?? ''] ?? '#a855f7'

  useEffect(() => {
    const scene = sceneRef.current; const wrap = wrapRef.current
    const holo = holoRef.current; const shimmer = shimmerRef.current
    const rainbow = rainbowRef.current; const foil = foilRef.current
    if (!scene || !wrap || !holo || !shimmer || !rainbow || !foil) return

    function idleFloat() {
      if (!idleRef.current) return
      angleRef.current += 0.007
      wrap!.style.transform = `rotateX(${Math.sin(angleRef.current) * 7}deg) rotateY(${Math.cos(angleRef.current * 0.7) * 5}deg)`
      holo!.style.opacity = '0.14'; foil!.style.opacity = '0.45'
      rafRef.current = requestAnimationFrame(idleFloat)
    }
    rafRef.current = requestAnimationFrame(idleFloat)

    function onMove(clientX: number, clientY: number) {
      idleRef.current = false; cancelAnimationFrame(rafRef.current)
      const rect = scene!.getBoundingClientRect()
      const dx = (clientX - rect.left - rect.width / 2) / (rect.width / 2)
      const dy = (clientY - rect.top - rect.height / 2) / (rect.height / 2)
      wrap!.style.transform = `rotateX(${-dy * 24}deg) rotateY(${dx * 24}deg)`
      shimmer!.style.setProperty('--mx', (((clientX - rect.left) / rect.width) * 100).toFixed(1) + '%')
      shimmer!.style.setProperty('--my', (((clientY - rect.top) / rect.height) * 100).toFixed(1) + '%')
      const intensity = Math.sqrt(dx * dx + dy * dy)
      holo!.style.opacity = Math.min(0.3 + intensity * 0.4, 0.75).toFixed(2)
      shimmer!.style.opacity = Math.min(0.45 + intensity * 0.45, 0.95).toFixed(2)
      rainbow!.style.opacity = Math.min(0.35 + intensity * 0.45, 0.85).toFixed(2)
      rainbow!.style.setProperty('--angle', (Math.atan2(dy, dx) * 180 / Math.PI + 135) + 'deg')
      foil!.style.opacity = Math.min(0.55 + intensity * 0.55, 1).toFixed(2)
    }
    const onMouseLeave = () => { idleRef.current = true; shimmer!.style.opacity = '0'; rainbow!.style.opacity = '0'; rafRef.current = requestAnimationFrame(idleFloat) }
    const onTouchEnd = () => { idleRef.current = true; shimmer!.style.opacity = '0'; rainbow!.style.opacity = '0'; rafRef.current = requestAnimationFrame(idleFloat) }
    scene.addEventListener('mousemove', e => onMove(e.clientX, e.clientY))
    scene.addEventListener('mouseleave', onMouseLeave)
    scene.addEventListener('touchmove', e => { e.preventDefault(); onMove(e.touches[0].clientX, e.touches[0].clientY) }, { passive: false })
    scene.addEventListener('touchend', onTouchEnd)
    return () => { cancelAnimationFrame(rafRef.current) }
  }, [])

  return (
    <div ref={sceneRef} style={{ perspective: '1000px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div ref={wrapRef} style={{ transformStyle: 'preserve-3d', transition: 'transform 0.07s ease-out', willChange: 'transform', cursor: 'grab' }}>
        <div style={{ width: 280, height: 390, borderRadius: 18, position: 'relative', overflow: 'hidden', boxShadow: `0 40px 100px ${glowColor}55, 0 0 0 1px rgba(255,255,255,0.13), 0 0 80px ${glowColor}30` }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(145deg,#08081a 0%,#100f2a 40%,#09091f 100%)' }} />
          {card && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.images.large} alt={card.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 18, transition: 'opacity 0.6s ease' }} />
          )}
          {loading && <div style={{ position: 'absolute', inset: 0, borderRadius: 18, background: 'linear-gradient(90deg, rgba(168,85,247,0.05) 25%, rgba(168,85,247,0.12) 50%, rgba(168,85,247,0.05) 75%)', backgroundSize: '200% 100%', animation: 'htSkeletonShimmer 1.6s ease-in-out infinite' }} />}
          <div ref={foilRef} style={{ position: 'absolute', inset: 0, borderRadius: 18, pointerEvents: 'none', opacity: 0, transition: 'opacity 0.1s', backgroundImage: 'repeating-linear-gradient(108deg, transparent 0px, transparent 2px, rgba(255,255,255,0.022) 2px, rgba(255,255,255,0.022) 3px)' }} />
          <div ref={holoRef} style={{ position: 'absolute', inset: 0, opacity: 0, transition: 'opacity 0.1s', pointerEvents: 'none', background: 'conic-gradient(from 0deg at 50% 50%, #ff006685, #ff6b0085, #ffff0085, #00ff8885, #00b4ff85, #7b2fff85, #ff006685)', mixBlendMode: 'screen', borderRadius: 18 }} />
          <div ref={rainbowRef} style={{ position: 'absolute', inset: 0, borderRadius: 18, opacity: 0, transition: 'opacity 0.1s', pointerEvents: 'none', background: 'linear-gradient(var(--angle,135deg), rgba(255,0,80,0.3), rgba(255,160,0,0.3), rgba(80,255,0,0.3), rgba(0,180,255,0.3), rgba(140,0,255,0.3))', mixBlendMode: 'screen' } as React.CSSProperties} />
          <div ref={shimmerRef} style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 55% 35% at var(--mx,50%) var(--my,50%), rgba(255,255,255,0.22) 0%, transparent 70%)', transition: 'opacity 0.1s' } as React.CSSProperties} />
          {card && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, transparent 100%)', padding: '28px 12px 12px', borderRadius: '0 0 18px 18px', pointerEvents: 'none' }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 8, fontFamily: 'system-ui,sans-serif', letterSpacing: '0.1em', fontWeight: 600, margin: '0 0 2px', textTransform: 'uppercase' }}>{card.set.name}</p>
              <p style={{ color: '#fff', fontSize: 12, fontFamily: 'system-ui,sans-serif', fontWeight: 700, margin: 0, textShadow: `0 0 12px ${glowColor}` }}>{card.name}</p>
            </div>
          )}
          <div style={{ position: 'absolute', inset: 7, border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: 12, pointerEvents: 'none', zIndex: 30 }} />
        </div>
      </div>
    </div>
  )
}
