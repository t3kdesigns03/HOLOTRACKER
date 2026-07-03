'use client'
// ============================================================
// CaseQR — renders a case QR code + download / print actions
// src/components/cases/CaseQR.tsx
// ============================================================

import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Download, Printer } from 'lucide-react'
import { getCaseUrl } from '@/lib/holocase'
import { toast } from 'sonner'

interface Props {
  shortCode: string
  /** Card name printed on the label (optional) */
  cardName?: string | null
  /** Rendered size in px of the on-screen preview */
  size?: number
}

const QR_OPTS = {
  errorCorrectionLevel: 'M' as const, // survives partial label wear
  margin: 1,
}

export function CaseQR({ shortCode, cardName, size = 160 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [busy, setBusy] = useState(false)
  const url = getCaseUrl(shortCode)

  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, url, {
      ...QR_OPTS,
      width: size,
      color: { dark: '#18181b', light: '#ffffff' },
    }).catch(() => toast.error('Failed to render QR code'))
  }, [url, size])

  async function downloadPng() {
    try {
      const dataUrl = await QRCode.toDataURL(url, { ...QR_OPTS, width: 600 })
      triggerDownload(dataUrl, `${shortCode}.png`)
    } catch {
      toast.error('PNG export failed')
    }
  }

  async function downloadSvg() {
    try {
      const svg = await QRCode.toString(url, { ...QR_OPTS, type: 'svg' })
      const blob = new Blob([svg], { type: 'image/svg+xml' })
      triggerDownload(URL.createObjectURL(blob), `${shortCode}.svg`)
    } catch {
      toast.error('SVG export failed')
    }
  }

  async function printLabel() {
    setBusy(true)
    try {
      const dataUrl = await QRCode.toDataURL(url, { ...QR_OPTS, width: 600 })
      const win = window.open('', '_blank', 'width=420,height=560')
      if (!win) {
        toast.error('Pop-up blocked — allow pop-ups to print labels')
        return
      }
      win.document.write(labelHtml(shortCode, dataUrl, cardName))
      win.document.close()
      win.focus()
      // Give the image a beat to load before the print dialog
      setTimeout(() => win.print(), 300)
    } catch {
      toast.error('Label print failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-lg bg-white p-2">
        <canvas ref={canvasRef} width={size} height={size} />
      </div>
      <span className="font-mono text-sm text-zinc-300 tracking-wider">{shortCode}</span>
      <div className="flex items-center gap-2">
        <QrButton onClick={downloadPng} title="Download PNG">
          <Download className="w-3.5 h-3.5" /> PNG
        </QrButton>
        <QrButton onClick={downloadSvg} title="Download SVG">
          <Download className="w-3.5 h-3.5" /> SVG
        </QrButton>
        <QrButton onClick={printLabel} disabled={busy} title="Print label">
          <Printer className="w-3.5 h-3.5" /> Label
        </QrButton>
      </div>
    </div>
  )
}

function QrButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { children, ...rest } = props
  return (
    <button
      {...rest}
      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
    >
      {children}
    </button>
  )
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/**
 * Printable label sized for the front of a HoloCase.
 * 1.5in QR + code underneath; card name if assigned.
 */
function labelHtml(shortCode: string, qrDataUrl: string, cardName?: string | null) {
  return `<!DOCTYPE html>
<html>
<head>
<title>HoloCase label ${shortCode}</title>
<style>
  @page { margin: 0.25in; }
  body {
    font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
    display: flex; justify-content: center; padding: 0.25in;
  }
  .label {
    width: 2in; text-align: center;
    border: 1px dashed #bbb; border-radius: 6px; padding: 0.15in;
  }
  .label img { width: 1.5in; height: 1.5in; }
  .code { font-family: ui-monospace, monospace; font-size: 11pt; letter-spacing: 1px; margin-top: 2pt; }
  .name { font-size: 8pt; color: #333; margin-top: 2pt; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .brand { font-size: 6.5pt; color: #999; margin-top: 3pt; }
  @media print { .label { border: none; } }
</style>
</head>
<body>
  <div class="label">
    <img src="${qrDataUrl}" alt="QR" />
    <div class="code">${shortCode}</div>
    ${cardName ? `<div class="name">${escapeHtml(cardName)}</div>` : ''}
    <div class="brand">HoloCase &middot; HoloTracker</div>
  </div>
</body>
</html>`
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
