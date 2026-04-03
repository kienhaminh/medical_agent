"use client";

import { Scan } from "lucide-react";
import type { Imaging } from "@/lib/api";

interface PatientImagingPanelProps {
  imaging?: Imaging[] | null;
}

/** Preview thumbnails for BraTS / NIfTI-linked imaging (doctor portal). */
export function PatientImagingPanel({ imaging }: PatientImagingPanelProps) {
  if (!imaging?.length) return null;

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Scan className="h-3.5 w-3.5 shrink-0" />
        Imaging
      </div>
      <div className="grid grid-cols-2 gap-2">
        {imaging.map((row) => (
          <a
            key={row.id}
            href={row.original_url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block overflow-hidden rounded-md border bg-muted/30 transition hover:border-primary/40"
            title={`Open volume: ${row.image_type}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={row.preview_url}
              alt={row.title}
              className="h-24 w-full object-contain bg-black/5"
            />
            <div className="border-t px-1.5 py-1 text-[10px] leading-tight">
              <span className="font-medium uppercase text-foreground/90">
                {row.image_type}
              </span>
              <span className="block truncate text-muted-foreground">{row.title}</span>
            </div>
          </a>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Click a tile to open the linked volume (.nii.gz) in a new tab.
      </p>
    </div>
  );
}
