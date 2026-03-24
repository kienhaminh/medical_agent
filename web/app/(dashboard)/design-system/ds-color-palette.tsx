'use client'

import { useState } from 'react'

interface ColorSwatch {
  label: string
  cssVar?: string
  hex?: string
  oklch?: string
  description: string
}

const SEMANTIC_COLORS: ColorSwatch[] = [
  { label: 'Background', cssVar: '--background', oklch: '0.09 0 0', description: 'Page canvas' },
  { label: 'Foreground', cssVar: '--foreground', oklch: '0.95 0 0', description: 'Primary text' },
  { label: 'Card', cssVar: '--card', oklch: '0.11 0 0', description: 'Surface elevation 1' },
  { label: 'Primary', cssVar: '--primary', oklch: '0.88 0 0', description: 'Brand interactions' },
  { label: 'Secondary', cssVar: '--secondary', oklch: '0.16 0 0', description: 'Subtle fill' },
  { label: 'Muted', cssVar: '--muted', oklch: '0.16 0 0', description: 'Quiet surfaces' },
  { label: 'Accent', cssVar: '--accent', oklch: '0.16 0 0', description: 'Emphasis fill' },
  { label: 'Destructive', cssVar: '--destructive', oklch: '0.704 0.191 22.216', description: 'Danger / error' },
  { label: 'Border', cssVar: '--border', oklch: '0.2 0 0', description: 'Structural lines' },
  { label: 'Input', cssVar: '--input', oklch: '0.2 0 0', description: 'Form borders' },
  { label: 'Ring', cssVar: '--ring', oklch: '0.75 0 0', description: 'Focus outline' },
  { label: 'Muted FG', cssVar: '--muted-foreground', oklch: '0.65 0 0', description: 'Secondary text' },
]

const MEDICAL_COLORS: ColorSwatch[] = [
  { label: 'Cyan Electric', cssVar: '--cyan-electric', hex: '#00d9ff', description: 'Primary accent · interactive' },
  { label: 'Teal Medical', cssVar: '--teal-medical', hex: '#00b8a9', description: 'Secondary accent · health' },
  { label: 'Purple Medical', cssVar: '--purple-medical', hex: '#6366f1', description: 'AI · intelligence · neural' },
  { label: 'Green Medical', cssVar: '--green-medical', hex: '#10b981', description: 'Vitals · success · active' },
  { label: 'Navy Deep', cssVar: '--navy-deep', hex: '#0a0e27', description: 'Deep background · navy' },
]

const CHART_COLORS: ColorSwatch[] = [
  { label: 'Chart 1', cssVar: '--chart-1', oklch: '0.488 0.243 264.376', description: 'Series A · indigo' },
  { label: 'Chart 2', cssVar: '--chart-2', oklch: '0.696 0.17 162.48', description: 'Series B · teal' },
  { label: 'Chart 3', cssVar: '--chart-3', oklch: '0.769 0.188 70.08', description: 'Series C · amber' },
  { label: 'Chart 4', cssVar: '--chart-4', oklch: '0.627 0.265 303.9', description: 'Series D · violet' },
  { label: 'Chart 5', cssVar: '--chart-5', oklch: '0.645 0.246 16.439', description: 'Series E · rose' },
]

function SwatchCard({ swatch, size = 'md' }: { swatch: ColorSwatch; size?: 'sm' | 'md' }) {
  const [copied, setCopied] = useState(false)

  const copyValue = () => {
    const val = swatch.hex || (swatch.oklch ? `oklch(${swatch.oklch})` : swatch.cssVar || '')
    navigator.clipboard.writeText(val)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const bgStyle = swatch.hex
    ? { backgroundColor: swatch.hex }
    : swatch.cssVar
      ? { backgroundColor: `var(${swatch.cssVar})` }
      : {}

  const heightClass = size === 'sm' ? 'h-16' : 'h-24'

  return (
    <button
      onClick={copyValue}
      className="group text-left rounded-sm border border-border/50 overflow-hidden transition-all duration-200 hover:border-[#00d9ff]/40 hover:shadow-[0_0_16px_rgba(0,217,255,0.1)]"
      title={`Copy ${swatch.hex || (swatch.oklch ? `oklch(${swatch.oklch})` : swatch.cssVar)}`}
    >
      <div className={`${heightClass} relative`} style={bgStyle}>
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/20 flex items-center justify-center">
          <span className="text-[10px] font-mono text-white/90 tracking-widest">
            {copied ? 'COPIED' : 'COPY'}
          </span>
        </div>
      </div>
      <div className="p-2.5 bg-card">
        <p className="text-xs font-mono font-medium text-foreground truncate">{swatch.label}</p>
        <p className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">
          {swatch.hex || (swatch.oklch ? `oklch(${swatch.oklch.split(' ')[0]}…)` : swatch.cssVar)}
        </p>
        <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5">{swatch.description}</p>
      </div>
    </button>
  )
}

function SectionLabel({ code, title }: { code: string; title: string }) {
  return (
    <div className="flex items-baseline gap-4 mb-6">
      <span className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground/50">{code}</span>
      <h3 className="text-sm font-mono font-semibold text-muted-foreground uppercase tracking-widest">{title}</h3>
      <div className="h-px flex-1 bg-border/50" />
    </div>
  )
}

export default function DSColorPalette() {
  return (
    <section id="colors" className="scroll-mt-8">
      <div className="flex items-end gap-4 mb-10">
        <div>
          <p className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground/50 mb-1">SYS.DESIGN.COLORS.01</p>
          <h2 className="font-display text-3xl font-bold">Color Palette</h2>
        </div>
        <div className="h-px flex-1 bg-border mb-2" />
        <span className="text-[10px] font-mono text-muted-foreground mb-2">
          OKLch · Dark mode · Click to copy
        </span>
      </div>

      <div className="space-y-10">
        <div>
          <SectionLabel code="01.A" title="Semantic Tokens" />
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {SEMANTIC_COLORS.map((s) => (
              <SwatchCard key={s.label} swatch={s} size="sm" />
            ))}
          </div>
        </div>

        <div>
          <SectionLabel code="01.B" title="Clinical Futurism — Medical Accents" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {MEDICAL_COLORS.map((s) => (
              <SwatchCard key={s.label} swatch={s} />
            ))}
          </div>
        </div>

        <div>
          <SectionLabel code="01.C" title="Chart Series" />
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {CHART_COLORS.map((s) => (
              <SwatchCard key={s.label} swatch={s} size="sm" />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
