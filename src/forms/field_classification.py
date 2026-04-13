"""PII field classification for dynamic form processing.

When the agent generates a form dynamically via show_form / ask_user_input,
the response handler uses this registry to decide which field values are safe
to return to the agent and which must be locked in the privacy vault.

Unknown fields default to PII treatment (values NOT returned to agent).
"""

# Fields that contain personally identifiable information.
# Their values are stored in the vault and NEVER returned to the agent.
PII_FIELDS: set[str] = {
    # Identity
    "first_name",
    "last_name",
    "dob",
    "gender",
    "ssn",
    # Contact
    "email",
    "address",
    # Insurance
    "insurance_provider",
    "policy_id",
    # Emergency contact
    "emergency_contact_name",
    "emergency_contact_relationship",
    "emergency_contact_phone",
}

# Fields whose values CAN be returned to the agent (non-PII / clinical).
SAFE_FIELDS: set[str] = {
    "chief_complaint",
    "symptoms",
    "preferred_language",
    "has_allergies",
    "allergy_details",
    "confirmed",
    # Vitals — numeric measurements, not PII
    "height_cm",
    "weight_kg",
}

# Subset of PII_FIELDS that triggers patient lookup/creation when ALL are present.
# Must match exactly what the identity step of the intake form collects.
PATIENT_IDENTITY_FIELDS: set[str] = {"first_name", "last_name", "dob", "gender"}
