'use client'
// ============================================================
// BrandWordmark — the HOLOTRAKR identity.
//   HOLO  → blue-cyan neon holographic gradient, animated drift,
//           specular sheen that follows the cursor
//   TRAKR → digital mono, letterspaced, faint cyan edge-glow
// Pure CSS + a few lines of JS (no animation library).
// Usage: <BrandWordmark />  — inherits font-size from parent.
//        <BrandWordmark interactive />  — adds cursor-tracking sheen/tilt.
// src/components/ui/BrandWordmark.tsx
// ============================================================

import { useRef, useCallback } from 'react'

interface Props {
  /** Enable cursor-tracking sheen + hue shift (use on large renders) */
  interactive?: boolean
  className?: string
}

export function BrandWordmark({ interactive = false, className = '' }: Props) {
  const rootRef = useRef<HTMLSpanElement>(null)

  const onMove = useCallback((clientX: number, clientY: number) => {
    const el = rootRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const dx = (clientX - r.left) / r.width - 0.5   // -0.5 … 0.5
    const dy = (clientY - r.top) / r.height - 0.5
    el.style.setProperty('--bw-mx', `${((clientX - r.left) / r.width) * 100}%`)
    el.style.setProperty('--bw-hue', `${dx * 50}deg`)
    el.style.setProperty('--bw-tilt', `${dx * 4}deg`)
    el.style.setProperty('--bw-lift', `${dy * -2}px`)
    el.style.setProperty('--bw-sheen', '1')
  }, [])

  const onLeave = useCallback(() => {
    const el = rootRef.current
    if (!el) return
    el.style.setProperty('--bw-hue', '0deg')
    el.style.setProperty('--bw-tilt', '0deg')
    el.style.setProperty('--bw-lift', '0px')
    el.style.setProperty('--bw-sheen', '0')
  }, [])

  return (
    <span
      ref={rootRef}
      className={`bw-root ${className}`}
      onMouseMove={interactive ? e => onMove(e.clientX, e.clientY) : undefined}
      onMouseLeave={interactive ? onLeave : undefined}
      onTouchMove={interactive ? e => onMove(e.touches[0].clientX, e.touches[0].clientY) : undefined}
      onTouchEnd={interactive ? onLeave : undefined}
    >
      <style>{`
        @keyframes bwHoloDrift {
          0%, 100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        @keyframes bwGlowBreathe {
          from { filter: hue-rotate(var(--bw-hue, 0deg)) drop-shadow(0 0 10px rgba(56,189,248,.35)) drop-shadow(0 0 32px rgba(34,211,238,.18)); }
          to   { filter: hue-rotate(var(--bw-hue, 0deg)) drop-shadow(0 0 16px rgba(56,189,248,.55)) drop-shadow(0 0 48px rgba(34,211,238,.30)); }
        }
        @keyframes bwScan {
          0%, 100% { transform: translateY(-120%); opacity: 0; }
          10%, 90% { opacity: .5; }
          50%      { transform: translateY(120%); }
        }
        .bw-root {
          display: inline-block;
          position: relative;
          white-space: nowrap;
          transform: perspective(600px) rotateY(var(--bw-tilt, 0deg)) translateY(var(--bw-lift, 0px));
          transition: transform .15s ease-out;
        }
        .bw-holo {
          font-weight: 800;
          letter-spacing: -0.02em;
          background: linear-gradient(115deg,
            #e0f2fe 0%, #7dd3fc 18%, #38bdf8 36%, #22d3ee 52%,
            #818cf8 70%, #38bdf8 86%, #e0f2fe 100%);
          background-size: 250% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation:
            bwHoloDrift 7s ease-in-out infinite,
            bwGlowBreathe 3.2s ease-in-out infinite alternate;
        }
        .bw-trakr {
          font-family: ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, monospace;
          font-weight: 700;
          font-size: 0.92em;
          letter-spacing: 0.06em;
          margin-left: 0.04em;
          color: #f4f4f5;
          -webkit-text-fill-color: #f4f4f5; /* survive parent text-fill:transparent */
          text-shadow:
            0 0 1px rgba(244,244,245,.9),
            0 0 12px rgba(34,211,238,.25),
            0 1px 0 rgba(8,47,73,.8);
          position: relative;
          display: inline-block;
          overflow: hidden;
        }
        /* Digital scanline drifting down TRAKR */
        .bw-trakr::after {
          content: '';
          position: absolute;
          left: 0; right: 0; top: 0;
          height: 34%;
          background: linear-gradient(to bottom, transparent, rgba(34,211,238,.16), transparent);
          animation: bwScan 5s ease-in-out 2s infinite;
          pointer-events: none;
        }
        /* Specular sheen following the cursor (interactive only) */
        .bw-sheen {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: var(--bw-sheen, 0);
          transition: opacity .25s ease;
          background: radial-gradient(ellipse 30% 90% at var(--bw-mx, 50%) 50%,
            rgba(255,255,255,.35) 0%, transparent 70%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          font: inherit;
          letter-spacing: inherit;
        }
      `}</style>
      <span className="bw-holo">HOLO</span><span className="bw-trakr">TRAKR</span>
      {interactive && (
        <span className="bw-sheen" aria-hidden="true">
          <span style={{ fontWeight: 800, letterSpacing: '-0.02em' }}>HOLO</span>
          <span style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontWeight: 700, fontSize: '0.92em', letterSpacing: '0.06em', marginLeft: '0.04em' }}>TRAKR</span>
        </span>
      )}
    </span>
  )
}
