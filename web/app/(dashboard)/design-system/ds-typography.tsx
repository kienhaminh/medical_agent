'use client'

const TYPE_SCALE = [
  { name: 'Display', class: 'text-6xl', size: '3.75rem', sample: 'Patient Zero' },
  { name: 'Heading', class: 'text-4xl', size: '2.25rem', sample: 'Vital Signs' },
  { name: 'Title', class: 'text-2xl', size: '1.5rem', sample: 'Clinical Notes' },
  { name: 'Subtitle', class: 'text-xl', size: '1.25rem', sample: 'Diagnostic Report' },
  { name: 'Body', class: 'text-base', size: '1rem', sample: 'Patient examination reveals normal sinus rhythm with no ST changes detected during monitoring.' },
  { name: 'Small', class: 'text-sm', size: '0.875rem', sample: 'Lab values within reference range. Follow-up in 6 months recommended.' },
  { name: 'Caption', class: 'text-xs', size: '0.75rem', sample: 'Last updated: 2026-04-02 — Dr. A. Chen — MediNexus v2.0' },
]

const FONT_FAMILIES = [
  {
    name: 'Playfair Display',
    cls: 'font-display',
    tag: 'Display',
    sample: 'Aa Bb Cc 0123456789',
    desc: 'High-contrast transitional serif for headings and editorial moments. Commands authority.',
  },
  {
    name: 'DM Sans',
    cls: 'font-sans',
    tag: 'Body / UI',
    sample: 'Aa Bb Cc 0123456789',
    desc: 'Geometric sans-serif for body text, labels, and UI elements. Clean and precise.',
  },
  {
    name: 'JetBrains Mono',
    cls: 'font-mono',
    tag: 'Mono / Data',
    sample: 'Aa Bb Cc 0123456789',
    desc: 'Monospace for code, data values, identifiers, and technical content.',
  },
]

export default function DSTypography() {
  return (
    <section id="typography" className="scroll-mt-8">
      <div className="mb-10">
        <h2 className="font-display text-3xl font-bold tracking-tight mb-2">Typography</h2>
        <p className="text-sm text-muted-foreground">
          Playfair Display + DM Sans + JetBrains Mono
        </p>
      </div>

      {/* Font Families */}
      <div className="mb-14">
        <h3 className="text-sm font-medium text-muted-foreground mb-6">Font Families</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {FONT_FAMILIES.map((f) => (
            <div
              key={f.name}
              className="rounded-xl border border-border p-6 bg-card hover:border-foreground/10 transition-colors duration-200"
            >
              <div className="flex items-center justify-between mb-5">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{f.tag}</span>
                <span className="text-[11px] font-mono text-muted-foreground/60">
                  .{f.cls}
                </span>
              </div>
              <p className={`text-3xl mb-4 tracking-tight ${f.cls}`}>{f.sample}</p>
              <p className="text-sm font-medium text-foreground mb-1">{f.name}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Type Scale */}
      <div className="mb-14">
        <h3 className="text-sm font-medium text-muted-foreground mb-6">Type Scale</h3>
        <div className="rounded-xl border border-border overflow-hidden">
          {TYPE_SCALE.map((t, i) => (
            <div
              key={t.name}
              className={`flex items-baseline gap-6 px-6 py-5 border-b border-border last:border-0 ${
                i % 2 === 0 ? '' : 'bg-muted/30'
              }`}
            >
              <div className="w-28 shrink-0">
                <p className="text-xs font-medium text-muted-foreground">{t.name}</p>
                <p className="text-[11px] font-mono text-muted-foreground/50 mt-0.5">{t.size}</p>
              </div>
              <p className={`font-display ${t.class} font-semibold leading-tight truncate flex-1 tracking-tight`}>
                {t.sample}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Weight Showcase */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-6">Weights — Playfair Display</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { weight: '400', label: 'Regular', cls: 'font-normal' },
            { weight: '500', label: 'Medium', cls: 'font-medium' },
            { weight: '600', label: 'SemiBold', cls: 'font-semibold' },
            { weight: '700', label: 'Bold', cls: 'font-bold' },
          ].map((w) => (
            <div
              key={w.weight}
              className="rounded-xl border border-border p-5 bg-card"
            >
              <span className="text-[11px] font-mono text-muted-foreground/50 block mb-3">{w.weight}</span>
              <p className={`font-display text-2xl ${w.cls} text-foreground mb-2 tracking-tight`}>Diagnosis</p>
              <p className="text-xs text-muted-foreground">{w.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
