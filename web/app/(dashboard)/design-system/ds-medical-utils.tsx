'use client'

import { Badge } from '@/components/ui/badge'

const STATUS_EXAMPLES = [
  {
    status: 'status-success',
    label: 'Normal Result',
    detail: 'All values within reference range',
    badge: 'success' as const,
  },
  {
    status: 'status-warning',
    label: 'Elevated Troponin',
    detail: 'Above normal range, monitoring recommended',
    badge: 'warning' as const,
  },
  {
    status: 'status-danger',
    label: 'Critical A1C',
    detail: 'Immediate intervention required',
    badge: 'danger' as const,
  },
  {
    status: 'status-info',
    label: 'Pending Review',
    detail: 'Awaiting physician sign-off',
    badge: 'info' as const,
  },
]

export default function DSMedicalUtils() {
  return (
    <section id="medical" className="scroll-mt-8">
      <div className="mb-10">
        <h2 className="font-display text-3xl font-bold tracking-tight mb-2">Medical Utilities</h2>
        <p className="text-sm text-muted-foreground">
          Status indicators, record badges, and clinical patterns.
        </p>
      </div>

      <div className="space-y-10">
        {/* Status Indicators */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Status Indicators</h3>
          <div className="grid md:grid-cols-2 gap-3">
            {STATUS_EXAMPLES.map((s) => (
              <div
                key={s.status}
                className={`${s.status} rounded-lg border border-border bg-card p-5 transition-colors duration-200`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">{s.label}</span>
                  <Badge variant={s.badge}>{s.badge}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{s.detail}</p>
                <p className="text-[11px] font-mono text-muted-foreground/50 mt-3">.{s.status}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Medical Record Badges */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Record Type Badges</h3>
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex flex-wrap gap-2 mb-6">
              <Badge variant="mri">MRI</Badge>
              <Badge variant="xray">X-Ray</Badge>
              <Badge variant="lab">Lab</Badge>
              <Badge variant="ct">CT</Badge>
              <Badge variant="ultrasound">Ultrasound</Badge>
              <Badge variant="clinical">Clinical</Badge>
            </div>
            <div className="border-t border-border pt-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { variant: 'mri' as const, desc: 'Magnetic resonance imaging' },
                { variant: 'xray' as const, desc: 'Radiographic imaging' },
                { variant: 'lab' as const, desc: 'Laboratory results' },
                { variant: 'ct' as const, desc: 'Computed tomography' },
                { variant: 'ultrasound' as const, desc: 'Sonographic imaging' },
                { variant: 'clinical' as const, desc: 'Clinical text records' },
              ].map((b) => (
                <div key={b.variant} className="flex items-start gap-2">
                  <Badge variant={b.variant} className="shrink-0 mt-0.5">{b.variant.toUpperCase()}</Badge>
                  <span className="text-xs text-muted-foreground leading-relaxed">{b.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Grain Texture */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Background Textures</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="grain h-32 bg-muted flex items-center justify-center">
                <span className="text-xs font-mono text-muted-foreground bg-background/60 px-3 py-1 rounded-full">
                  .grain
                </span>
              </div>
              <div className="p-4 bg-card border-t border-border">
                <p className="text-xs text-muted-foreground">Subtle noise texture at 3% opacity. Adds warmth to surfaces.</p>
              </div>
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
              <div className="h-32 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 flex items-center justify-center">
                <span className="text-xs font-mono text-muted-foreground bg-background/60 px-3 py-1 rounded-full">
                  sage gradient
                </span>
              </div>
              <div className="p-4 bg-card border-t border-border">
                <p className="text-xs text-muted-foreground">Subtle primary gradient for feature sections and hero areas.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Text Gradient */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Text Effects</h3>
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="space-y-4">
              <div>
                <p className="font-display text-3xl font-bold text-gradient tracking-tight">
                  Graphite &amp; Sage
                </p>
                <p className="text-xs font-mono text-muted-foreground/50 mt-2">.text-gradient</p>
              </div>
              <Separator />
              <div>
                <p className="font-display text-3xl font-bold text-primary tracking-tight">
                  Clinical Precision
                </p>
                <p className="text-xs font-mono text-muted-foreground/50 mt-2">.text-primary</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Separator() {
  return <div className="h-px bg-border" />
}
