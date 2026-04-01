// All demo text content centralized for easy editing

export const SCENE_CALLOUTS = {
  opening: "YOUR AI-POWERED HOSPITAL",
  intake: "PATIENTS TRIAGED IN SECONDS",
  doctorWorkspace: "EVERYTHING YOUR TEAM NEEDS, ONE SCREEN",
  aiReasoning: "AI THAT THINKS WITH YOUR DOCTORS",
  closing: "THE FUTURE OF PATIENT CARE",
} as const;

export const INTAKE_MESSAGES = {
  userMessage: "I'm experiencing chest pain",
  aiMessage:
    "I'm sorry to hear that. Let me help you get checked in right away. Can you tell me when the pain started and how severe it is on a scale of 1-10?",
} as const;

export const INTAKE_FORM = {
  fields: [
    { label: "Full Name", value: "Sarah Chen" },
    { label: "Date of Birth", value: "03/15/1985" },
    { label: "Symptoms", value: "Chest pain, shortness of breath" },
  ],
} as const;

export const TRIAGE_RESULT = {
  department: "Cardiology",
  urgency: "Urgent",
  message: "A medical team will see you shortly",
} as const;

export const PATIENT_LIST = [
  { name: "Sarah Chen", urgency: "urgent" as const, complaint: "Chest pain", waitMinutes: 3, selected: true },
  { name: "James Wilson", urgency: "routine" as const, complaint: "Follow-up visit", waitMinutes: 12 },
  { name: "Maria Garcia", urgency: "routine" as const, complaint: "Annual physical", waitMinutes: 18 },
  { name: "Robert Kim", urgency: "routine" as const, complaint: "Knee pain", waitMinutes: 25 },
] as const;

export const VISIT_BRIEF =
  "42F presenting with acute chest pain and dyspnea. Onset 2 hours ago. Pain: 7/10, substernal, non-radiating. No prior cardiac history.";

export const ORDERS = [
  { name: "Troponin I", type: "Lab" as const },
  { name: "12-Lead ECG", type: "Lab" as const },
  { name: "Chest X-Ray", type: "Imaging" as const },
] as const;

export const SOAP_NOTE =
  "S: Patient reports substernal chest pain rated 7/10, onset 2 hours ago. Associated with shortness of breath. No radiation. No prior cardiac history.";

export const AI_TOOL_CALLS = [
  { name: "search_patient_records", status: "completed" as const },
  { name: "check_drug_interactions", status: "completed" as const },
  { name: "analyze_lab_results", status: "completed" as const },
] as const;

export const AI_RESPONSE =
  "Based on the elevated troponin and ECG findings, recommend cardiology consult for possible ACS workup. Consider starting dual antiplatelet therapy.";

export const SUGGESTIONS = [
  "I'd like to check in for a visit",
  "I'm experiencing chest pain",
  "I need to see a doctor today",
  "This is my first time here",
] as const;
