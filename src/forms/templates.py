"""Hardcoded form templates for the reception agent's ask_user tool."""
from dataclasses import dataclass, field
from typing import Literal


@dataclass
class FormField:
    name: str
    label: str
    field_type: Literal["text", "date", "select", "textarea"]
    required: bool = True
    options: list[str] = field(default_factory=list)
    placeholder: str = ""

    def to_dict(self) -> dict:
        d = {
            "name": self.name,
            "label": self.label,
            "field_type": self.field_type,
            "required": self.required,
        }
        if self.options:
            d["options"] = self.options
        if self.placeholder:
            d["placeholder"] = self.placeholder
        return d


@dataclass
class FormTemplate:
    title: str
    form_type: Literal["multi_field", "yes_no"]
    fields: list[FormField] = field(default_factory=list)
    message: str = ""

    def to_schema(self) -> dict:
        schema: dict = {
            "title": self.title,
            "form_type": self.form_type,
            "fields": [f.to_dict() for f in self.fields],
        }
        if self.message:
            schema["message"] = self.message
        return schema


TEMPLATES: dict[str, FormTemplate] = {
    # Step 1: Identify the patient (always shown first)
    "identify_patient": FormTemplate(
        title="Let's Get Started",
        form_type="multi_field",
        message="We just need a few details to look you up.",
        fields=[
            FormField("first_name", "First Name", "text", placeholder="Jane"),
            FormField("last_name", "Last Name", "text", placeholder="Doe"),
            FormField("dob", "Date of Birth", "date"),
            FormField("gender", "Gender", "select", options=["male", "female", "other"]),
        ],
    ),
    # Step 2 (new patients only): Contact, insurance, emergency contact
    "new_patient_details": FormTemplate(
        title="Your Details",
        form_type="multi_field",
        message="Since this is your first visit, we need a bit more information.",
        fields=[
            # Contact
            FormField("phone", "Phone Number", "text", placeholder="+1 555 000 0000"),
            FormField("email", "Email Address", "text", placeholder="jane@example.com"),
            FormField("address", "Home Address", "textarea", placeholder="123 Main St, City, State"),
            # Insurance
            FormField("insurance_provider", "Insurance Provider", "text", placeholder="e.g. Blue Cross"),
            FormField("policy_id", "Policy / Member ID", "text"),
            # Emergency contact
            FormField("emergency_contact_name", "Emergency Contact Name", "text"),
            FormField(
                "emergency_contact_relationship",
                "Relationship",
                "select",
                options=["spouse", "parent", "sibling", "friend", "other"],
            ),
            FormField("emergency_contact_phone", "Emergency Contact Phone", "text"),
        ],
    ),
    # Step 3: Visit details (always shown)
    "visit_details": FormTemplate(
        title="Today's Visit",
        form_type="multi_field",
        message="Tell us what brings you in today.",
        fields=[
            FormField("chief_complaint", "Reason for Visit", "text", placeholder="e.g. chest pain, follow-up"),
            FormField("symptoms", "Describe Your Symptoms", "textarea", required=False, placeholder="When did it start? How severe is it?"),
        ],
    ),
    # Confirmation before creating the visit
    "confirm_visit": FormTemplate(
        title="Confirm Check-In",
        form_type="yes_no",
        message="Are you ready to proceed with your visit today?",
    ),
    # Legacy template — kept for backwards compatibility with existing sessions
    "patient_intake": FormTemplate(
        title="Patient Check-In",
        form_type="multi_field",
        fields=[
            FormField("first_name", "First Name", "text", placeholder="Jane"),
            FormField("last_name", "Last Name", "text", placeholder="Doe"),
            FormField("dob", "Date of Birth", "date"),
            FormField("gender", "Gender", "select", options=["male", "female", "other"]),
            FormField("phone", "Phone Number", "text", placeholder="+1 555 000 0000"),
            FormField("email", "Email Address", "text", placeholder="jane@example.com"),
            FormField("address", "Home Address", "textarea", placeholder="123 Main St, City, State"),
            FormField("chief_complaint", "Reason for Visit", "text", placeholder="e.g. chest pain, follow-up"),
            FormField("symptoms", "Symptoms (optional)", "textarea", required=False, placeholder="Describe any symptoms..."),
            FormField("insurance_provider", "Insurance Provider", "text", placeholder="e.g. Blue Cross"),
            FormField("policy_id", "Policy / Member ID", "text"),
            FormField("emergency_contact_name", "Emergency Contact Name", "text"),
            FormField(
                "emergency_contact_relationship",
                "Relationship",
                "select",
                options=["spouse", "parent", "sibling", "friend", "other"],
            ),
            FormField("emergency_contact_phone", "Emergency Contact Phone", "text"),
        ],
    ),
}
