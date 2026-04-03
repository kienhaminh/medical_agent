"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface FormFieldDef {
  name: string;
  label: string;
  /** New tool sends "type"; legacy sends "field_type". Both accepted. */
  type?: "text" | "email" | "date" | "select" | "textarea" | "number";
  field_type?: "text" | "email" | "date" | "select" | "textarea" | "number";
  required?: boolean;
  db_field?: string;
  options?: string[];
  placeholder?: string;
}

interface FieldProps {
  field: FormFieldDef;
  value: string;
  onChange: (name: string, value: string) => void;
  error?: string;
}

export function FormFieldInput({ field, value, onChange, error }: FieldProps) {
  const id = `form-field-${field.name}`;
  const fieldType = field.type ?? field.field_type ?? "text";

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-medium text-foreground/80">
        {field.label}
        {field.required && <span className="text-red-400 ml-0.5">*</span>}
      </Label>

      {fieldType === "select" ? (
        <Select value={value} onValueChange={(v) => onChange(field.name, v)}>
          <SelectTrigger id={id} className={cn("h-8 text-sm bg-background", error && "border-red-400")}>
            <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : fieldType === "textarea" ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(field.name, e.target.value)}
          placeholder={field.placeholder}
          rows={2}
          className={cn("text-sm resize-none bg-background", error && "border-red-400")}
        />
      ) : (
        <Input
          id={id}
          type={fieldType === "date" ? "date" : fieldType === "number" ? "number" : fieldType === "email" ? "email" : "text"}
          value={value}
          onChange={(e) => onChange(field.name, e.target.value)}
          placeholder={field.placeholder}
          className={cn("h-8 text-sm bg-background", error && "border-red-400")}
        />
      )}

      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  );
}
