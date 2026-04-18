// All demo text content for MEDERA promo v2

export const SCENE_CALLOUTS = {
  patientsTriaged: "PATIENTS TRIAGED IN SECONDS",
  aiPreVisitBrief: "AI-GENERATED PRE-VISIT BRIEF",
  aiThinks: "AI THAT THINKS WITH YOUR DOCTORS",
  mriSegmentation: "REAL-TIME BRAIN TUMOR SEGMENTATION",
  hospitalOps: "REAL-TIME HOSPITAL OPERATIONS",
  oneClickToStart: "ONE CLICK TO START",
} as const;

export const PROBLEM_LINES = [
  { text: "Patients wait. Paperwork piles up.", enterFrame: 15, exitFrame: 90, fontSize: 38, color: "#94a3b8" },
  { text: "Doctors juggle 5 apps to see one patient.", enterFrame: 50, exitFrame: 120, fontSize: 38, color: "#94a3b8" },
  { text: "There has to be a better way.", enterFrame: 100, exitFrame: 160, fontSize: 44, fontWeight: 700, color: "#ffffff" },
] as const;

export const BRAND_TAGLINE = "One AI Agent. The Entire Hospital Workflow.";

export const INTAKE_MESSAGES = [
  { role: "assistant" as const, text: "Hi! I'm your intake assistant. Are you a new or returning patient?" },
  { role: "user" as const, text: "I'm new. I have chest pain and shortness of breath." },
  { role: "assistant" as const, text: "I'm sorry to hear that. Let me get you checked in right away." },
] as const;

export const INTAKE_FORM = {
  title: "Quick Check-In",
  fields: [
    { label: "Full Name", value: "Sarah Chen", type: "text" as const },
    { label: "Date of Birth", value: "03/15/1985", type: "text" as const },
    { label: "Symptoms", value: "Chest pain, shortness of breath", type: "textarea" as const },
  ],
} as const;

export const TRIAGE_RESULT = {
  department: "Cardiology",
  urgency: "Urgent",
  urgencyColor: "#d97706",
  message: "A care team is being notified now",
  trackingId: "VIS-20260418-001",
} as const;

export const PATIENT_LIST = [
  { name: "Sarah Chen", urgency: "urgent" as const, urgencyColor: "#d97706", complaint: "Chest pain", waitMinutes: 3, selected: true },
  { name: "James Wilson", urgency: "routine" as const, urgencyColor: "#059669", complaint: "Follow-up visit", waitMinutes: 12 },
  { name: "Maria Garcia", urgency: "routine" as const, urgencyColor: "#059669", complaint: "Annual physical", waitMinutes: 18 },
] as const;

export const PATIENT_HEADER = {
  name: "Sarah Chen",
  age: 42,
  sex: "F",
  visitId: "VIS-20260418-001",
} as const;

export const PATIENT_VITALS = [
  { label: "BP", value: "128/82", unit: "mmHg" },
  { label: "HR", value: "92", unit: "bpm" },
  { label: "SpO₂", value: "98", unit: "%" },
  { label: "Temp", value: "37.1", unit: "°C" },
] as const;

export const VISIT_BRIEF =
  "42F presenting with acute chest pain and dyspnea. Onset 2 hours ago. Pain: 7/10, substernal, non-radiating. No prior cardiac history.";

export const SUGGESTED_ORDERS = [
  { name: "Troponin I", badge: "Lab", badgeColor: "#6366f1" },
  { name: "12-Lead ECG", badge: "Lab", badgeColor: "#6366f1" },
  { name: "Chest X-Ray", badge: "Imaging", badgeColor: "#0891b2" },
] as const;

export const AI_DOCTOR_QUERY = "Review labs and recommend next steps for Sarah Chen";

export const AI_TOOL_CALLS = [
  { name: "search_patient_records" },
  { name: "check_drug_interactions" },
  { name: "analyze_lab_results" },
] as const;

export const AI_RESPONSE =
  "Based on elevated troponin and ECG findings, recommend cardiology consult for possible ACS workup. Consider starting dual antiplatelet therapy.";

export const MRI_COMMAND = "Perform MRI segmentation on Sarah Chen's brain scan";
export const MRI_PROCESSING_TEXT = "Analyzing 4 MRI modalities...";
export const MRI_PROCESSING_SUBTEXT = "T1 · T1ce · T2 · FLAIR";
export const MRI_METADATA = "Slice 78/155 · Tumor coverage: 12.4%";

export const MRI_LEGEND = [
  { color: "#dc2626", label: "Necrotic Core" },
  { color: "#22c55e", label: "Peritumoral Edema" },
  { color: "#3b82f6", label: "Enhancing Tumor" },
] as const;

export const KPI_METRICS = [
  { label: "Active Visits", value: 24 },
  { label: "Pending Review", value: 7 },
  { label: "Avg Wait Time", value: "8 min" },
  { label: "Admission Rate", value: "67%" },
] as const;

export const KANBAN_COLUMNS = [
  {
    title: "Intake",
    color: "#6366f1",
    cards: [
      { name: "D. Thompson", dept: "Neurology", wait: "2m" },
      { name: "L. Park", dept: "ENT", wait: "1m" },
    ],
  },
  {
    title: "Triaged",
    color: "#d97706",
    cards: [
      { name: "A. Foster", dept: "Cardiology", wait: "5m", movesOut: true as const },
      { name: "R. Patel", dept: "Radiology", wait: "8m" },
      { name: "K. Nguyen", dept: "Orthopedics", wait: "3m" },
    ],
  },
  {
    title: "In Department",
    color: "#0891b2",
    cards: [
      { name: "S. Chen", dept: "Cardiology", wait: "12m", highlight: true as const },
      { name: "J. Wilson", dept: "Internal Med", wait: "20m" },
      { name: "A. Foster", dept: "Cardiology", wait: "5m", movesIn: true as const },
    ],
  },
  {
    title: "Completed",
    color: "#059669",
    cards: [
      { name: "M. Garcia", dept: "General", wait: "—" },
      { name: "T. Brooks", dept: "Dermatology", wait: "—" },
    ],
  },
] as const;

export const CLOSING_TAGLINE = "INTELLIGENT HEALTHCARE, AUTOMATED.";
export const CLOSING_URL = "medera.ai";

export const FEATURE_RECAP = [
  { label: "Smart Intake" },
  { label: "Doctor Workspace" },
  { label: "AI Segmentation" },
  { label: "Admin Dashboard" },
] as const;
