'use client'

import { useState } from 'react'

const SPACING_SCALE = [
  { token: '0', px: '0px', rem: '0rem' },
  { token: '0.5', px: '2px', rem: '0.125rem' },
  { token: '1', px: '4px', rem: '0.25rem' },
  { token: '1.5', px: '6px', rem: '0.375rem' },
  { token: '2', px: '8px', rem: '0.5rem' },
  { token: '3', px: '12px', rem: '0.75rem' },
  { token: '4', px: '16px', rem: '1rem' },
  { token: '5', px: '20px', rem: '1.25rem' },
  { token: '6', px: '24px', rem: '1.5rem' },
  { token: '8', px: '32px', rem: '2rem' },
  { token: '10', px: '40px', rem: '2.5rem' },
  { token: '12', px: '48px', rem: '3rem' },
  { token: '16', px: '64px', rem: '4rem' },
  { token: '20', px: '80px', rem: '5rem' },
  { token: '24', px: '96px', rem: '6rem' },
]

const RADII = [
  { name: 'None', cls: 'rounded-none', value: '0px' },
  { name: 'sm', cls: 'rounded-sm', value: 'calc(var(--radius) - 4px) = 4px' },
  { name: 'md', cls: 'rounded-md', value: 'calc(var(--radius) - 2px) = 6px' },
  { name: 'lg (base)', cls: 'rounded-lg', value: 'var(--radius) = 8px' },
  { name: 'xl', cls: 'rounded-xl', value: 'calc(var(--radius) + 4px) = 12px' },
  { name: 'full', cls: 'rounded-full', value: '9999px' },
]

const MOTION_EXAMPLES = [
  {
    name: 'Pulse',
    cls: 'animate-pulse',
    desc: 'Loading states, skeleton shimmer',
    color: '#00d9ff',
  },
  {
    name: 'Ping',
    cls: 'animate-ping',
    desc: 'Live indicators, alert dots',
    color: '#10b981',
  },
  {
    name: 'Bounce',
    cls: 'animate-bounce',
    desc: 'Attention-drawing, scroll hints',
    color: '#6366f1',
  },
  {
    name: 'Spin',
    cls: 'animate-spin',
    desc: 'Loading spinners, processing',
    color: '#00b8a9',
  },
]

const DURATION_SCALE = [
  { name: '75ms', cls: 'duration-75' },
  { name: '150ms', cls: 'duration-150' },
  { name: '200ms', cls: 'duration-200' },
  { name: '300ms', cls: 'duration-300' },
  { name: '500ms', cls: 'duration-500' },
  { name: '700ms', cls: 'duration-700' },
  { name: '1000ms', cls: 'duration-1000' },
]

const EASING = [
  { name: 'ease-linear', cls: 'ease-linear', desc: 'Constant speed' },
  { name: 'ease-in', cls: 'ease-in', desc: 'Slow start, fast end' },
  { name: 'ease-out', cls: 'ease-out', desc: 'Fast start, slow end (most natural)' },
  { name: 'ease-in-out', cls: 'ease-in-out', desc: 'Smooth both ends (preferred for UI)' },
]

function SubSectionLabel({ code, title }: { code: string; title: string }) {
  return (
    <div className="flex items-baseline gap-4 mb-5">
      <span className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground/50">{code}</span>
      <h3 className="text-sm font-mono font-semibold text-muted-foreground uppercase tracking-widest">{title}</h3>
      <div className="h-px flex-1 bg-border/50" />
    </div>
  )
}

