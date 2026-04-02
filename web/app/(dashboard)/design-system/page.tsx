'use client'

import DSColorPalette from './ds-color-palette'
import DSTypography from './ds-typography'
import DSComponents from './ds-components'
import DSMedicalUtils from './ds-medical-utils'
import DSSpacingMotion from './ds-spacing-motion'

export default function DesignSystemPage() {
  const sections = [
    { id: 'colors', label: 'Colors' },
    { id: 'typography', label: 'Typography' },
    { id: 'components', label: 'Components' },
    { id: 'medical', label: 'Medical' },
    { id: 'spacing', label: 'Spacing' },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <div className="px-8 py-12 md:px-16 md:py-20 max-w-6xl">
          <p className="text-xs font-mono tracking-widest uppercase text-muted-foreground mb-6">
            Design System
          </p>

          <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight leading-[0.95] mb-6">
            Graphite
            <br />
            <span className="text-primary">&amp; Sage</span>
          </h1>

          <p className="text-muted-foreground text-base max-w-lg leading-relaxed mb-10">
            A design system built on restraint, warmth, and clinical precision.
            Every token, component, and pattern is crafted for trust.
          </p>

          <nav className="flex flex-wrap gap-1">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="px-3.5 py-1.5 text-xs font-medium rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20 hover:bg-accent transition-all duration-200"
              >
                {s.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="px-8 md:px-16 py-16 max-w-6xl space-y-24">
        <DSColorPalette />
        <DSTypography />
        <DSComponents />
        <DSMedicalUtils />
        <DSSpacingMotion />
      </main>

      <footer className="border-t border-border px-8 md:px-16 py-6 flex items-center justify-between max-w-6xl">
        <span className="text-xs text-muted-foreground">
          MediNexus Design System
        </span>
        <span className="text-xs font-mono text-muted-foreground">
          v2.0
        </span>
      </footer>
    </div>
  )
}
