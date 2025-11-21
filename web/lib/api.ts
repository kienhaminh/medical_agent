const API_BASE_URL = 'http://localhost:8000/api';

export interface Patient {
  id: number;
  name: string;
  dob: string;
  gender: string;
  created_at: string;
}

export interface Tool {
  name: string;
  description?: string;
  enabled: boolean;
  category?: string;
}

export interface PatientVisit {
  id: number;
  patient_id: number;
  visit_date: string;
  visit_type: string; // 'routine' | 'emergency' | 'follow-up' | 'consultation'
  chief_complaint: string;
  diagnosis: string;
  treatment_plan: string;
  notes: string;
  vital_signs?: {
    temperature?: string;
    blood_pressure?: string;
    heart_rate?: string;
    respiratory_rate?: string;
    oxygen_saturation?: string;
    weight?: string;
    height?: string;
  };
  doctor_name: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface MedicalRecord {
  id: number;
  patient_id: number;
  visit_id?: number; // Link to specific visit
  record_type: 'text' | 'image' | 'pdf';
  title: string;
  description?: string;
  content?: string; // For text records
  file_url?: string; // For image/pdf records
  file_type?: string; // 'mri' | 'xray' | 'ct_scan' | 'ultrasound' | 'lab_report' | 'other'
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PatientDetail extends Patient {
  medical_history?: string;
  allergies?: string;
  current_medications?: string;
  family_history?: string;
  health_summary?: string; // AI-generated overview
  records?: MedicalRecord[];
  visits?: PatientVisit[];
}

export interface UploadResponse {
  success: boolean;
  record: MedicalRecord;
}

export async function getPatients(): Promise<Patient[]> {
  const res = await fetch(`${API_BASE_URL}/patients`);
  if (!res.ok) throw new Error('Failed to fetch patients');
  return res.json();
}

export async function getPatient(id: number): Promise<Patient> {
  const res = await fetch(`${API_BASE_URL}/patients/${id}`);
  if (!res.ok) throw new Error('Failed to fetch patient');
  return res.json();
}

export async function createPatient(data: Omit<Patient, 'id' | 'created_at'>): Promise<Patient> {
  const res = await fetch(`${API_BASE_URL}/patients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create patient');
  return res.json();
}

export async function getTools(): Promise<Tool[]> {
  const res = await fetch(`${API_BASE_URL}/tools`);
  if (!res.ok) throw new Error('Failed to fetch tools');
  return res.json();
}

export async function toggleTool(name: string, enabled: boolean): Promise<Tool> {
  const res = await fetch(`${API_BASE_URL}/tools/${name}/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error('Failed to toggle tool');
  return res.json();
}

export async function createTool(tool: Omit<Tool, 'enabled'>): Promise<Tool> {
  const res = await fetch(`${API_BASE_URL}/tools`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...tool, enabled: true }),
  });
  if (!res.ok) throw new Error('Failed to create tool');
  return res.json();
}

export async function updateTool(name: string, tool: Partial<Tool>): Promise<Tool> {
  const res = await fetch(`${API_BASE_URL}/tools/${name}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tool),
  });
  if (!res.ok) throw new Error('Failed to update tool');
  return res.json();
}

export async function deleteTool(name: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/tools/${name}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete tool');
}

// Medical Records API
export async function getPatientDetail(id: number): Promise<PatientDetail> {
  const res = await fetch(`${API_BASE_URL}/patients/${id}/detail`);
  if (!res.ok) throw new Error('Failed to fetch patient detail');
  return res.json();
}

export async function getPatientRecords(patientId: number): Promise<MedicalRecord[]> {
  const res = await fetch(`${API_BASE_URL}/patients/${patientId}/records`);
  if (!res.ok) throw new Error('Failed to fetch patient records');
  return res.json();
}

export async function uploadMedicalRecord(
  patientId: number,
  file: File,
  metadata: { title: string; description?: string; file_type?: string }
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', metadata.title);
  if (metadata.description) formData.append('description', metadata.description);
  if (metadata.file_type) formData.append('file_type', metadata.file_type);

  const res = await fetch(`${API_BASE_URL}/patients/${patientId}/records/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Failed to upload medical record');
  return res.json();
}

export async function addTextRecord(
  patientId: number,
  data: { title: string; content: string; description?: string }
): Promise<MedicalRecord> {
  const res = await fetch(`${API_BASE_URL}/patients/${patientId}/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to add text record');
  return res.json();
}

export async function deleteRecord(recordId: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/records/${recordId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete record');
}
