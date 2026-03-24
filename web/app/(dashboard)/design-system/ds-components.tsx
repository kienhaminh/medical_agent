'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Activity, Brain, FileText, Heart, AlertTriangle, CheckCircle2, Info } from 'lucide-react'

function SubSectionLabel({ code, title }: { code: string; title: string }) {
  return (
    <div className="flex items-baseline gap-4 mb-5">
      <span className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground/50">{code}</span>
      <h3 className="text-sm font-mono font-semibold text-muted-foreground uppercase tracking-widest">{title}</h3>
      <div className="h-px flex-1 bg-border/50" />
    </div>
  )
}

function DemoBox({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="rounded-sm border border-border/50 bg-card overflow-hidden">
      {label && (
        <div className="px-4 py-2 border-b border-border/50 bg-muted/20">
          <span className="text-[10px] font-mono text-muted-foreground/60 tracking-widest uppercase">{label}</span>
        </div>
      )}
      <div className="p-6 flex flex-wrap gap-3 items-center">{children}</div>
    </div>
  )
}

export default function DSComponents() {
  const [switchOn, setSwitchOn] = useState(true)
  const [sliderVal, setSliderVal] = useState([65])
  const [checked, setChecked] = useState(true)

  return (
    <section id="components" className="scroll-mt-8">
      <div className="flex items-end gap-4 mb-10">
        <div>
          <p className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground/50 mb-1">SYS.DESIGN.COMP.03</p>
          <h2 className="font-display text-3xl font-bold">Components</h2>
        </div>
        <div className="h-px flex-1 bg-border mb-2" />
        <span className="text-[10px] font-mono text-muted-foreground mb-2">Shadcn/ui · New York Style · 20 components</span>
      </div>

      <div className="space-y-10">
        {/* Buttons */}
        <div>
          <SubSectionLabel code="03.A" title="Buttons" />
          <div className="space-y-3">
            <DemoBox label="Variants">
              <Button variant="default">Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="link">Link</Button>
            </DemoBox>
            <DemoBox label="Sizes">
              <Button size="lg">Large</Button>
              <Button size="default">Default</Button>
              <Button size="sm">Small</Button>
              <Button size="icon" variant="outline"><Heart className="size-4" /></Button>
            </DemoBox>
            <DemoBox label="With Icons">
              <Button><Brain className="size-4" />AI Consult</Button>
              <Button variant="outline"><Activity className="size-4" />Vitals</Button>
              <Button variant="secondary"><FileText className="size-4" />Records</Button>
            </DemoBox>
          </div>
        </div>

        {/* Badges */}
        <div>
          <SubSectionLabel code="03.B" title="Badges" />
          <DemoBox label="Variants">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
          </DemoBox>
        </div>

        {/* Form Controls */}
        <div>
          <SubSectionLabel code="03.C" title="Form Controls" />
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-sm border border-border/50 bg-card p-6 space-y-4">
              <div className="space-y-2">
                <Label className="font-mono text-xs tracking-widest uppercase text-muted-foreground">Patient ID</Label>
                <Input placeholder="e.g. PT-00291" />
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs tracking-widest uppercase text-muted-foreground">Diagnosis</Label>
                <Textarea placeholder="Enter clinical notes…" className="resize-none h-24" />
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs tracking-widest uppercase text-muted-foreground">Department</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cardio">Cardiology</SelectItem>
                    <SelectItem value="neuro">Neurology</SelectItem>
                    <SelectItem value="onco">Oncology</SelectItem>
                    <SelectItem value="radiology">Radiology</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-sm border border-border/50 bg-card p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-mono text-xs tracking-widest uppercase text-muted-foreground block mb-1">Notifications</Label>
                  <p className="text-xs text-muted-foreground">Real-time alerts enabled</p>
                </div>
                <Switch checked={switchOn} onCheckedChange={setSwitchOn} />
              </div>
              <Separator />
              <div className="space-y-3">
                {['Critical alerts', 'Lab results', 'Imaging ready'].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <Checkbox id={item} checked={checked} onCheckedChange={(v) => setChecked(!!v)} />
                    <label htmlFor={item} className="text-sm cursor-pointer">{item}</label>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label className="font-mono text-xs tracking-widest uppercase text-muted-foreground">Confidence Threshold</Label>
                  <span className="text-sm font-mono" style={{ color: '#00d9ff' }}>{sliderVal[0]}%</span>
                </div>
                <Slider value={sliderVal} onValueChange={setSliderVal} min={0} max={100} step={1} />
              </div>
            </div>
          </div>
        </div>

        {/* Card & Avatar */}
        <div>
          <SubSectionLabel code="03.D" title="Card · Avatar · Skeleton" />
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback className="bg-[#00d9ff]/10 font-mono text-sm" style={{ color: '#00d9ff' }}>JD</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base">Jane Doe</CardTitle>
                    <CardDescription className="font-mono text-xs">PT-00291 · Cardiology</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Heart Rate</span>
                  <span className="font-mono" style={{ color: '#10b981' }}>72 bpm</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Blood Pressure</span>
                  <span className="font-mono text-foreground">120/80</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">SpO₂</span>
                  <span className="font-mono" style={{ color: '#00b8a9' }}>98%</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="size-4 text-destructive" />
                  Critical Alert
                </CardTitle>
                <CardDescription className="font-mono text-xs">03:47 AM · Auto-generated</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Troponin levels elevated beyond threshold. Immediate cardiology consultation recommended.
                </p>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="destructive">Alert Team</Button>
                  <Button size="sm" variant="outline">Dismiss</Button>
                </div>
              </CardContent>
            </Card>

            <div className="rounded-sm border border-border/50 bg-card p-5 space-y-4">
              <span className="text-[10px] font-mono text-muted-foreground/60 tracking-widest uppercase block">Skeleton Loading</span>
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-20 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div>
          <SubSectionLabel code="03.E" title="Tabs" />
          <div className="rounded-sm border border-border/50 bg-card p-6">
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="imaging">Imaging</TabsTrigger>
                <TabsTrigger value="labs">Labs</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="mt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  Patient overview renders here — vitals, active medications, recent visits.
                </div>
              </TabsContent>
              <TabsContent value="imaging" className="mt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Info className="size-4" style={{ color: '#00d9ff' }} />
                  Imaging records — MRI, CT, X-Ray, Ultrasound thumbnails and reports.
                </div>
              </TabsContent>
              <TabsContent value="labs" className="mt-4">
                <p className="text-sm text-muted-foreground">Lab results table with reference ranges and trend indicators.</p>
              </TabsContent>
              <TabsContent value="notes" className="mt-4">
                <p className="text-sm text-muted-foreground">Clinical notes with AI-generated summaries and provider annotations.</p>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </section>
  )
}
