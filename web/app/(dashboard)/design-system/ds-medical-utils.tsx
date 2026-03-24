'use client'

import { useState } from 'react'

const MEDICAL_BADGES = [
  { label: 'MRI', cls: 'medical-badge-mri', desc: 'Magnetic resonance imaging' },
  { label: 'X-RAY', cls: 'medical-badge-xray', desc: 'Radiographic imaging' },
  { label: 'LAB', cls: 'medical-badge-lab', desc: 'Laboratory results' },
  { label: 'CT', cls: 'medical-badge-ct', desc: 'Computed tomography' },
  { label: 'ULTRASOUND', cls: 'medical-badge-ultrasound', desc: 'Sonographic imaging' },
  { label: 'TEXT', cls: 'medical-badge-text', desc: 'Clinical text records' },
  { label: 'OTHER', cls: 'medical-badge-other', desc: 'Miscellaneous records' },
]

const GLOW_EFFECTS = [
  {
    cls: 'medical-glow-cyan',
    label: 'Cyan Glow',
    cssVar: '.medical-glow-cyan',
    desc: 'Primary interactive glow. Used on focused/active states.',
    color: '#00d9ff',
  },
  {
    cls: 'medical-glow-teal',
    label: 'Teal Glow',
    cssVar: '.medical-glow-teal',
    desc: 'Secondary accent glow. Used on health/success elements.',
    color: '#00b8a9',
  },
  {
    cls: 'medical-border-glow',
    label: 'Border Glow',
    cssVar: '.medical-border-glow',
    desc: 'Inset border with cyan fill — card focus state.',
    color: '#00d9ff',
  },
]

