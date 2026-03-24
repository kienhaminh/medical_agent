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
    { id: 'medical', label: 'Medical Utils' },
    { id: 'spacing', label: 'Spacing & Motion' },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Diagnostic Header */}
      <header className="relative border-b border-border overflow-hidden">
        <div className="absolute inset-0 dot-matrix-bg opacity-20 pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00d9ff] to-transparent opacity-60" />

        <div className="relative z-10 px-8 py-10 md:px-12 md:py-14">
          <div className="flex items-center gap-4 mb-5">
            <span className="text-[10px] font-mono tracking-[0.25em] uppercase" style={{ color: '#00d9ff' }}>
              MediNexus · Internal
            </span>
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] font-mono text-muted-foreground tracking-widest">
              SYS.DESIGN.V1.0 ·{' '}
              <span className="opacity-60">{new Date().toISOString().split('T')[0]}</span>
            </span>
          </div>

          <h1 className="font-display text-6xl md:text-8xl font-bold tracking-tight leading-none mb-4">
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(135deg, #00d9ff 0%, #00b8a9 50%, #6366f1 100%)' }}
            >
              Design System
            </span>
          </h1>

          <p className="font-mono text-muted-foreground text-sm max-w-2xl leading-relaxed mb-8">
            Clinical Interface Standards — production-grade components, tokens, and patterns
            <br />
            for the MediNexus medical AI platform.
          </p>

          <nav className="flex flex-wrap gap-2">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="px-4 py-1.5 text-[11px] font-mono tracking-widest uppercase border transition-all duration-200 rounded-sm"
                style={{
                  borderColor: 'rgba(0,217,255,0.25)',
                  color: '#00d9ff',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,217,255,0.08)'
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,217,255,0.6)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,217,255,0.25)'
                }}
              >
                {s.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="px-8 md:px-12 py-16 space-y-28">
        <DSColorPalette />
        <DSTypography />
        <DSComponents />
        <DSMedicalUtils />
        <DSSpacingMotion />
      </main>

      <footer className="border-t border-border px-8 md:px-12 py-6 flex items-center justify-between">
        <span className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">
          MediNexus Design System · Clinical Futurism Theme
        </span>
        <span className="text-[10px] font-mono" style={{ color: '#00d9ff' }}>
          ● Live
        </span>
      </footer>
    </div>
  )
}
