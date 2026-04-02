"use client";

import { useMemo, useState } from "react";
import { Loader2, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormFieldInput, type FormFieldDef } from "./form-fields";
import { cn } from "@/lib/utils";

export interface ActiveForm {
  id: string;
  template: string;
  schema: {
    title: string;
    form_type: "multi_field" | "yes_no" | "question";
    message?: string;
    // Dynamic forms provide sections directly from the backend.
    sections?: Array<{ label: string; fields: FormFieldDef[] }>;
    // Question form type
    choices?: string[];
    allow_multiple?: boolean;
  };
}

interface FormInputBarProps {
  activeForm: ActiveForm;
  sessionId: number;
  onSubmitted: (answers?: Record<string, string>) => void;
}

interface Section {
  label: string;
  fields: FormFieldDef[];
}

/** Build sections from backend-provided schema. */
function buildSections(schema: ActiveForm["schema"]): Section[] {
  if (!schema.sections || schema.sections.length === 0) return [];
  return schema.sections.map((s) => ({
    label: s.label,
    fields: s.fields.map((f) => ({
      ...f,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      field_type: f.field_type || (f as any).type || "text",
    })),
  }));
}

/** Flatten all fields from all sections into a single array. */
function flattenFields(schema: ActiveForm["schema"]): FormFieldDef[] {
  if (!schema.sections || schema.sections.length === 0) return [];
  return schema.sections.flatMap((s) =>
    s.fields.map((f) => ({
      ...f,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      field_type: f.field_type || (f as any).type || "text",
    }))
  );
}

export function FormInputBar({ activeForm, sessionId, onSubmitted }: FormInputBarProps) {
  const { schema } = activeForm;

  const allFields = useMemo(() => flattenFields(schema), [schema]);

  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(allFields.map((f) => [f.name, ""]))
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  const [selectedChoices, setSelectedChoices] = useState<Set<string>>(new Set());

  const sections = useMemo(() => buildSections(schema), [schema]);
  const currentSection = sections[step];
  const isLastStep = step === sections.length - 1;

  const handleChange = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateStep = (): boolean => {
    if (!currentSection) return true;
    const newErrors: Record<string, string> = {};
    for (const field of currentSection.fields) {
      if (field.required && !values[field.name]?.trim()) {
        newErrors[field.name] = "Required";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setStep((s) => Math.min(s + 1, sections.length - 1));
  };

  const handleBack = () => setStep((s) => Math.max(s - 1, 0));

  const submitForm = async (answers: Record<string, string>) => {
    setSubmitting(true);
    try {
      const resp = await fetch(`/api/chat/${sessionId}/form-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form_id: activeForm.id, answers, template: activeForm.template }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      onSubmitted(answers);
    } catch (err) {
      console.error("Form submission failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // --- Question form (single/multiple choice) ---
  if (schema.form_type === "question") {
    const choices = schema.choices ?? [];
    const allowMultiple = schema.allow_multiple ?? false;

    const handleChoiceClick = (choice: string) => {
      if (allowMultiple) {
        setSelectedChoices((prev) => {
          const next = new Set(prev);
          if (next.has(choice)) next.delete(choice);
          else next.add(choice);
          return next;
        });
      } else {
        // Single choice — submit immediately.
        submitForm({ choice });
      }
    };

    const handleMultiSubmit = () => {
      if (selectedChoices.size === 0) return;
      submitForm({ choices: Array.from(selectedChoices).join(", ") });
    };

    return (
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
        {schema.message && (
          <p className="text-sm text-foreground/80">{schema.message}</p>
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
                {allowMultiple && isSelected && (
                  <Check className="w-3 h-3 mr-1" />
                )}
                {submitting && !allowMultiple ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  choice
                )}
              </Button>
            );
          })}
        </div>
        {allowMultiple && (
          <Button
            onClick={handleMultiSubmit}
            disabled={submitting || selectedChoices.size === 0}
            size="sm"
            className="bg-gradient-to-r from-primary to-primary hover:from-primary hover:to-primary text-white h-8 text-xs"
          >
            {submitting ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Submitting...</>
            ) : (
              `Submit (${selectedChoices.size} selected)`
            )}
          </Button>
        )}
      </div>
    );
  }

  // --- Legacy yes/no form ---
  if (schema.form_type === "yes_no") {
    return (
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-3">
          <p className="text-sm text-foreground/80 flex-1">{schema.message}</p>
          <Button
            onClick={() => submitForm({ confirmed: "true" })}
            disabled={submitting}
            size="sm"
            className="bg-gradient-to-r from-primary to-primary hover:from-primary hover:to-primary text-white h-8 px-3"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              "Confirm"
            )}
          </Button>
          <Button
            onClick={() => submitForm({ confirmed: "false" })}
            disabled={submitting}
            variant="outline"
            size="sm"
            className="h-8 px-3 border-border/50"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // --- Multi-step inline form card ---
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
      {/* Form title */}
      {schema.title && (
        <h3 className="text-sm font-semibold text-primary">{schema.title}</h3>
      )}

      {/* Progress + section label */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 flex-1">
          {sections.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i < step
                  ? "bg-primary"
                  : i === step
                    ? "bg-primary/60"
                    : "bg-border/40"
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-primary font-semibold tracking-wider uppercase whitespace-nowrap">
          {currentSection?.label || schema.title}
        </span>
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          {step + 1}/{sections.length}
        </span>
      </div>

      {/* Fields — compact grid */}
      {currentSection && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {currentSection.fields.map((field) => (
            <div
              key={field.name}
              className={
                field.field_type === "textarea"
                  ? "col-span-2"
                  : "col-span-1"
              }
            >
              <FormFieldInput
                field={field}
                value={values[field.name] ?? ""}
                onChange={handleChange}
                error={errors[field.name]}
              />
            </div>
          ))}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-2">
        {step > 0 && (
          <Button
            onClick={handleBack}
            variant="outline"
            size="sm"
            className="h-8 px-3 border-border/50"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Back
          </Button>
        )}

        {isLastStep ? (
          <Button
            onClick={() => {
              if (!validateStep()) return;
              submitForm(values);
            }}
            disabled={submitting}
            size="sm"
            className="flex-1 bg-gradient-to-r from-primary to-primary hover:from-primary hover:to-primary text-white h-8 text-xs"
          >
            {submitting ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Submitting...</>
            ) : (
              "Submit"
            )}
          </Button>
        ) : (
          <Button
            onClick={handleNext}
            size="sm"
            className="flex-1 bg-gradient-to-r from-primary to-primary hover:from-primary hover:to-primary text-white h-8 text-xs"
          >
            Next
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
