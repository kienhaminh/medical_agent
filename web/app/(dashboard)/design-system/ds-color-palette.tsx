'use client'

import { useState } from 'react'

interface ColorSwatch {
  label: string
  cssVar: string
  description: string
}

const SEMANTIC_COLORS: ColorSwatch[] = [
  { label: 'Background', cssVar: '--background', description: 'Page canvas' },
  { label: 'Foreground', cssVar: '--foreground', description: 'Primary text' },
  { label: 'Card', cssVar: '--card', description: 'Surface elevation' },
  { label: 'Primary', cssVar: '--primary', description: 'Brand & actions' },
  { label: 'Secondary', cssVar: '--secondary', description: 'Subtle fill' },
  { label: 'Muted', cssVar: '--muted', description: 'Quiet surfaces' },
  { label: 'Accent', cssVar: '--accent', description: 'Emphasis fill' },
  { label: 'Destructive', cssVar: '--destructive', description: 'Danger / error' },
  { label: 'Border', cssVar: '--border', description: 'Structural lines' },
  { label: 'Input', cssVar: '--input', description: 'Form borders' },
  { label: 'Ring', cssVar: '--ring', description: 'Focus outline' },
  { label: 'Muted FG', cssVar: '--muted-foreground', description: 'Secondary text' },
]

const CHART_COLORS: ColorSwatch[] = [
  { label: 'Chart 1', cssVar: '--chart-1', description: 'Sage' },
  { label: 'Chart 2', cssVar: '--chart-2', description: 'Amber' },
  { label: 'Chart 3', cssVar: '--chart-3', description: 'Indigo' },
  { label: 'Chart 4', cssVar: '--chart-4', description: 'Terracotta' },
  { label: 'Chart 5', cssVar: '--chart-5', description: 'Dusty Rose' },
]

function SwatchCard({ swatch }: { swatch: ColorSwatch }) {
  const [copied, setCopied] = useState(false)

  const copyValue = () => {
    navigator.clipboard.writeText(`var(${swatch.cssVar})`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      onClick={copyValue}
      className="group text-left rounded-lg overflow-hidden border border-border hover:border-foreground/15 transition-all duration-200"
      title={`Copy var(${swatch.cssVar})`}
    >
      <div
        className="h-20 relative"
        style={{ backgroundColor: `var(${swatch.cssVar})` }}
      >
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/15 flex items-center justify-center">
          <span className="text-[10px] font-mono text-white tracking-wider font-medium">
            {copied ? 'COPIED' : 'COPY'}
          </span>
        </div>
      </div>
      <div className="p-3 bg-card">
        <p className="text-xs font-medium text-foreground">{swatch.label}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{swatch.description}</p>
      </div>
    </button>
  )
}

function SectionLabel({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}

export default function DSColorPalette() {
  return (
    <section id="colors" className="scroll-mt-8">
      <div className="mb-10">
        <h2 className="font-display text-3xl font-bold tracking-tight mb-2">Color Palette</h2>
        <p className="text-sm text-muted-foreground">
          OKLCh color space with warm undertones. Click any swatch to copy.
        </p>
      </div>

      <div className="space-y-10">
        <div>
          <SectionLabel title="Semantic Tokens" />
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {SEMANTIC_COLORS.map((s) => (
              <SwatchCard key={s.label} swatch={s} />
            ))}
          </div>
        </div>

        <div>
          <SectionLabel title="Chart Series" />
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {CHART_COLORS.map((s) => (
              <SwatchCard key={s.label} swatch={s} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
