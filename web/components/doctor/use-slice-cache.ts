"use client";

/**
 * Prefetch and cache MRI slice JPEGs as blob URLs so the viewer is instant after initial load.
 *
 * Usage:
 *   const { resolve, progress } = useSliceCache(slicePattern, volumeDepth, selectedImagingId, initialZ);
 *   const src = resolve(sliceZ);  // blob URL if cached, Supabase URL otherwise
 *
 * Fetch order — prioritised so visible slices are ready first:
 *   1. initialZ ± PRIORITY_WINDOW (the slices the user will see immediately)
 *   2. The rest of the volume in outward-expanding order from the centre
 *
 * All cached blob URLs live in a module-level Map for the tab lifetime — already-fetched
 * slices are never re-fetched, even after modality switches.
 */

import { useEffect, useRef, useState } from "react";

// Module-level cache: Supabase URL → blob URL
const BLOB_CACHE = new Map<string, string>();

// Slices immediately around the open position (fetched before the rest of the volume)
const PRIORITY_WINDOW = 15;
// Max concurrent requests — stays well under browser limit; HTTP/2 multiplexes fine at this count
const BATCH = 6;

export interface SliceCacheProgress {
  loaded: number;
  total: number;
}

export function useSliceCache(
  slicePattern: { mri: string; mask?: string } | null,
  volumeDepth: number,
  selectedImagingId: number | null,
  initialZ: number = 0,
) {
  const [progress, setProgress] = useState<SliceCacheProgress | null>(null);
  const fetchedKey = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!slicePattern || volumeDepth < 1 || selectedImagingId == null) return;

    const key = `${selectedImagingId}|${slicePattern.mri}`;
    if (fetchedKey.current === key) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    fetchedKey.current = key;

    const alreadyCached = Array.from({ length: volumeDepth }, (_, z) =>
      BLOB_CACHE.has(slicePattern.mri.replace("{z}", String(z)))
    ).filter(Boolean).length;

    if (alreadyCached === volumeDepth) {
      setProgress({ loaded: volumeDepth, total: volumeDepth });
      return;
    }

    let loaded = alreadyCached;
    setProgress({ loaded, total: volumeDepth });

    // Build fetch order: priority window first, then rest outward from centre
    const clamp = (v: number) => Math.max(0, Math.min(volumeDepth - 1, v));
    const prioritySet = new Set<number>();
    for (let d = 0; d <= PRIORITY_WINDOW; d++) {
      prioritySet.add(clamp(initialZ - d));
      prioritySet.add(clamp(initialZ + d));
    }

    // Remaining indices expanding outward from the volume midpoint
    const mid = Math.floor(volumeDepth / 2);
    const rest: number[] = [];
    for (let d = 0; d < volumeDepth; d++) {
      const a = clamp(mid - d), b = clamp(mid + d);
      if (!prioritySet.has(a)) rest.push(a);
      if (b !== a && !prioritySet.has(b)) rest.push(b);
    }

    const fetchOrder = [...Array.from(prioritySet), ...rest];

    async function fetchOne(z: number) {
      const url = slicePattern!.mri.replace("{z}", String(z));
      if (BLOB_CACHE.has(url)) {
        loaded++;
        setProgress({ loaded, total: volumeDepth });
        return;
      }
      try {
        const resp = await fetch(url, { signal: controller.signal });
        if (!resp.ok) return;
        const blob = await resp.blob();
        BLOB_CACHE.set(url, URL.createObjectURL(blob));
        loaded++;
        setProgress({ loaded, total: volumeDepth });
      } catch {
        // Silence AbortError on modality switch or unmount
      }
    }

    (async () => {
      for (let i = 0; i < fetchOrder.length; i += BATCH) {
        if (controller.signal.aborted) break;
        await Promise.all(fetchOrder.slice(i, i + BATCH).map(fetchOne));
      }
    })();

    return () => { controller.abort(); };
  }, [slicePattern, volumeDepth, selectedImagingId, initialZ]);

  function resolve(z: number): string | null {
    if (!slicePattern) return null;
    const url = slicePattern.mri.replace("{z}", String(z));
    return BLOB_CACHE.get(url) ?? url;
  }

  return { resolve, progress };
}
