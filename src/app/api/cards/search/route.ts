import { NextRequest, NextResponse } from 'next/server'
import { searchCards } from '@/lib/pokemon-tcg'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q         = searchParams.get('q') ?? undefined
  const set       = searchParams.get('set') ?? undefined
  const supertype = searchParams.get('supertype') ?? undefined
  const rarity    = searchParams.get('rarity') ?? undefined
  const page      = Number(searchParams.get('page') ?? '1')
  const pageSize  = Number(searchParams.get('pageSize') ?? '20')

  if (!q && !set && !supertype && !rarity) {
    return NextResponse.json({ data: [], page: 1, pageSize, count: 0, totalCount: 0 })
  }

  try {
    const result = await searchCards({ q, set, supertype, rarity, page, pageSize })
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
        // Netlify's CDN does NOT vary cached responses by query string unless
        // told to — without this, every search returns the first cached result.
        'Netlify-Vary': 'query',
      }
    })
  } catch (err) {
    console.error('Card search error:', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
