'use client'

import { useState } from 'react'

const SPACING_SCALE = [
  { token: '0.5', px: '2px', rem: '0.125rem' },
  { token: '1', px: '4px', rem: '0.25rem' },
  { token: '2', px: '8px', rem: '0.5rem' },
  { token: '3', px: '12px', rem: '0.75rem' },
  { token: '4', px: '16px', rem: '1rem' },
  { token: '6', px: '24px', rem: '1.5rem' },
  { token: '8', px: '32px', rem: '2rem' },
  { token: '12', px: '48px', rem: '3rem' },
  { token: '16', px: '64px', rem: '4rem' },
  { token: '24', px: '96px', rem: '6rem' },
]

const RADII = [
  { name: 'None', cls: 'rounded-none', value: '0' },
  { name: 'sm', cls: 'rounded-sm', value: '6px' },
  { name: 'md', cls: 'rounded-md', value: '8px' },
  { name: 'lg', cls: 'rounded-lg', value: '10px' },
  { name: 'xl', cls: 'rounded-xl', value: '14px' },
  { name: 'full', cls: 'rounded-full', value: '9999px' },
]

const MOTION_EXAMPLES = [
  { name: 'Pulse', cls: 'animate-pulse', desc: 'Loading & skeleton states' },
  { name: 'Ping', cls: 'animate-ping', desc: 'Live indicators & alerts' },
  { name: 'Bounce', cls: 'animate-bounce', desc: 'Attention & scroll hints' },
  { name: 'Spin', cls: 'animate-spin', desc: 'Processing & loading' },
]

export default function DSSpacingMotion() {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)

  return (
    <section id="spacing" className="scroll-mt-8">
      <div className="mb-10">
        <h2 className="font-display text-3xl font-bold tracking-tight mb-2">Spacing &amp; Motion</h2>
        <p className="text-sm text-muted-foreground">
          4px base grid, Tailwind CSS 4 utilities.
        </p>
      </div>

      <div className="space-y-12">
        {/* Spacing Scale */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Spacing Scale</h3>
          <div className="rounded-xl border border-border overflow-hidden">
            {SPACING_SCALE.map((s, i) => (
              <div
                key={s.token}
                className={`flex items-center gap-4 px-5 py-2.5 border-b border-border last:border-0 transition-colors duration-150 ${
                  hoveredRow === s.token ? 'bg-primary/5' : i % 2 === 0 ? '' : 'bg-muted/30'
                }`}
                onMouseEnter={() => setHoveredRow(s.token)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                <span className="w-8 text-xs font-mono text-muted-foreground/60 shrink-0 text-right">{s.token}</span>
                <div
                  className="h-3.5 rounded shrink-0 transition-all duration-200"
                  style={{
                    width: `calc(${s.rem} * 2 + 2px)`,
                    minWidth: '2px',
                    backgroundColor: hoveredRow === s.token
                      ? 'var(--primary)'
                      : 'color-mix(in oklch, var(--primary) 30%, transparent)',
                  }}
                />
                <span className="text-xs font-mono text-foreground w-12 shrink-0">{s.px}</span>
                <span className="text-xs font-mono text-muted-foreground/50">{s.rem}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Border Radius */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Border Radius</h3>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {RADII.map((r) => (
              <div
                key={r.name}
                className="rounded-xl border border-border bg-card p-4 text-center"
              >
                <div
                  className={`size-12 mx-auto mb-3 ${r.cls} bg-primary/10 border border-primary/20`}
                />
                <p className="text-xs font-medium text-foreground">{r.name}</p>
                <p className="text-[11px] font-mono text-muted-foreground/50 mt-0.5">{r.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CSS Animations */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Animations</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {MOTION_EXAMPLES.map((m) => (
              <div
                key={m.name}
                className="rounded-xl border border-border bg-card p-5 text-center"
              >
                <div className="flex justify-center mb-4 h-10 items-center">
                  <div className={`size-5 rounded-full bg-primary ${m.cls}`} />
                </div>
                <p className="text-xs font-mono text-primary mb-1">.{m.cls}</p>
                <p className="text-[11px] text-muted-foreground">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Duration & Easing */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Transition Timing</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <span className="text-[11px] font-medium text-muted-foreground">Duration Scale</span>
              </div>
              <div className="p-4 space-y-2">
                {[
                  { name: '75ms', cls: 'duration-75' },
                  { name: '150ms', cls: 'duration-150' },
                  { name: '200ms', cls: 'duration-200' },
                  { name: '300ms', cls: 'duration-300' },
                  { name: '500ms', cls: 'duration-500' },
                ].map((d) => (
                  <div key={d.name} className="group flex items-center gap-4 cursor-pointer">
                    <span className="w-14 text-xs font-mono text-muted-foreground/60 shrink-0">{d.name}</span>
                    <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden relative">
                      <div
                        className="h-full rounded-full absolute left-0 top-0 w-0 group-hover:w-full transition-all bg-primary"
                        style={{ transitionDuration: d.name }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <span className="text-[11px] font-medium text-muted-foreground">Easing Functions</span>
              </div>
              <div className="p-4 space-y-4">
                {[
                  { name: 'ease-linear', desc: 'Constant speed' },
                  { name: 'ease-in', desc: 'Slow start' },
                  { name: 'ease-out', desc: 'Slow end' },
                  { name: 'ease-in-out', desc: 'Smooth both ends' },
                ].map((e) => (
                  <div key={e.name} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-mono text-primary">.{e.name}</span>
                      <span className="text-[11px] text-muted-foreground/60">{e.desc}</span>
                    </div>
                    <div className="h-1.5 bg-border rounded-full overflow-hidden relative cursor-pointer">
                      <div
                        className={`h-full w-0 group-hover:w-full transition-all duration-700 ${e.name} rounded-full bg-primary`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