export default function DSSpacingMotion() {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)

  return (
    <section id="spacing" className="scroll-mt-8">
      <div className="flex items-end gap-4 mb-10">
        <div>
          <p className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground/50 mb-1">SYS.DESIGN.SPACE.05</p>
          <h2 className="font-display text-3xl font-bold">Spacing & Motion</h2>
        </div>
        <div className="h-px flex-1 bg-border mb-2" />
        <span className="text-[10px] font-mono text-muted-foreground mb-2">Tailwind v4 · CSS Variables · 4px base</span>
      </div>

      <div className="space-y-10">
        {/* Spacing Scale */}
        <div>
          <SubSectionLabel code="05.A" title="Spacing Scale" />
          <div className="rounded-sm border border-border/50 overflow-hidden">
            {SPACING_SCALE.map((s, i) => (
              <div
                key={s.token}
                className={`flex items-center gap-4 px-5 py-2.5 border-b border-border/20 last:border-0 transition-colors duration-150 cursor-default ${
                  hoveredRow === s.token ? 'bg-[#00d9ff]/5' : i % 2 === 0 ? 'bg-card/50' : ''
                }`}
                onMouseEnter={() => setHoveredRow(s.token)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                <span className="w-10 text-xs font-mono text-muted-foreground/60 shrink-0">{s.token}</span>
                <div
                  className="h-4 rounded-sm shrink-0 transition-all duration-200"
                  style={{
                    width: `calc(${s.rem} * 2 + 2px)`,
                    minWidth: '2px',
                    backgroundColor: hoveredRow === s.token ? '#00d9ff' : 'rgba(0,217,255,0.35)',
                  }}
                />
                <span className="text-xs font-mono text-foreground w-12 shrink-0">{s.px}</span>
                <span className="text-xs font-mono text-muted-foreground/50">{s.rem}</span>
                <span className="text-[10px] font-mono text-muted-foreground/30 ml-auto">
                  {hoveredRow === s.token ? `space-${s.token} · p-${s.token} · m-${s.token} · gap-${s.token}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Border Radius */}
        <div>
          <SubSectionLabel code="05.B" title="Border Radius" />
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {RADII.map((r) => (
              <div
                key={r.name}
                className="rounded-sm border border-border/50 bg-card p-4 text-center hover:border-[#00d9ff]/30 transition-colors duration-150"
              >
                <div
                  className={`h-12 w-12 mx-auto mb-3 ${r.cls}`}
                  style={{ background: 'linear-gradient(135deg, rgba(0,217,255,0.2), rgba(0,184,169,0.2))', border: '1px solid rgba(0,217,255,0.3)' }}
                />
                <p className="text-xs font-mono font-semibold text-foreground">{r.name}</p>
                <p className="text-[10px] font-mono text-muted-foreground/50 mt-1 leading-tight">{r.value.split(' = ')[1] || r.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CSS Animations */}
        <div>
          <SubSectionLabel code="05.C" title="CSS Animations — Tailwind" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {MOTION_EXAMPLES.map((m) => (
              <div
                key={m.name}
                className="rounded-sm border border-border/50 bg-card p-5 text-center hover:border-[#00d9ff]/30 transition-colors duration-200"
              >
                <div className="flex justify-center mb-4 h-10 items-center">
                  <div
                    className={`size-6 rounded-full ${m.cls}`}
                    style={{ backgroundColor: m.color }}
                  />
                </div>
                <code className="text-xs font-mono block mb-1" style={{ color: m.color }}>.{m.cls}</code>
                <p className="text-[11px] text-muted-foreground">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Duration & Easing */}
        <div>
          <SubSectionLabel code="05.D" title="Transition Duration & Easing" />
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-sm border border-border/50 bg-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border/30 bg-muted/20">
                <span className="text-[10px] font-mono text-muted-foreground/60 tracking-widest uppercase">Duration Scale</span>
              </div>
              <div className="p-4 space-y-2">
                {DURATION_SCALE.map((d) => (
                  <div key={d.name} className="group flex items-center gap-4 cursor-pointer">
                    <span className="w-20 text-xs font-mono text-muted-foreground/60 shrink-0">{d.name}</span>
                    <div className="flex-1 h-1.5 bg-border/30 rounded-full overflow-hidden relative">
                      <div
                        className="h-full rounded-full absolute left-0 top-0 w-0 group-hover:w-full transition-all"
                        style={{
                          transitionDuration: d.name,
                          backgroundColor: '#00d9ff',
                        }}
                      />
                    </div>
                    <code className="text-[10px] font-mono text-muted-foreground/40">.{d.cls}</code>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-sm border border-border/50 bg-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border/30 bg-muted/20">
                <span className="text-[10px] font-mono text-muted-foreground/60 tracking-widest uppercase">Easing Functions</span>
              </div>
              <div className="p-4 space-y-4">
                {EASING.map((e) => (
                  <div key={e.name} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                      <code className="text-xs font-mono" style={{ color: '#00d9ff' }}>.{e.name}</code>
                      <span className="text-[10px] text-muted-foreground/60">{e.desc}</span>
                    </div>
                    <div className="h-1.5 bg-border/30 rounded-full overflow-hidden relative cursor-pointer">
                      <div
                        className={`h-full w-0 group-hover:w-full transition-all duration-700 ${e.cls} rounded-full`}
                        style={{ background: 'linear-gradient(90deg, #00d9ff, #00b8a9)' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Framer Motion Note */}
        <div className="rounded-sm border p-5 flex items-start gap-4" style={{ borderColor: 'rgba(99,102,241,0.3)', backgroundColor: 'rgba(99,102,241,0.05)' }}>
          <div
            className="size-2 rounded-full mt-1.5 shrink-0 animate-pulse"
            style={{ backgroundColor: '#6366f1' }}
          />
          <div>
            <p className="text-sm font-mono font-semibold mb-1" style={{ color: '#6366f1' }}>
              Framer Motion v12 Available
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              For complex orchestrated animations — page transitions, staggered reveals, gesture-driven interactions.
              Import from <code className="font-mono text-foreground/80">framer-motion</code>. Use{' '}
              <code className="font-mono text-foreground/80">motion.div</code>,{' '}
              <code className="font-mono text-foreground/80">AnimatePresence</code>, and{' '}
              <code className="font-mono text-foreground/80">useMotionValue</code> for advanced effects.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