const BUTTONS_DEMO = [
  { cls: 'primary-button', label: '.primary-button', desc: 'Cyan→Teal gradient with shadow. CTA actions.' },
  { cls: 'secondary-button', label: '.secondary-button', desc: 'Outline with hover fill. Secondary actions.' },
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

export default function DSMedicalUtils() {
  const [activeGlow, setActiveGlow] = useState<string | null>(null)

  return (
    <section id="medical" className="scroll-mt-8">
      <div className="flex items-end gap-4 mb-10">
        <div>
          <p className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground/50 mb-1">SYS.DESIGN.MED.04</p>
          <h2 className="font-display text-3xl font-bold">Medical Utilities</h2>
        </div>
        <div className="h-px flex-1 bg-border mb-2" />
        <span className="text-[10px] font-mono text-muted-foreground mb-2">Clinical Futurism · Custom utilities</span>
      </div>

      <div className="space-y-10">
        {/* Medical Badges */}
        <div>
          <SubSectionLabel code="04.A" title="Medical Record Badges" />
          <div className="rounded-sm border border-border/50 bg-card p-6">
            <div className="flex flex-wrap gap-3 mb-5">
              {MEDICAL_BADGES.map((b) => (
                <span key={b.label} className={`${b.cls} text-xs font-mono font-semibold px-2.5 py-1 rounded`}>
                  {b.label}
                </span>
              ))}
            </div>
            <div className="border-t border-border/30 pt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {MEDICAL_BADGES.map((b) => (
                <div key={b.label} className="flex items-start gap-2">
                  <span className={`${b.cls} text-[10px] font-mono font-semibold px-2 py-0.5 rounded shrink-0`}>
                    {b.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground leading-tight">{b.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Glow Effects */}
        <div>
          <SubSectionLabel code="04.B" title="Glow Effects" />
          <div className="grid md:grid-cols-3 gap-4">
            {GLOW_EFFECTS.map((g) => (
              <div
                key={g.cls}
                className={`rounded-sm bg-card border transition-all duration-300 cursor-pointer p-5 ${g.cls} ${activeGlow === g.cls ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`}
                style={{ borderColor: `${g.color}30` }}
                onClick={() => setActiveGlow(activeGlow === g.cls ? null : g.cls)}
              >
                <code className="text-[11px] font-mono block mb-2" style={{ color: g.color }}>
                  {g.cssVar}
                </code>
                <p className="font-display text-base font-semibold text-foreground mb-1">{g.label}</p>
                <p className="text-xs text-muted-foreground">{g.desc}</p>
                <p className="text-[10px] font-mono text-muted-foreground/40 mt-3 tracking-widest">
                  {activeGlow === g.cls ? '← ACTIVE · CLICK TO RESET' : 'CLICK TO ACTIVATE →'}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Background Utilities */}
        <div>
          <SubSectionLabel code="04.C" title="Background Patterns" />
          <div className="grid md:grid-cols-3 gap-4">
            <div className="rounded-sm border border-border/50 overflow-hidden">
              <div className="dot-matrix-bg h-32 flex items-center justify-center">
                <span className="text-xs font-mono text-muted-foreground/60 tracking-widest bg-background/80 px-3 py-1 rounded">
                  .dot-matrix-bg
                </span>
              </div>
              <div className="p-4 bg-card border-t border-border/30">
                <p className="text-xs font-mono text-muted-foreground">Radial gradient dot pattern. Cyan dots at 20px grid.</p>
              </div>
            </div>

            <div className="rounded-sm border border-border/50 overflow-hidden">
              <div className="medical-gradient-bg h-32 flex items-center justify-center">
                <span className="text-xs font-mono text-muted-foreground/80 tracking-widest bg-black/40 px-3 py-1 rounded">
                  .medical-gradient-bg
                </span>
              </div>
              <div className="p-4 bg-card border-t border-border/30">
                <p className="text-xs font-mono text-muted-foreground">Navy→Teal gradient. Panels and feature backgrounds.</p>
              </div>
            </div>

            <div className="rounded-sm border border-border/50 overflow-hidden">
              <div className="grain h-32 bg-muted flex items-center justify-center">
                <span className="text-xs font-mono text-muted-foreground/80 tracking-widest bg-background/60 px-3 py-1 rounded">
                  .grain
                </span>
              </div>
              <div className="p-4 bg-card border-t border-border/30">
                <p className="text-xs font-mono text-muted-foreground">SVG noise overlay at 5% opacity. Film-grain texture.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Custom Buttons */}
        <div>
          <SubSectionLabel code="04.D" title="Medical Button Variants" />
          <div className="rounded-sm border border-border/50 bg-card p-6 space-y-5">
            {BUTTONS_DEMO.map((b) => (
              <div key={b.cls} className="flex items-center gap-6">
                <button className={`${b.cls} px-5 py-2 rounded-sm text-sm font-mono font-semibold shrink-0`}>
                  {b.label.replace('.', '')}
                </button>
                <div>
                  <code className="text-xs font-mono" style={{ color: '#00d9ff' }}>{b.label}</code>
                  <p className="text-xs text-muted-foreground mt-0.5">{b.desc}</p>
                </div>
              </div>
            ))}

            <div className="border-t border-border/30 pt-5">
              <div className="flex items-center gap-6">
                <input
                  className="medical-input px-4 py-2 rounded-sm text-sm font-mono"
                  placeholder="medical-input — cyan focus ring"
                  style={{ maxWidth: '280px' }}
                />
                <div>
                  <code className="text-xs font-mono" style={{ color: '#00d9ff' }}>.medical-input</code>
                  <p className="text-xs text-muted-foreground mt-0.5">Full-width input with cyan focus border glow.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Diagonal Accent */}
        <div>
          <SubSectionLabel code="04.E" title="Clip Paths · Text Effects" />
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-sm border border-border/50 bg-card p-6">
              <span className="text-[10px] font-mono text-muted-foreground/60 tracking-widest block mb-4 uppercase">.diagonal-accent</span>
              <div
                className="diagonal-accent h-20 flex items-center px-6"
                style={{ background: 'linear-gradient(135deg, #00d9ff20, #00b8a920)' }}
              >
                <span className="font-display text-lg font-bold text-foreground">MediNexus AI</span>
              </div>
              <p className="text-xs text-muted-foreground mt-3">polygon(0 0, 100% 0, 100% 85%, 0 100%) clip-path</p>
            </div>

            <div className="rounded-sm border border-border/50 bg-card p-6">
              <span className="text-[10px] font-mono text-muted-foreground/60 tracking-widest block mb-4 uppercase">
                Gradient Text Effects
              </span>
              <div className="space-y-3">
                <p
                  className="font-display text-2xl font-bold bg-clip-text text-transparent"
                  style={{ backgroundImage: 'linear-gradient(135deg, #00d9ff, #00b8a9)' }}
                >
                  Cyan → Teal
                </p>
                <p
                  className="font-display text-2xl font-bold bg-clip-text text-transparent"
                  style={{ backgroundImage: 'linear-gradient(135deg, #6366f1, #00d9ff)' }}
                >
                  Purple → Cyan
                </p>
                <p
                  className="font-display text-2xl font-bold bg-clip-text text-transparent"
                  style={{ backgroundImage: 'linear-gradient(135deg, #00d9ff, #6366f1, #00b8a9)' }}
                >
                  Full Spectrum
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
