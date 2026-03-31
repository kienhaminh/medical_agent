"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FormFieldInput, type FormFieldDef } from "./form-fields";

export interface ActiveForm {
  id: string;
  template: string;
  schema: {
    title: string;
    form_type: "multi_field" | "yes_no";
    message: string;
    fields: FormFieldDef[];
  };
}

interface FormInputBarProps {
  activeForm: ActiveForm;
  sessionId: number;
  onSubmitted: () => void;
}

const SECTION_LABELS: Record<string, string> = {
  first_name: "Personal Info",
  phone: "Contact",
  chief_complaint: "Visit",
  insurance_provider: "Insurance",
  emergency_contact_name: "Emergency Contact",
};

function getSectionLabel(fieldName: string): string | undefined {
  return SECTION_LABELS[fieldName];
}

export function FormInputBar({ activeForm, sessionId, onSubmitted }: FormInputBarProps) {
  const { schema } = activeForm;

  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(schema.fields.map((f) => [f.name, ""]))
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    for (const field of schema.fields) {
      if (field.required && !values[field.name]?.trim()) {
        newErrors[field.name] = "Required";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submit = async (confirmed?: boolean) => {
    if (schema.form_type === "multi_field" && !validate()) return;

    setSubmitting(true);
    const answers =
      schema.form_type === "yes_no"
        ? { confirmed: String(confirmed ?? false) }
        : values;

    try {
      const resp = await fetch(`/api/chat/${sessionId}/form-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form_id: activeForm.id, answers }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      onSubmitted();
    } catch (err) {
      console.error("Form submission failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (schema.form_type === "yes_no") {
    return (
      <div className="border-t border-border/50 bg-card/40 backdrop-blur-sm px-4 py-4">
        <p className="text-sm text-foreground/80 mb-3">{schema.message}</p>
        <div className="flex gap-2">
          <Button
            onClick={() => submit(true)}
            disabled={submitting}
            className="flex-1 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white h-9"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <><CheckCircle2 className="w-4 h-4 mr-1.5" />Confirm</>
            )}
          </Button>
          <Button
            onClick={() => submit(false)}
            disabled={submitting}
            variant="outline"
            className="flex-1 h-9 border-border/50"
          >
            <XCircle className="w-4 h-4 mr-1.5" />Cancel
          </Button>
        </div>
      </div>
    );
  }

  // multi_field form
  return (
    <div className="border-t border-border/50 bg-card/40 backdrop-blur-sm">
      <div className="px-4 pt-3 pb-1">
        <h3 className="text-xs font-semibold text-cyan-400 tracking-wider uppercase">
          {schema.title}
        </h3>
      </div>

      <ScrollArea className="max-h-72 px-4 pb-2">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 pb-1">
          {schema.fields.map((field) => {
            const sectionLabel = getSectionLabel(field.name);
            return (
              <div
                key={field.name}
                className={
                  field.field_type === "textarea" ||
                  field.name === "address" ||
                  field.name === "chief_complaint"
                    ? "col-span-2"
                    : "col-span-1"
                }
              >
                {sectionLabel && (
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1.5 mt-1 font-medium">
                    {sectionLabel}
                  </p>
                )}
                <FormFieldInput
                  field={field}
                  value={values[field.name] ?? ""}
                  onChange={handleChange}
                  error={errors[field.name]}
                />
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="px-4 py-3 border-t border-border/40">
        <Button
          onClick={() => submit()}
          disabled={submitting}
          className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white h-9 text-sm"
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" />Submitting...</>
          ) : (
            "Submit Check-In"
          )}
        </Button>
      </div>
    </div>
  );
}
