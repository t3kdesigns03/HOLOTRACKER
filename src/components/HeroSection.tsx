"use client"

import { useEffect, useRef, useState, useCallback } from "react"

// ─── Types ────────────────────────────────────────────────────────────────────
interface CardData {
  id: string
  name: string
  images: { large: string }
  hp?: string
  types?: string[]
  rarity?: string
  set: { name: string; series: string }
  attacks?: Array<{ name: string; damage: string }>
}

// ─── Holographic Card ─────────────────────────────────────────────────────────
function HoloCard({ card, loading }: { card: CardData | null; loading: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const holoRef = useRef<HTMLDivElement>(null)
  const shimmerRef = useRef<HTMLDivElement>(null)
  const rainbowRef = useRef<HTMLDivElement>(null)
  const foilRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const idleRef = useRef(true)
  const angleRef = useRef(0)

  useEffect(() => {
    const scene = sceneRef.current
    const wrap = wrapRef.current
    const holo = holoRef.current
    const shimmer = shimmerRef.current
    const rainbow = rainbowRef.current
    const foil = foilRef.current
    if (!scene || !wrap || !holo || !shimmer || !rainbow || !foil) return

    function idleFloat() {
      if (!idleRef.current) return
      angleRef.current += 0.007
      const rx = Math.sin(angleRef.current) * 7
      const ry = Math.cos(angleRef.current * 0.7) * 5
      wrap!.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`
      holo!.style.opacity = "0.14"
      foil!.style.opacity = "0.45"
      rafRef.current = requestAnimationFrame(idleFloat)
    }
    rafRef.current = requestAnimationFrame(idleFloat)

    function onMove(clientX: number, clientY: number) {
      idleRef.current = false
      cancelAnimationFrame(rafRef.current)
      const rect = scene!.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = (clientX - cx) / (rect.width / 2)
      const dy = (clientY - cy) / (rect.height / 2)
      wrap!.style.transform = `rotateX(${-dy * 24}deg) rotateY(${dx * 24}deg)`
      const mx = (((clientX - rect.left) / rect.width) * 100).toFixed(1)
      const my = (((clientY - rect.top) / rect.height) * 100).toFixed(1)
      shimmer!.style.setProperty("--mx", mx + "%")
      shimmer!.style.setProperty("--my", my + "%")
      const intensity = Math.sqrt(dx * dx + dy * dy)
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI
      holo!.style.opacity = Math.min(0.3 + intensity * 0.4, 0.75).toFixed(2)
      shimmer!.style.opacity = Math.min(0.45 + intensity * 0.45, 0.95).toFixed(2)
      rainbow!.style.opacity = Math.min(0.35 + intensity * 0.45, 0.85).toFixed(2)
      rainbow!.style.setProperty("--angle", angle + 135 + "deg")
      foil!.style.opacity = Math.min(0.55 + intensity * 0.55, 1).toFixed(2)
    }

    const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY)
    const onMouseLeave = () => {
      idleRef.current = true
      shimmer!.style.opacity = "0"
      rainbow!.style.opacity = "0"
      rafRef.current = requestAnimationFrame(idleFloat)
    }
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); onMove(e.touches[0].clientX, e.touches[0].clientY) }
    const onTouchEnd = () => { idleRef.current = true; shimmer!.style.opacity = "0"; rainbow!.style.opacity = "0"; rafRef.current = requestAnimationFrame(idleFloat) }

    scene.addEventListener("mousemove", onMouseMove)
    scene.addEventListener("mouseleave", onMouseLeave)
    scene.addEventListener("touchmove", onTouchMove, { passive: false })
    scene.addEventListener("touchend", onTouchEnd)
    return () => {
      cancelAnimationFrame(rafRef.current)
      scene.removeEventListener("mousemove", onMouseMove)
      scene.removeEventListener("mouseleave", onMouseLeave)
      scene.removeEventListener("touchmove", onTouchMove)
      scene.removeEventListener("touchend", onTouchEnd)
    }
  }, [])

  const typeColor: Record<string, string> = {
    Fire: "#f97316", Water: "#38bdf8", Grass: "#4ade80", Electric: "#fbbf24",
    Psychic: "#c084fc", Dark: "#6366f1", Dragon: "#818cf8", Colorless: "#94a3b8",
    Fighting: "#d97706", Metal: "#94a3b8", Fairy: "#f472b6",
  }
  const primaryType = card?.types?.[0] ?? "Psychic"
  const glowColor = typeColor[primaryType] ?? "#a855f7"

  return (
    <div ref={sceneRef} style={{ perspective: "1000px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div ref={wrapRef} style={{ transformStyle: "preserve-3d", transition: "transform 0.07s ease-out", willChange: "transform", cursor: "grab" }}>
        <div style={{
          width: 300, height: 418, borderRadius: 20, position: "relative", overflow: "hidden",
          boxShadow: `0 40px 100px ${glowColor}55, 0 0 0 1px rgba(255,255,255,0.13), 0 0 80px ${glowColor}30`
        }}>
          {/* Base bg while loading */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(145deg,#08081a 0%,#100f2a 40%,#09091f 100%)" }} />

          {/* Real card art */}
          {card && (
            <img
              src={card.images.large}
              alt={card.name}
              style={{
                position: "absolute", inset: 0, width: "100%", height: "100%",
                objectFit: "cover", borderRadius: 20,
                transition: "opacity 0.6s ease",
              }}
            />
          )}

          {/* Loading shimmer skeleton */}
          {loading && (
            <div style={{
              position: "absolute", inset: 0, borderRadius: 20,
              background: "linear-gradient(90deg, rgba(168,85,247,0.05) 25%, rgba(168,85,247,0.12) 50%, rgba(168,85,247,0.05) 75%)",
              backgroundSize: "200% 100%",
              animation: "htSkeletonShimmer 1.6s ease-in-out infinite"
            }} />
          )}

          {/* Foil scanlines — always on top */}
          <div ref={foilRef} style={{
            position: "absolute", inset: 0, borderRadius: 20, pointerEvents: "none",
            opacity: 0, transition: "opacity 0.1s",
            backgroundImage: "repeating-linear-gradient(108deg, transparent 0px, transparent 2px, rgba(255,255,255,0.022) 2px, rgba(255,255,255,0.022) 3px)"
          }} />

          {/* Holo conic */}
          <div ref={holoRef} style={{
            position: "absolute", inset: 0, opacity: 0, transition: "opacity 0.1s", pointerEvents: "none",
            background: "conic-gradient(from 0deg at 50% 50%, #ff006685, #ff6b0085, #ffff0085, #00ff8885, #00b4ff85, #7b2fff85, #ff006685)",
            mixBlendMode: "screen", borderRadius: 20
          }} />

          {/* Rainbow edge */}
          <div ref={rainbowRef} style={{
            position: "absolute", inset: 0, borderRadius: 20, opacity: 0,
            transition: "opacity 0.1s", pointerEvents: "none",
            background: "linear-gradient(var(--angle,135deg), rgba(255,0,80,0.3), rgba(255,160,0,0.3), rgba(80,255,0,0.3), rgba(0,180,255,0.3), rgba(140,0,255,0.3))",
            mixBlendMode: "screen"
          } as React.CSSProperties} />

          {/* Shimmer light source */}
          <div ref={shimmerRef} style={{
            position: "absolute", inset: 0, opacity: 0, pointerEvents: "none",
            background: "radial-gradient(ellipse 55% 35% at var(--mx,50%) var(--my,50%), rgba(255,255,255,0.22) 0%, transparent 70%)",
            transition: "opacity 0.1s"
          } as React.CSSProperties} />

          {/* Card name overlay at bottom — only show when card loaded */}
          {card && (
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, transparent 100%)",
              padding: "32px 14px 14px", borderRadius: "0 0 20px 20px", pointerEvents: "none"
            }}>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                <div>
                  <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 9, fontFamily: "system-ui,sans-serif", letterSpacing: "0.1em", fontWeight: 600, margin: "0 0 2px", textTransform: "uppercase" }}>{card.set.name}</p>
                  <p style={{ color: "#fff", fontSize: 13, fontFamily: "system-ui,sans-serif", fontWeight: 700, margin: 0, textShadow: `0 0 12px ${glowColor}` }}>{card.name}</p>
                </div>
                {card.hp && (
                  <div style={{ background: "rgba(0,0,0,0.5)", border: `0.5px solid ${glowColor}60`, borderRadius: 20, padding: "2px 8px" }}>
                    <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 9, fontFamily: "system-ui,sans-serif" }}>HP </span>
                    <span style={{ color: glowColor, fontWeight: 700, fontSize: 12, fontFamily: "system-ui,sans-serif", textShadow: `0 0 8px ${glowColor}` }}>{card.hp}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Card borders */}
          <div style={{ position: "absolute", inset: 8, border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: 13, pointerEvents: "none", zIndex: 30 }} />
          <div style={{ position: "absolute", inset: 11, border: "0.5px solid rgba(255,255,255,0.05)", borderRadius: 10, pointerEvents: "none", zIndex: 30 }} />
        </div>
      </div>
    </div>
  )
}

// ─── Floating Particles ───────────────────────────────────────────────────────
function FloatingParticles() {
  const p = useRef<Array<{ x: string; size: number; dur: string; delay: string; color: string }>>([])
  if (p.current.length === 0) {
    const cols = ["#a855f7","#7c3aed","#6366f1","#ec4899","#3b82f6","#06b6d4","#f0abfc"]
    for (let i = 0; i < 22; i++) p.current.push({ x: Math.random() * 100 + "%", size: Math.random() * 3.5 + 1, dur: (7 + Math.random() * 14).toFixed(1) + "s", delay: (Math.random() * 12).toFixed(1) + "s", color: cols[i % cols.length] })
  }
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {p.current.map((pt, i) => (
        <div key={i} style={{ position: "absolute", bottom: -10, left: pt.x, width: pt.size, height: pt.size, background: pt.color, borderRadius: "50%", boxShadow: `0 0 ${pt.size * 3}px ${pt.color}`, opacity: 0.45, animation: `htFloat ${pt.dur} ease-in-out ${pt.delay} infinite` }} />
      ))}
    </div>
  )
}

// ─── Rarity pools for the API query ──────────────────────────────────────────
const RARITY_QUERIES = [
  'rarity:"Special Illustration Rare"',
  'rarity:"Illustration Rare"',
  'rarity:"Hyper Rare"',
  'rarity:"Ultra Rare"',
]

async function fetchRandomHighRarityCard(): Promise<CardData | null> {
  try {
    const query = RARITY_QUERIES[Math.floor(Math.random() * RARITY_QUERIES.length)]
    const page = Math.floor(Math.random() * 8) + 1

    const res = await fetch(
      `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(query)}&page=${page}&pageSize=20&select=id,name,images,hp,types,rarity,set,attacks`,

    )
    if (!res.ok) throw new Error("API error")
    const data = await res.json()
    const cards: CardData[] = data.data ?? []
    if (cards.length === 0) return null
    // Pick random card from results
    return cards[Math.floor(Math.random() * cards.length)]
  } catch {
    return null
  }
}

// ─── Hero Section ─────────────────────────────────────────────────────────────
export default function HeroSection() {
  const [mounted, setMounted] = useState(false)
  const [card, setCard] = useState<CardData | null>(null)
  const [cardLoading, setCardLoading] = useState(true)
  const starsRef = useRef<Array<{ sz: number; op: string; top: string; left: string; dur: string; del: string }>>([])

  // Pre-generate stars once so SSR/CSR match
  if (starsRef.current.length === 0) {
    for (let i = 0; i < 110; i++) {
      starsRef.current.push({
        sz: Math.random() * 1.8 + 0.3,
        op: (0.15 + Math.random() * 0.65).toFixed(2),
        top: Math.random() * 100 + "%",
        left: Math.random() * 100 + "%",
        dur: (1.5 + Math.random() * 4).toFixed(1) + "s",
        del: (Math.random() * 5).toFixed(1) + "s",
      })
    }
  }

  const loadCard = useCallback(async () => {
    setCardLoading(true)
    const result = await fetchRandomHighRarityCard()
    setCard(result)
    setCardLoading(false)
  }, [])

  useEffect(() => {
    setMounted(true)
    loadCard()
  }, [loadCard])

  return (
    <>
      <style>{`
        @keyframes htTwinkle  { from { opacity: 0.1; } to { opacity: 0.95; } }
        @keyframes htFloat    { 0% { transform: translateY(0) scale(1); opacity: .45; } 100% { transform: translateY(-115vh) scale(.35); opacity: 0; } }
        @keyframes htGlowPulse {
          from { filter: drop-shadow(0 0 22px rgba(168,85,247,.55)) drop-shadow(0 0 50px rgba(120,60,255,.3)); }
          to   { filter: drop-shadow(0 0 44px rgba(200,140,255,.9)) drop-shadow(0 0 88px rgba(168,85,247,.6)); }
        }
        @keyframes htShimmer  { 0%,35%{ background-position:-200% 0; } 65%,100%{ background-position:200% 0; } }
        @keyframes htBtnPulse {
          0%,100% { box-shadow: 0 0 28px rgba(168,85,247,.55), 0 4px 20px rgba(80,0,200,.3), inset 0 1px 0 rgba(255,255,255,.18); }
          50%      { box-shadow: 0 0 52px rgba(192,132,252,.82), 0 4px 32px rgba(120,60,255,.5), inset 0 1px 0 rgba(255,255,255,.18); }
        }
        @keyframes htSkeletonShimmer { 0%,100%{ background-position:-200% 0; } 50%{ background-position:200% 0; } }
        @keyframes htFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; } }

        .ht-hero {
          min-height: 100svh; width: 100%;
          background:
            radial-gradient(ellipse 85% 65% at 50% 4%, rgba(80,20,160,.4) 0%, transparent 62%),
            radial-gradient(ellipse 60% 40% at 82% 88%, rgba(30,10,80,.28) 0%, transparent 55%),
            #04040e;
          position: relative; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          padding: 80px 24px 52px;
        }
        .ht-grid {
          position: relative; z-index: 10;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 68px; align-items: center;
          max-width: 1100px; width: 100%;
        }
        @media (max-width: 767px) {
          .ht-hero  { padding: 64px 20px 52px; align-items: flex-start; }
          .ht-grid  { grid-template-columns: 1fr; gap: 40px; justify-items: center; }
          .ht-left  { order: 2; text-align: center; }
          .ht-right { order: 1; }
          .ht-chips, .ht-btns { justify-content: center !important; }
          .ht-sub   { margin-left: auto !important; margin-right: auto !important; }
          .ht-card-wrap { transform: scale(0.82); transform-origin: top center; }
        }
        @media (min-width: 768px) and (max-width: 1023px) { .ht-grid { gap: 40px; } }

        .ht-eyebrow { font-family:system-ui,sans-serif; font-size:11px; font-weight:600; letter-spacing:.36em; color:rgba(168,85,247,.78); text-transform:uppercase; margin:0 0 16px; text-shadow:0 0 18px rgba(168,85,247,.6); }
        .ht-title-wrap { position:relative; display:inline-block; }
        .ht-glow-bg { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:118%; height:220%; background:radial-gradient(ellipse at center,rgba(110,40,255,.22) 0%,rgba(60,0,180,.08) 50%,transparent 70%); pointer-events:none; filter:blur(18px); }
        h1.ht-title { font-family:system-ui,sans-serif; font-size:clamp(46px,8vw,92px); font-weight:800; letter-spacing:-.025em; line-height:1; margin:0; position:relative; background:linear-gradient(130deg,#fff 0%,#ede0ff 22%,#c084fc 48%,#a855f7 64%,#7c3aed 80%,#c084fc 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; animation:htGlowPulse 3s ease-in-out infinite alternate; }
        .ht-shimmer { position:absolute; inset:0; pointer-events:none; background:linear-gradient(105deg,transparent 38%,rgba(255,255,255,.2) 50%,transparent 62%); background-size:200% 100%; animation:htShimmer 4.5s ease-in-out 1s infinite; -webkit-background-clip:text; background-clip:text; }
        .ht-sub { font-family:system-ui,sans-serif; font-size:clamp(14px,1.8vw,17px); font-weight:400; color:rgba(200,178,255,.62); margin:18px 0 0; line-height:1.6; max-width:420px; text-shadow:0 0 28px rgba(160,100,255,.25); }
        .ht-btns { display:flex; gap:12px; margin-top:32px; flex-wrap:wrap; }
        .ht-btn-primary { display:inline-flex; align-items:center; gap:7px; background:linear-gradient(135deg,#6d28d9,#a855f7); color:#fff; text-decoration:none; padding:14px 28px; border-radius:50px; font-family:system-ui,sans-serif; font-size:14px; font-weight:600; letter-spacing:.03em; animation:htBtnPulse 2.8s ease-in-out infinite; border:none; cursor:pointer; transition:transform .18s; min-height:48px; }
        .ht-btn-primary:hover { transform:translateY(-2px) scale(1.03); }
        .ht-btn-ghost { display:inline-flex; align-items:center; background:rgba(255,255,255,.04); color:rgba(210,190,255,.82); text-decoration:none; padding:13px 28px; border-radius:50px; font-family:system-ui,sans-serif; font-size:14px; font-weight:500; border:.5px solid rgba(168,85,247,.32); box-shadow:0 0 16px rgba(100,40,220,.12),inset 0 1px 0 rgba(255,255,255,.05); cursor:pointer; transition:transform .18s,border-color .18s,background .18s; min-height:48px; }
        .ht-btn-ghost:hover { transform:translateY(-2px); border-color:rgba(168,85,247,.65); background:rgba(168,85,247,.1); }
        .ht-chips { display:flex; gap:8px; margin-top:30px; flex-wrap:wrap; }
        .ht-chip { display:flex; align-items:center; gap:5px; background:rgba(100,40,200,.09); border:.5px solid rgba(168,85,247,.2); border-radius:20px; padding:6px 12px; }
        .ht-chip-icon { color:#a855f7; font-size:10px; }
        .ht-chip-label { color:rgba(195,170,255,.62); font-size:11px; font-family:system-ui,sans-serif; letter-spacing:.05em; font-weight:500; }
        .ht-card-hint { text-align:center; color:rgba(130,90,190,.38); font-size:10px; font-family:system-ui,sans-serif; letter-spacing:.08em; margin-top:10px; }
        .ht-refresh-btn { display:flex; align-items:center; gap:5px; background:none; border:.5px solid rgba(168,85,247,.22); border-radius:20px; color:rgba(168,85,247,.55); font-size:10px; font-family:system-ui,sans-serif; padding:4px 10px; cursor:pointer; margin:8px auto 0; transition:border-color .18s,color .18s; }
        .ht-refresh-btn:hover { border-color:rgba(168,85,247,.5); color:rgba(168,85,247,.9); }
      `}</style>

      <section className="ht-hero">
        {/* Stars */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          {starsRef.current.map((s, i) => (
            <div key={i} style={{ position: "absolute", width: s.sz, height: s.sz, background: `rgba(255,255,255,${s.op})`, borderRadius: "50%", top: s.top, left: s.left, animation: `htTwinkle ${s.dur} ease-in-out ${s.del} infinite alternate` }} />
          ))}
        </div>

        {/* Nebula blobs */}
        <div style={{ position: "absolute", top: "10%", left: "6%", width: 440, height: 360, background: "radial-gradient(circle,rgba(110,30,220,.14) 0%,transparent 70%)", borderRadius: "50%", filter: "blur(44px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "16%", right: "5%", width: 520, height: 380, background: "radial-gradient(circle,rgba(50,15,170,.12) 0%,transparent 70%)", borderRadius: "50%", filter: "blur(54px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "44%", right: "20%", width: 260, height: 260, background: "radial-gradient(circle,rgba(192,70,255,.08) 0%,transparent 70%)", borderRadius: "50%", filter: "blur(32px)", pointerEvents: "none" }} />

        {mounted && <FloatingParticles />}

        <div className="ht-grid">
          {/* Left: text */}
          <div className="ht-left" style={{ animation: "htFadeIn .8s ease both" }}>
            <p className="ht-eyebrow">Pokémon TCG</p>
            <div className="ht-title-wrap">
              <div className="ht-glow-bg" />
              <h1 className="ht-title">HOLOTrakr</h1>
              <div className="ht-shimmer" />
            </div>
            <p className="ht-sub">
              Track every pull. Know every value.<br />
              <span style={{ color: "rgba(160,120,255,.45)", fontSize: "0.9em" }}>Your Pokémon TCG collection, mastered.</span>
            </p>
            <div className="ht-btns">
              <a href="/login?mode=signup" className="ht-btn-primary">✦ Start Tracking</a>
              <a href="/login" className="ht-btn-ghost">Sign In</a>
            </div>
            <div className="ht-chips">
              {[["✦","Card Search"],["◈","Portfolio Tracker"],["◇","Sales Log"],["⟡","Wishlists"]].map(([icon, label]) => (
                <div key={label} className="ht-chip">
                  <span className="ht-chip-icon">{icon}</span>
                  <span className="ht-chip-label">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: card */}
          <div className="ht-right" style={{ animation: "htFadeIn 1s ease .15s both" }}>
            <div className="ht-card-wrap">
              <HoloCard card={card} loading={cardLoading} />
            </div>
            <p className="ht-card-hint">drag to reveal foil</p>
            <button className="ht-refresh-btn" onClick={loadCard} disabled={cardLoading}>
              <span style={{ display: "inline-block", animation: cardLoading ? "htTwinkle .6s ease-in-out infinite alternate" : "none" }}>↻</span>
              {cardLoading ? "Loading…" : "New card"}
            </button>
          </div>
        </div>
      </section>
    </>
  )
}