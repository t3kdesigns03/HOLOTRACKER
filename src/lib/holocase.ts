// src/lib/holocase.ts
// Helpers for HoloCase QR links.

/**
 * Absolute URL encoded into a case's QR code.
 * Set NEXT_PUBLIC_SITE_URL (e.g. https://holotracker.app) in Netlify —
 * printed QR codes must point at the permanent domain, not a deploy preview.
 * Falls back to the browser origin during local dev.
 */
export function getCaseUrl(shortCode: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') ||
    (typeof window !== 'undefined' ? window.location.origin : '')
  return `${base}/c/${shortCode}`
}
