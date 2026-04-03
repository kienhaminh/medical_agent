"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormFieldInput, type FormFieldDef } from "./form-fields";
import { cn } from "@/lib/utils";

export interface ActiveForm {
  id: string;
  form_type: "fields" | "question";
  // Present when form_type === "fields"
  title?: string;
  message?: string;
  fields?: FormFieldDef[];
  // Present when form_type === "question"
  question?: string;
  choices?: string[];
  allow_multiple?: boolean;
}

interface FormInputBarProps {
  activeForm: ActiveForm;
  sessionId: number;
  onSubmitted: (answers?: Record<string, string>) => void;
}

export function FormInputBar({ activeForm, sessionId, onSubmitted }: FormInputBarProps) {
  const fields = activeForm.fields ?? [];
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.name, ""]))
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [selectedChoices, setSelectedChoices] = useState<Set<string>>(new Set());

  const handleChange = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    for (const field of fields) {
      if (field.required && !values[field.name]?.trim()) {
        newErrors[field.name] = "Required";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submitForm = async (answers: Record<string, string>) => {
    setSubmitting(true);
    try {
      // Build db_field mappings so the backend can save PII privately.
      const field_mappings: Record<string, string> = {};
      for (const field of fields) {
        if (field.db_field) field_mappings[field.name] = field.db_field;
      }

      const resp = await fetch(`/api/chat/${sessionId}/form-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_id: activeForm.id,
          answers,
          field_mappings: Object.keys(field_mappings).length > 0 ? field_mappings : undefined,
        }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      onSubmitted(answers);
    } catch (err) {
      console.error("Form submission failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // --- Choice question ---
  if (activeForm.form_type === "question") {
    const choices = activeForm.choices ?? [];
    const allowMultiple = activeForm.allow_multiple ?? false;

    const handleChoiceClick = (choice: string) => {
      if (allowMultiple) {
        setSelectedChoices((prev) => {
          const next = new Set(prev);
          if (next.has(choice)) next.delete(choice);
          else next.add(choice);
          return next;
        });
      } else {
        submitForm({ choice });
      }
    };

    return (
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
        {activeForm.question && (
          <p className="text-sm text-foreground/80">{activeForm.question}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {choices.map((choice) => {
            const isSelected = selectedChoices.has(choice);
            return (
              <Button
                key={choice}
                onClick={() => handleChoiceClick(choice)}
                disabled={submitting}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-8 px-3 text-xs transition-all",
                  isSelected
                    ? "bg-gradient-to-r from-primary to-primary text-white border-transparent"
                    : "border-border/50 hover:border-primary/40"
                )}
              >
                {allowMultiple && isSelected && <Check className="w-3 h-3 mr-1" />}
                {submitting && !allowMultiple
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : choice}
              </Button>
            );
          })}
        </div>
        {allowMultiple && (
          <Button
            onClick={() => submitForm({ choices: Array.from(selectedChoices).join(", ") })}
            disabled={submitting || selectedChoices.size === 0}
            size="sm"
            className="bg-gradient-to-r from-primary to-primary hover:from-primary hover:to-primary text-white h-8 text-xs"
          >
            {submitting
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Submitting...</>
              : `Submit (${selectedChoices.size} selected)`}
          </Button>
        )}
      </div>
    );
  }

  // --- Dynamic field form ---
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
      {(activeForm.title || activeForm.message) && (
        <div>
          {activeForm.title && (
            <h3 className="text-sm font-semibold text-primary">{activeForm.title}</h3>
          )}
          {activeForm.message && (
            <p className="text-xs text-muted-foreground mt-0.5">{activeForm.message}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {fields.map((field) => {
          const fieldType = field.type ?? field.field_type ?? "text";
          return (
            <div
              key={field.name}
              className={fieldType === "textarea" ? "col-span-2" : "col-span-1"}
            >
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

      <Button
        onClick={() => { if (validate()) submitForm(values); }}
        disabled={submitting}
        size="sm"
        className="w-full bg-gradient-to-r from-primary to-primary hover:from-primary hover:to-primary text-white h-9 text-xs"
      >
        {submitting
          ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Submitting...</>
          : "Submit"}
      </Button>
    </div>
  );
}
