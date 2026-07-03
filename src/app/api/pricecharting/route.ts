// ============================================================
// PriceCharting proxy — card price lookup by name
// src/app/api/pricecharting/route.ts
//
// PriceCharting has an unofficial-but-public product search API.
// No API key required. Prices are returned in cents.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'

export interface PriceChartingResult {
  id: number
  name: string
  loosePrice: number | null   // ungraded / raw
  gradedPrice: number | null  // PSA/BGS graded
  url: string
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json([])

  try {
    const url =
      `https://www.pricecharting.com/api/products?q=${encodeURIComponent(q)}&id=pokemon`

    const res = await fetch(url, {
      headers: { 'User-Agent': 'HOLOTrakr/1.0' },
      next: { revalidate: 600 },  // 10-min cache
    })

    if (!res.ok) return NextResponse.json([])

    const data = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const products: PriceChartingResult[] = (data.products ?? []).slice(0, 8).map((p: any) => ({
      id:          p['id'],
      name:        p['product-name'] ?? '',
      loosePrice:  typeof p['loose-price']  === 'number' ? p['loose-price']  / 100 : null,
      gradedPrice: typeof p['graded-price'] === 'number' ? p['graded-price'] / 100 : null,
      url:         `https://www.pricecharting.com/game/pokemon/${p['id']}`,
    }))

    return NextResponse.json(products, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200' },
    })
  } catch (err) {
    console.error('[PriceCharting]', err)
    return NextResponse.json([])
  }
}
