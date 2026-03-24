'use client'

const TYPE_SCALE = [
  { name: 'Display / 7xl', class: 'text-7xl', size: '4.5rem / 72px', sample: 'Patient Zero' },
  { name: 'Heading / 5xl', class: 'text-5xl', size: '3rem / 48px', sample: 'Vital Signs' },
  { name: 'Title / 3xl', class: 'text-3xl', size: '1.875rem / 30px', sample: 'Clinical Notes' },
  { name: 'Subtitle / xl', class: 'text-xl', size: '1.25rem / 20px', sample: 'Diagnostic Report' },
  { name: 'Body / base', class: 'text-base', size: '1rem / 16px', sample: 'Patient examination reveals normal sinus rhythm with no ST changes detected during monitoring.' },
  { name: 'Small / sm', class: 'text-sm', size: '0.875rem / 14px', sample: 'Lab values within reference range. Follow-up in 6 months recommended.' },
  { name: 'Caption / xs', class: 'text-xs', size: '0.75rem / 12px', sample: 'Last updated: 2026-03-23 · Dr. A. Chen · MediNexus v1.0' },
]

const FONT_WEIGHTS = [
  { weight: '400', label: 'Regular', cls: 'font-normal' },
  { weight: '500', label: 'Medium', cls: 'font-medium' },
  { weight: '600', label: 'SemiBold', cls: 'font-semibold' },
  { weight: '700', label: 'Bold', cls: 'font-bold' },
]

const FONT_FAMILIES = [
  {
    name: 'JetBrains Mono',
    cls: 'font-display',
    tag: 'Display / Heading',
    sample: 'Aa Bb Cc Dd Ee Ff Gg — 0123456789',
    desc: 'Monospace display font. Used for all headings, identifiers, and diagnostic labels. Technical precision.',
  },
  {
    name: 'Geist Sans',
    cls: 'font-sans',
    tag: 'Body / UI',
    sample: 'Aa Bb Cc Dd Ee Ff Gg — 0123456789',
    desc: 'Clean sans-serif for body text, UI labels, and general readable content. Optimized for screen.',
  },
  {
    name: 'Geist Mono',
    cls: 'font-mono',
    tag: 'Code / Data',
    sample: 'Aa Bb Cc Dd Ee Ff Gg — 0123456789',
    desc: 'Monospace variant for code blocks, data values, and technical identifiers.',
  },
]

export default function DSTypography() {
  return (
    <section id="typography" className="scroll-mt-8">
      <div className="flex items-end gap-4 mb-10">
        <div>
          <p className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground/50 mb-1">SYS.DESIGN.TYPE.02</p>
          <h2 className="font-display text-3xl font-bold">Typography</h2>
        </div>
        <div className="h-px flex-1 bg-border mb-2" />
        <span className="text-[10px] font-mono text-muted-foreground mb-2">JetBrains Mono · Geist · Geist Mono</span>
      </div>

      {/* Font Families */}
      <div className="mb-12">
        <div className="flex items-baseline gap-4 mb-6">
          <span className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground/50">02.A</span>
          <h3 className="text-sm font-mono font-semibold text-muted-foreground uppercase tracking-widest">Font Families</h3>
          <div className="h-px flex-1 bg-border/50" />
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {FONT_FAMILIES.map((f) => (
            <div
              key={f.name}
              className="rounded-sm border border-border/50 p-5 bg-card hover:border-[#00d9ff]/30 transition-colors duration-200"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">{f.tag}</span>
                <span
                  className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
                  style={{ borderColor: 'rgba(0,217,255,0.3)', color: '#00d9ff' }}
                >
                  .{f.cls}
                </span>
              </div>
              <p className={`text-2xl mb-2 ${f.cls}`}>{f.sample}</p>
              <p className="font-display text-lg font-semibold text-foreground mb-2">{f.name}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Type Scale */}
      <div className="mb-12">
        <div className="flex items-baseline gap-4 mb-6">
          <span className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground/50">02.B</span>
          <h3 className="text-sm font-mono font-semibold text-muted-foreground uppercase tracking-widest">Type Scale</h3>
          <div className="h-px flex-1 bg-border/50" />
        </div>
        <div className="rounded-sm border border-border/50 overflow-hidden">
          {TYPE_SCALE.map((t, i) => (
            <div
              key={t.name}
              className={`flex items-baseline gap-6 px-6 py-5 border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors duration-150 ${i % 2 === 0 ? '' : 'bg-card/50'}`}
            >
              <div className="w-36 shrink-0">
                <p className="text-[10px] font-mono text-muted-foreground/60">{t.name}</p>
                <p className="text-[10px] font-mono text-muted-foreground/40 mt-0.5">{t.size}</p>
              </div>
              <p className={`font-display ${t.class} font-semibold leading-tight truncate flex-1`}>{t.sample}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Font Weights */}
      <div>
        <div className="flex items-baseline gap-4 mb-6">
          <span className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground/50">02.C</span>
          <h3 className="text-sm font-mono font-semibold text-muted-foreground uppercase tracking-widest">Font Weights — JetBrains Mono</h3>
          <div className="h-px flex-1 bg-border/50" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {FONT_WEIGHTS.map((w) => (
            <div
              key={w.weight}
              className="rounded-sm border border-border/50 p-5 bg-card hover:border-[#00d9ff]/30 transition-colors duration-200"
            >
              <span className="text-[10px] font-mono text-muted-foreground/50 block mb-3">{w.weight}</span>
              <p className={`font-display text-2xl ${w.cls} text-foreground mb-2`}>Diagnosis</p>
              <p className="text-xs font-mono text-muted-foreground">.{w.cls} · {w.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
