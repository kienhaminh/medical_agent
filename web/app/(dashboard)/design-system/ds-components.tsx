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

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground mb-4">{title}</h3>
      {children}
    </div>
  )
}

function DemoBox({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {label && (
        <div className="px-5 py-2.5 border-b border-border">
          <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        </div>
      )}
      <div className="p-5 flex flex-wrap gap-3 items-center">{children}</div>
    </div>
  )
}

export default function DSComponents() {
  const [switchOn, setSwitchOn] = useState(true)
  const [sliderVal, setSliderVal] = useState([65])
  const [checked, setChecked] = useState(true)

  return (
    <section id="components" className="scroll-mt-8">
      <div className="mb-10">
        <h2 className="font-display text-3xl font-bold tracking-tight mb-2">Components</h2>
        <p className="text-sm text-muted-foreground">
          shadcn/ui with Radix primitives, restyled for Graphite &amp; Sage.
        </p>
      </div>

      <div className="space-y-10">
        {/* Buttons */}
        <SubSection title="Buttons">
          <div className="space-y-3">
            <DemoBox label="Variants">
              <Button variant="default">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="success">Success</Button>
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
        </SubSection>

        {/* Badges */}
        <SubSection title="Badges">
          <div className="space-y-3">
            <DemoBox label="Standard">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="destructive">Destructive</Badge>
            </DemoBox>
            <DemoBox label="Status">
              <Badge variant="success">Normal</Badge>
              <Badge variant="warning">Elevated</Badge>
              <Badge variant="danger">Critical</Badge>
              <Badge variant="info">Pending</Badge>
            </DemoBox>
            <DemoBox label="Medical Records">
              <Badge variant="mri">MRI</Badge>
              <Badge variant="xray">X-Ray</Badge>
              <Badge variant="lab">Lab</Badge>
              <Badge variant="ct">CT</Badge>
              <Badge variant="ultrasound">Ultrasound</Badge>
              <Badge variant="clinical">Clinical</Badge>
            </DemoBox>
          </div>
        </SubSection>

        {/* Form Controls */}
        <SubSection title="Form Controls">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Patient ID</Label>
                <Input placeholder="e.g. PT-00291" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Diagnosis</Label>
                <Textarea placeholder="Enter clinical notes..." className="resize-none h-24" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Department</Label>
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

            <div className="rounded-xl border border-border bg-card p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground block mb-1">Notifications</Label>
                  <p className="text-xs text-muted-foreground/70">Real-time alerts enabled</p>
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
                  <Label className="text-xs font-medium text-muted-foreground">Confidence Threshold</Label>
                  <span className="text-sm font-mono text-primary">{sliderVal[0]}%</span>
                </div>
                <Slider value={sliderVal} onValueChange={setSliderVal} min={0} max={100} step={1} />
              </div>
            </div>
          </div>
        </SubSection>

        {/* Cards & Avatars */}
        <SubSection title="Cards">
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">JD</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base">Jane Doe</CardTitle>
                    <CardDescription className="text-xs font-mono">PT-00291</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Heart Rate</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">72 bpm</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Blood Pressure</span>
                  <span className="font-mono">120/80</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">SpO2</span>
                  <span className="font-mono text-primary">98%</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="size-4 text-destructive" />
                  Critical Alert
                </CardTitle>
                <CardDescription className="text-xs font-mono">03:47 AM</CardDescription>
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

            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <span className="text-[11px] font-medium text-muted-foreground block">Skeleton Loading</span>
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
        </SubSection>

        {/* Tabs */}
        <SubSection title="Tabs">
          <div className="rounded-xl border border-border bg-card p-6">
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="imaging">Imaging</TabsTrigger>
                <TabsTrigger value="labs">Labs</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="mt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                  Patient overview — vitals, active medications, recent visits.
                </div>
              </TabsContent>
              <TabsContent value="imaging" className="mt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Info className="size-4 text-primary" />
                  Imaging records — MRI, CT, X-Ray, Ultrasound thumbnails and reports.
                </div>
              </TabsContent>
              <TabsContent value="labs" className="mt-4">
                <p className="text-sm text-muted-foreground">Lab results table with reference ranges and trend indicators.</p>
              </TabsContent>
              <TabsContent value="notes" className="mt-4">
                <p className="text-sm text-muted-foreground">Clinical notes with AI summaries and provider annotations.</p>
              </TabsContent>
            </Tabs>
          </div>
        </SubSection>
      </div>
    </section>
  )
}
