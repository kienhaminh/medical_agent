# Intake Flow — Test Messages

Use these at `http://localhost:3000/intake` to test end-to-end intake scenarios.

---

## Scenario A — New Patient (Gastroenterology routing)

Type these messages in order. Fill in any forms the agent shows between messages.

```
Hi, I'd like to register as a new patient
```
> Agent shows registration form. Fill in:
> - First Name: **Minh**
> - Last Name: **Tran**
> - Date of Birth: **1988-04-12**
> - Phone: **0912345678**
> - Gender: **Male**

```
I've been having stomach pain for the past 3 days
```
> Agent shows chief complaint form. Fill in:
> - Main Complaint: **Stomach pain and nausea**
> - Other Symptoms: **Bloating, loss of appetite**
> - Height: **172**
> - Weight: **68**

*(Answer the agent's follow-up questions with these responses, one at a time)*

```
It started about 3 days ago, gradually getting worse
```
```
I'd say a 6 out of 10. It's a dull ache around my belly button
```
```
It gets worse after eating, slightly better if I lie down
```
```
No medications currently. I had a similar episode about a year ago but it went away on its own
```
```
No known allergies
```

**Expected outcome:** Agent routes to **Gastroenterology**, confidence ≥ 0.75. Tracking link provided.

---

## Scenario B — Returning Patient (Cardiology routing)

Use this when a patient already exists in the DB (the intake page must be opened with `?patient_id=<n>`), or just start with this message if patient context is pre-loaded.

```
Hi, I'm back for a follow-up
```

*(Agent skips registration and shows chief complaint form directly)*
> Fill in:
> - Main Complaint: **Heart palpitations and occasional chest tightness**
> - Other Symptoms: **Shortness of breath when climbing stairs**
> - Height: **165**
> - Weight: **72**

```
Started about two weeks ago, comes and goes
```
```
Chest tightness is mild, maybe 4 out of 10. The palpitations last a few seconds each time
```
```
Happens mostly in the evenings or when I'm stressed
```
```
I'm taking Amlodipine 5mg for blood pressure. No allergies
```

**Expected outcome:** Agent routes to **Cardiology**, confidence ≥ 0.80.

---

## Scenario C — Emergency Red Flag (immediate escalation)

```
I need help, I have severe chest pain and I can't breathe properly
```

**Expected outcome:** Agent skips all follow-up questions, calls `complete_triage` immediately with `routing_suggestion=["emergency"]`, confidence ≥ 0.95. No form shown.

---

## Scenario D — New Patient, Unclear / Low Confidence (Internal Medicine)

```
I'm a new patient
```
> Registration form — fill in any values, e.g.:
> - First Name: **Lan**, Last Name: **Nguyen**, DOB: **1975-09-30**, Phone: **0987654321**, Gender: **Female**

```
I've just been feeling generally unwell for about two weeks
```
> Chief complaint form:
> - Main Complaint: **General fatigue and feeling unwell**
> - Other Symptoms: **Mild headache, low appetite**

```
I'm not sure when it started exactly, it's been gradual
```
```
Fatigue is maybe a 5. No specific location, just all over
```
```
Nothing makes it better or worse that I've noticed
```
```
I have Type 2 diabetes, managed with Metformin. No allergies I know of
```

**Expected outcome:** Agent routes to **Internal Medicine** or **General Check-up**, confidence < 0.80 (may trigger pending review).

---

## Scenario E — ENT (simple, fast routing)

```
Hi, new patient here
```
> Registration form — any values.

```
Ear pain and I can't hear properly out of my left ear
```
> Chief complaint form:
> - Main Complaint: **Left ear pain and reduced hearing**
> - Other Symptoms: **Mild sore throat**

```
Started yesterday, quite sudden
```
```
Pain is about 5 out of 10, sharp and throbbing
```
```
No recent illness. No medications, no allergies
```

**Expected outcome:** Agent routes to **ENT**, confidence ≥ 0.85. Fast flow (3 questions max).

---

## Tips

- The intake page URL is `http://localhost:3000/intake`
- For returning patient scenarios, open `http://localhost:3000/intake?patient_id=<id>` with a real patient ID from the DB
- The **suggestion chips** at the top of the page ("Hi, I'd like to check in", "I'm a new patient") can substitute for Scenario A's first message
- Watch the browser console for SSE stream events if the agent appears to hang
