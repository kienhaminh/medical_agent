export interface ClinicalSection {
  title: string;
  content: string;
  type: "header" | "section" | "list" | "vitals" | "labs" | "medications" | "text";
}

export interface ParsedNote {
  title: string;
  date?: string;
  patientInfo?: {
    name?: string;
    id?: string;
    age?: string;
    gender?: string;
    bloodType?: string;
  };
  diagnosis?: {
    condition?: string;
    icd10?: string;
  };
  sections: ClinicalSection[];
}

export function parseNote(content: string): ParsedNote {
  const lines = content.split("\n");
  const note: ParsedNote = {
    title: "Clinical Note",
    sections: [],
  };

  let currentSection: ClinicalSection | null = null;
  let inSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.match(/^[═━─]+$/)) continue;

    if (i < 5 && (line.includes("CLINICAL ENCOUNTER") || line.includes("PATIENT REGISTRATION") || line.includes("ROUTINE LABORATORY"))) {
      note.title = line;
      continue;
    }

    if (line.startsWith("Date:")) {
      note.date = line.replace("Date:", "").trim();
      continue;
    }

    if (line.startsWith("Patient:")) {
      note.patientInfo = note.patientInfo || {};
      note.patientInfo.name = line.replace("Patient:", "").replace(/\(ID:.*\)/, "").trim();
    }
    if (line.includes("Patient ID:")) {
      note.patientInfo = note.patientInfo || {};
      note.patientInfo.id = line.split(":")[1]?.trim();
    }
    if (line.includes("Age:") && line.includes("years")) {
      note.patientInfo = note.patientInfo || {};
      const ageMatch = line.match(/Age:\s*(\d+)\s*years/);
      if (ageMatch) note.patientInfo.age = `${ageMatch[1]} years`;
    }
    if (line.includes("Gender:")) {
      note.patientInfo = note.patientInfo || {};
      const genderMatch = line.match(/Gender:\s*(\w+)/);
      if (genderMatch) note.patientInfo.gender = genderMatch[1];
    }
    if (line.includes("Blood Type:") || line.includes("Blood Group:")) {
      note.patientInfo = note.patientInfo || {};
      const bloodMatch = line.match(/Blood (?:Type|Group):\s*([ABO]\+|-)/);
      if (bloodMatch) note.patientInfo.bloodType = bloodMatch[1];
    }

    if (line.startsWith("Diagnosis:")) {
      note.diagnosis = note.diagnosis || {};
      const diagMatch = line.match(/Diagnosis:\s*(.+?)\s*(?:\(ICD-10:\s*([A-Z0-9.]+)\))?$/);
      if (diagMatch) {
        note.diagnosis.condition = diagMatch[1].trim();
        if (diagMatch[2]) note.diagnosis.icd10 = diagMatch[2];
      }
    }

    if (line.match(/^[A-Z\s\(\)]+:$/) && line.length > 3 && line.length < 60) {
      if (currentSection) note.sections.push(currentSection);

      const title = line.replace(":", "").trim();
      currentSection = { title, content: "", type: getSectionType(title, "") };
      inSection = true;
      continue;
    }

    if (inSection && currentSection && line) {
      currentSection.content = currentSection.content
        ? currentSection.content + "\n" + line
        : line;
    }
  }

  if (currentSection) note.sections.push(currentSection);

  return note;
}

export function getSectionType(title: string, content: string): ClinicalSection["type"] {
  const t = title.toLowerCase();

  if (t.includes("vital signs") || t.includes("vital")) return "vitals";
  if (
    t.includes("laboratory") ||
    t.includes("lab results") ||
    t.includes("complete blood count") ||
    t.includes("metabolic panel") ||
    t.includes("lipid panel") ||
    t.includes("liver function") ||
    t.includes("thyroid")
  ) return "labs";
  if (t.includes("medication")) return "medications";
  if (content.includes("•") || content.includes("-")) return "list";
  return "text";
}

export function parseVitals(content: string): Array<{ label: string; value: string; iconKey: string }> {
  const vitals: Array<{ label: string; value: string; iconKey: string }> = [];

  for (const line of content.split("\n")) {
    const clean = line.replace(/^[•\-\*]\s*/, "").trim();
    if (!clean || clean.match(/^[═━─]+$/)) continue;

    const val = clean.split(":")[1]?.trim() || "";

    if (clean.includes("BP:") || clean.includes("Blood Pressure:")) {
      vitals.push({ label: "Blood Pressure", value: val, iconKey: "bp" });
    } else if (clean.includes("HR:") || clean.includes("Heart Rate:")) {
      vitals.push({ label: "Heart Rate", value: val, iconKey: "hr" });
    } else if (clean.includes("RR:") || clean.includes("Respiratory Rate:")) {
      vitals.push({ label: "Respiratory Rate", value: val, iconKey: "rr" });
    } else if (clean.includes("Temp:") || clean.includes("Temperature:")) {
      vitals.push({ label: "Temperature", value: val, iconKey: "temp" });
    } else if (clean.includes("SpO2:") || clean.includes("Oxygen Saturation:")) {
      vitals.push({ label: "SpO2", value: val, iconKey: "spo2" });
    } else if (clean.includes("Weight:")) {
      vitals.push({ label: "Weight", value: val, iconKey: "weight" });
    } else if (clean.includes("Height:")) {
      vitals.push({ label: "Height", value: val, iconKey: "height" });
    } else if (clean.includes("BMI:")) {
      vitals.push({ label: "BMI", value: val, iconKey: "bmi" });
    }
  }

  return vitals;
}

export function parseLabValues(content: string): Array<{ name: string; value: string; flag?: "H" | "L" }> {
  const labs: Array<{ name: string; value: string; flag?: "H" | "L" }> = [];

  for (const line of content.split("\n")) {
    const clean = line.replace(/^[•\-\*]\s*/, "").trim();
    if (!clean || clean.match(/^[═━─]+$/)) continue;

    const parts = clean.split(":");
    if (parts.length !== 2) continue;

    const valueStr = parts[1].trim();
    const flag: "H" | "L" | undefined = valueStr.includes("(H)") ? "H" : valueStr.includes("(L)") ? "L" : undefined;

    labs.push({
      name: parts[0].trim(),
      value: valueStr.replace(/\([HL]\)/, "").trim(),
      flag,
    });
  }

  return labs;
}
