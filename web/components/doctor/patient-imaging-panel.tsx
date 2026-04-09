"use client";

import { Scan } from "lucide-react";
import type { Imaging } from "@/lib/api";

const CLASS_LABELS: Record<number, string> = {
  1: "TC",  // necrotic core
  2: "ED",  // oedema
  3: "ET",  // enhancing tumour
};

interface PatientImagingPanelProps {
  imaging?: Imaging[] | null;
}

/** Preview thumbnails for MRI-linked imaging (doctor portal). */
export function PatientImagingPanel({ imaging }: PatientImagingPanelProps) {
  if (!imaging?.length) return null;

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Scan className="h-3.5 w-3.5 shrink-0" />
        Imaging
      </div>
      <div className="grid grid-cols-2 gap-2">
        {imaging.map((row) => {
          const seg = row.segmentation_result?.status === "success"
            ? row.segmentation_result
            : null;
          const overlayUrl = seg?.artifacts?.overlay_image?.url;
          const tumourClasses = (seg?.prediction?.pred_classes_in_slice ?? []).filter((c) => c > 0);

          return (
            <div
              key={row.id}
              className="overflow-hidden rounded-md border bg-muted/30"
            >
              <a
                href={row.original_url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block transition hover:border-primary/40"
                title={`Open volume: ${row.image_type}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={row.preview_url}
                  alt={row.title}
                  className="h-24 w-full object-contain bg-black/5"
                />
              </a>

              {overlayUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={overlayUrl}
                  alt="Segmentation overlay"
                  className="h-24 w-full object-contain bg-black/80"
                />
              )}

              <div className="border-t px-1.5 py-1 text-[10px] leading-tight">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-medium uppercase text-foreground/90">
                    {row.image_type}
                  </span>
                  {tumourClasses.length > 0 && (
                    <div className="flex gap-0.5">
                      {tumourClasses.map((c) => (
                        <span
                          key={c}
                          className="rounded bg-destructive/15 px-1 py-0.5 text-[9px] font-semibold text-destructive"
                        >
                          {CLASS_LABELS[c] ?? `L${c}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="block truncate text-muted-foreground">{row.title}</span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Click a tile to open the linked volume (.nii.gz) in a new tab.
      </p>
    </div>
  );
}
