"use client";

/**
 * Prefetch and cache MRI slice JPEGs and mask PNGs as blob URLs so the viewer
 * is instant after initial load.
 *
 * Two-layer prefetch strategy for low-latency navigation:
 *
 *  1. BACKGROUND FILL — runs once on open, fills the entire volume in order:
 *       priority window (±PRIORITY_WINDOW around initialZ) → rest outward from centre
 *
 *  2. REACTIVE WINDOW — runs every time currentZ changes, immediately fires
 *       fetches for ±REACTIVE_WINDOW slices around the current position.
 *       This ensures the slices the user is looking at right now are always
 *       warming, independent of where the background fill is up to.
 *
 * Both layers share the same module-level BLOB_CACHE keyed by URL, so a slice
 * fetched by either layer is never re-fetched.
 */

import { useEffect, useRef, useState } from "react";

// Module-level cache: Supabase URL → blob URL
const BLOB_CACHE = new Map<string, string>();

const PRIORITY_WINDOW = 20;   // slices either side of initialZ fetched first
const REACTIVE_WINDOW = 10;   // slices either side of currentZ warmed on navigation
const BATCH = 12;             // concurrent requests for background fill (HTTP/2 friendly)

export interface SliceCacheProgress {
  loaded: number;
  total: number;
}

/** Fetch a single URL into BLOB_CACHE; no-op if already cached or request aborted. */
async function fetchToCache(url: string, signal: AbortSignal): Promise<void> {
  if (BLOB_CACHE.has(url)) return;
  try {
    const resp = await fetch(url, { signal });
    if (!resp.ok) return;
    const blob = await resp.blob();
    BLOB_CACHE.set(url, URL.createObjectURL(blob));
  } catch {
    // Silence AbortError on unmount / pattern change
  }
}

export function useSliceCache(
  mriPattern: string | null,
  maskPattern: string | null,
  volumeDepth: number,
  selectedImagingId: number | null,
  initialZ: number = 0,
  currentZ: number = 0,
) {
  const [progress, setProgress] = useState<SliceCacheProgress | null>(null);
  const fillKeyRef  = useRef<string | null>(null);
  const fillAbortRef = useRef<AbortController | null>(null);
  const reactiveAbortRef = useRef<AbortController | null>(null);

  // ── Layer 1: Background fill ──────────────────────────────────────────────
  useEffect(() => {
    if (!mriPattern || volumeDepth < 1 || selectedImagingId == null) return;

    const key = `${selectedImagingId}|${mriPattern}|${maskPattern ?? ""}`;
    if (fillKeyRef.current === key) return;

    fillAbortRef.current?.abort();
    const controller = new AbortController();
    fillAbortRef.current = controller;
    fillKeyRef.current = key;

    const alreadyCached = Array.from({ length: volumeDepth }, (_, z) =>
      BLOB_CACHE.has(mriPattern.replace("{z}", String(z)))
    ).filter(Boolean).length;

    if (alreadyCached === volumeDepth) {
      setProgress({ loaded: volumeDepth, total: volumeDepth });
      return;
    }

    let loaded = alreadyCached;
    setProgress({ loaded, total: volumeDepth });

    const clamp = (v: number) => Math.max(0, Math.min(volumeDepth - 1, v));

    // Priority window around the opening slice
    const prioritySet = new Set<number>();
    for (let d = 0; d <= PRIORITY_WINDOW; d++) {
      prioritySet.add(clamp(initialZ - d));
      prioritySet.add(clamp(initialZ + d));
    }

    // Remaining indices expanding outward from volume midpoint
    const mid = Math.floor(volumeDepth / 2);
    const rest: number[] = [];
    for (let d = 0; d < volumeDepth; d++) {
      const a = clamp(mid - d), b = clamp(mid + d);
      if (!prioritySet.has(a)) rest.push(a);
      if (b !== a && !prioritySet.has(b)) rest.push(b);
    }

    const fetchOrder = [...Array.from(prioritySet), ...rest];

    async function fetchSlice(z: number): Promise<void> {
      const mriUrl = mriPattern!.replace("{z}", String(z));
      const wasCached = BLOB_CACHE.has(mriUrl);
      const fetches: Promise<void>[] = [fetchToCache(mriUrl, controller.signal)];
      if (maskPattern) fetches.push(fetchToCache(maskPattern.replace("{z}", String(z)), controller.signal));
      await Promise.all(fetches);
      if (!wasCached && BLOB_CACHE.has(mriUrl)) {
        loaded++;
        setProgress({ loaded, total: volumeDepth });
      }
    }

    (async () => {
      for (let i = 0; i < fetchOrder.length; i += BATCH) {
        if (controller.signal.aborted) break;
        await Promise.all(fetchOrder.slice(i, i + BATCH).map(fetchSlice));
      }
    })();

    return () => { controller.abort(); };
  }, [mriPattern, maskPattern, volumeDepth, selectedImagingId, initialZ]);

  // ── Layer 2: Reactive window — warms slices around current position ───────
  useEffect(() => {
    if (!mriPattern || volumeDepth < 1) return;

    reactiveAbortRef.current?.abort();
    const controller = new AbortController();
    reactiveAbortRef.current = controller;

    const clamp = (v: number) => Math.max(0, Math.min(volumeDepth - 1, v));
    const urgent = new Set<number>();
    for (let d = 0; d <= REACTIVE_WINDOW; d++) {
      urgent.add(clamp(currentZ - d));
      urgent.add(clamp(currentZ + d));
    }

    // Fire all urgent fetches immediately — no batching, let HTTP/2 multiplex
    urgent.forEach((z) => {
      fetchToCache(mriPattern.replace("{z}", String(z)), controller.signal);
      if (maskPattern) fetchToCache(maskPattern.replace("{z}", String(z)), controller.signal);
    });

    return () => { controller.abort(); };
  }, [currentZ, mriPattern, maskPattern, volumeDepth]);

  function resolve(z: number): string | null {
    if (!mriPattern) return null;
    const url = mriPattern.replace("{z}", String(z));
    return BLOB_CACHE.get(url) ?? url;
  }

  function resolveMask(z: number): string | null {
    if (!maskPattern) return null;
    const url = maskPattern.replace("{z}", String(z));
    return BLOB_CACHE.get(url) ?? url;
  }

  return { resolve, resolveMask, progress };
}
