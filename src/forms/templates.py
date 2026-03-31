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
        return {
            "title": self.title,
            "form_type": self.form_type,
            "message": self.message,
            "fields": [f.to_dict() for f in self.fields],
        }


TEMPLATES: dict[str, FormTemplate] = {
    "patient_intake": FormTemplate(
        title="Patient Check-In",
        form_type="multi_field",
        fields=[
            # Personal info
            FormField("first_name", "First Name", "text", placeholder="Jane"),
            FormField("last_name", "Last Name", "text", placeholder="Doe"),
            FormField("dob", "Date of Birth", "date"),
            FormField("gender", "Gender", "select", options=["male", "female", "other"]),
            # Contact
            FormField("phone", "Phone Number", "text", placeholder="+1 555 000 0000"),
            FormField("email", "Email Address", "text", placeholder="jane@example.com"),
            FormField("address", "Home Address", "textarea", placeholder="123 Main St, City, State"),
            # Visit
            FormField("chief_complaint", "Reason for Visit", "text", placeholder="e.g. chest pain, follow-up"),
            FormField("symptoms", "Symptoms (optional)", "textarea", required=False, placeholder="Describe any symptoms..."),
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
    "confirm_visit": FormTemplate(
        title="Confirm Check-In",
        form_type="yes_no",
        message="Are you ready to proceed with your visit today?",
    ),
}
