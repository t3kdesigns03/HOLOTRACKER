// ============================================================
// Public HoloCase Page — /c/[short_code]
// Scanned from the QR on a physical HoloCase. No login needed.
// Field visibility is enforced server-side by get_public_case().
// ============================================================

import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  getMarketPrice, getJustTCGPrice, CONDITION_LABELS, PRINT_TYPE_LABELS,
  type PublicCaseData, type PrintType, type CardCondition,
} from '@/types'

export const dynamic = 'force-dynamic'

async function fetchCase(shortCode: string): Promise<PublicCaseData | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_public_case', {
    p_short_code: shortCode,
  })
  if (error || !data) return null
  return data as PublicCaseData
}

export async function generateMetadata(
  { params }: { params: Promise<{ short_code: string }> }
): Promise<Metadata> {
  const { short_code } = await params
  const data = await fetchCase(short_code)
  if (!data?.card) return { title: 'HoloCase — HoloTracker' }
  return {
    title: `${data.card.name} · ${data.card.set_name} — HoloCase`,
    description: `${data.card.name} (${data.card.set_name} ${data.card.number}) in a HoloCase protective case.`,
    openGraph: data.card.image_url ? { images: [data.card.image_url] } : undefined,
  }
}

export default async function PublicCasePage(
  { params }: { params: Promise<{ short_code: string }> }
) {
  const { short_code } = await params
  const data = await fetchCase(short_code)

  if (!data) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="text-5xl">🃏</div>
        <h1 className="text-xl font-bold">Case not found</h1>
        <p className="text-zinc-400 text-sm max-w-xs">
          This HoloCase doesn&apos;t exist or its owner has set it to private.
        </p>
        <Link href="/" className="text-purple-400 text-sm hover:underline">
          What is HoloTracker?
        </Link>
      </main>
    )
  }

  // Prefer JustTCG condition-aware price; fall back to TCGplayer market (NM-ish)
  const jtPrice = data.print_type && data.condition
    ? getJustTCGPrice(data.justtcg_variants, data.print_type as PrintType, data.condition as CardCondition)
    : null
  const marketPrice = jtPrice?.price ?? (
    data.prices && data.print_type
      ? getMarketPrice(data.prices, data.print_type as PrintType)
      : null
  )
  const priceSource = jtPrice
    ? `${data.condition} · JustTCG`
    : 'TCGplayer market'

  return (
    <main className="min-h-dvh max-w-md mx-auto px-4 py-8 flex flex-col gap-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <span className="font-bold text-lg">
          🃏 <span className="text-purple-400">Holo</span>Tracker
        </span>
        <span className="font-mono text-xs text-zinc-500 border border-zinc-800 rounded-md px-2 py-1">
          {data.short_code}
        </span>
      </header>

      {data.is_owner && (
        <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-sm text-purple-200 flex items-center justify-between gap-3">
          <span>This is your case{data.is_public === false ? ' (private)' : ''}.</span>
          <Link href={`/cases?code=${data.short_code}`} className="shrink-0 font-medium text-purple-300 hover:underline">
            Manage →
          </Link>
        </div>
      )}

      {!data.card ? (
        /* Empty case */
        <section className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="w-40 aspect-[5/7] rounded-xl border-2 border-dashed border-zinc-700 flex items-center justify-center text-zinc-600 text-sm">
            Empty
          </div>
          <p className="text-zinc-400 text-sm max-w-xs">
            This HoloCase hasn&apos;t been assigned a card yet.
          </p>
          {data.is_owner && (
            <Link
              href={`/cases?code=${data.short_code}`}
              className="rounded-lg bg-purple-600 hover:bg-purple-500 px-4 py-2 text-sm font-medium transition-colors"
            >
              Assign a card
            </Link>
          )}
        </section>
      ) : (
        <>
          {/* Card image */}
          {data.card.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.card.image_url}
              alt={data.card.name}
              className="w-full max-w-xs mx-auto rounded-xl shadow-2xl shadow-purple-500/10"
              loading="eager"
            />
          )}

          {/* Card details */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 divide-y divide-zinc-800">
            <div className="px-4 py-3">
              <h1 className="text-lg font-bold leading-tight">{data.card.name}</h1>
              <p className="text-sm text-zinc-400 flex items-center gap-1.5">
                {data.card.set_symbol_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.card.set_symbol_url} alt="" className="w-4 h-4 inline-block" />
                )}
                {data.card.set_name} · #{data.card.number}
                {data.card.rarity ? ` · ${data.card.rarity}` : ''}
              </p>
            </div>

            <Row label="Variant" value={PRINT_TYPE_LABELS[data.print_type as PrintType] ?? data.print_type} />
            {data.condition && !data.grading && (
              <Row label="Condition" value={CONDITION_LABELS[data.condition as CardCondition] ?? data.condition} />
            )}

            {data.grading && (
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-zinc-400">Grade</span>
                <span className="text-sm font-semibold text-emerald-300">
                  {data.grading.company} {data.grading.grade}
                  {data.grading.cert_number && (
                    <span className="text-zinc-500 font-normal ml-2">#{data.grading.cert_number}</span>
                  )}
                </span>
              </div>
            )}

            {marketPrice != null && (
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-zinc-400">Est. value</span>
                <span className="text-base font-bold text-purple-300">
                  ${marketPrice.toFixed(2)}
                  <span className="text-xs font-normal text-zinc-500 ml-1.5">{priceSource}</span>
                  {jtPrice?.change24h != null && jtPrice.change24h !== 0 && (
                    <span className={`text-xs font-medium ml-1.5 ${jtPrice.change24h > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {jtPrice.change24h > 0 ? '▲' : '▼'} {Math.abs(jtPrice.change24h).toFixed(2)}
                    </span>
                  )}
                </span>
              </div>
            )}

            {data.tags && data.tags.length > 0 && (
              <div className="px-4 py-3 flex flex-wrap gap-1.5">
                {data.tags.map(tag => (
                  <span key={tag} className="rounded-full bg-zinc-800 text-zinc-300 text-xs px-2.5 py-1">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {data.case_notes && (
              <div className="px-4 py-3">
                <p className="text-sm text-zinc-300 whitespace-pre-wrap">{data.case_notes}</p>
              </div>
            )}
          </section>
        </>
      )}

      <footer className="mt-auto pt-6 text-center text-xs text-zinc-600">
        Protected by a <span className="text-zinc-400">HoloCase</span> · tracked with{' '}
        <Link href="/" className="text-purple-400/80 hover:underline">HoloTracker</Link>
      </footer>
    </main>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between">
      <span className="text-sm text-zinc-400">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}
