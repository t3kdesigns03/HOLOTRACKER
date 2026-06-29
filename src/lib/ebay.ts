// ============================================================
// eBay API client — Finding API (sold) + Browse API (active)
// src/lib/ebay.ts
//
// Environment variables required (add to .env.local):
//   EBAY_CLIENT_ID     = your App ID / Client ID from developer.ebay.com
//   EBAY_CLIENT_SECRET = your Cert ID / Client Secret
// ============================================================

const CLIENT_ID     = process.env.EBAY_CLIENT_ID     ?? ''
const CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET ?? ''

// Pokémon TCG Singles category on eBay (183454 = Trading Card Singles)
const POKEMON_CATEGORY = '183454'

// ── Types ─────────────────────────────────────────────────────

export interface EbayListing {
  itemId: string
  title: string
  price: number
  currency: string
  condition: string
  imageUrl: string
  itemUrl: string
  sellerLocation: string
  endTime: string
  source: 'ebay'
}

export interface EbaySoldListing {
  itemId: string
  title: string
  soldPrice: number
  currency: string
  soldDate: string
  condition: string
  imageUrl: string
  itemUrl: string
  sellerLocation: string
  source: 'ebay'
}

// ── OAuth2 token cache (Browse API) ───────────────────────────

let _tokenCache: { token: string; expires: number } | null = null

async function getBrowseToken(): Promise<string> {
  if (_tokenCache && Date.now() < _tokenCache.expires) return _tokenCache.token
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('eBay credentials not configured')

  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
  const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
  })

  if (!res.ok) throw new Error(`eBay OAuth error ${res.status}`)
  const data = await res.json()

  _tokenCache = {
    token: data.access_token,
    expires: Date.now() + data.expires_in * 1000 - 60_000,
  }
  return _tokenCache.token
}

// ── Active listings — Browse API ──────────────────────────────

export async function searchEbayListings(
  query: string,
  limit = 10
): Promise<EbayListing[]> {
  if (!CLIENT_ID || !CLIENT_SECRET) return []

  try {
    const token = await getBrowseToken()
    const sp = new URLSearchParams({
      q: `${query} pokemon card`,
      category_ids: POKEMON_CATEGORY,
      sort: 'price',
      limit: String(limit),
    })

    const res = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?${sp}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        },
        next: { revalidate: 300 },
      }
    )

    if (!res.ok) return []
    const data = await res.json()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.itemSummaries ?? []).map((item: any): EbayListing => ({
      itemId:         item.itemId ?? '',
      title:          item.title ?? '',
      price:          parseFloat(item.price?.value ?? '0'),
      currency:       item.price?.currency ?? 'USD',
      condition:      item.condition ?? 'Unknown',
      imageUrl:       item.image?.imageUrl ?? '',
      itemUrl:        item.itemWebUrl ?? '',
      sellerLocation: [item.itemLocation?.stateOrProvince, item.itemLocation?.country]
        .filter(Boolean).join(', '),
      endTime:        item.itemEndDate ?? '',
      source:         'ebay',
    }))
  } catch (e) {
    console.error('[eBay Browse]', e)
    return []
  }
}

// ── Sold / completed listings — Finding API ───────────────────
// The Finding API uses the App ID (= CLIENT_ID) as a simple query param —
// no OAuth needed.

export async function searchEbaySold(
  query: string,
  limit = 10
): Promise<EbaySoldListing[]> {
  if (!CLIENT_ID) return []

  try {
    const sp = new URLSearchParams({
      'OPERATION-NAME':                   'findCompletedItems',
      'SERVICE-VERSION':                  '1.0.0',
      'SECURITY-APPNAME':                 CLIENT_ID,
      'RESPONSE-DATA-FORMAT':             'JSON',
      keywords:                           `${query} pokemon card`,
      categoryId:                         POKEMON_CATEGORY,
      'itemFilter(0).name':               'SoldItemsOnly',
      'itemFilter(0).value':              'true',
      sortOrder:                          'EndTimeSoonest',
      'paginationInput.entriesPerPage':   String(limit),
    })

    const res = await fetch(
      `https://svcs.ebay.com/services/search/FindingService/v1?${sp}`,
      { next: { revalidate: 300 } }
    )

    if (!res.ok) return []
    const data = await res.json()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] =
      data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item ?? []

    return items.map((item): EbaySoldListing => ({
      itemId:    item.itemId?.[0] ?? '',
      title:     item.title?.[0] ?? '',
      soldPrice: parseFloat(
        item.sellingStatus?.[0]?.currentPrice?.[0]?.__ ?? '0'
      ),
      currency:       item.sellingStatus?.[0]?.currentPrice?.[0]?.['@currencyId'] ?? 'USD',
      soldDate:       item.listingInfo?.[0]?.endTime?.[0] ?? '',
      condition:      item.condition?.[0]?.conditionDisplayName?.[0] ?? 'Unknown',
      imageUrl:       item.galleryURL?.[0] ?? '',
      itemUrl:        item.viewItemURL?.[0] ?? '',
      sellerLocation: item.location?.[0] ?? '',
      source:         'ebay',
    }))
  } catch (e) {
    console.error('[eBay Finding]', e)
    return []
  }
}

// ── Helpers ───────────────────────────────────────────────────

export function isEbayConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET)
}
