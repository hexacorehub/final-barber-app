"use client";

import { useState } from "react";
import { Placeholder, cn } from "./ui";

/** Remote photo with a neutral placeholder while missing or if it fails to load. */
/** `priority` for the main image above the fold (loads first instead of lazily). */
export function Photo({ src, alt, className, fallback = "Foto", priority }: { src: string | null | undefined; alt: string; className?: string; fallback?: string; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return fallback ? <Placeholder label={fallback} className={className} /> : <div aria-hidden="true" className={cn("bg-chip", className)} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async" onError={() => setFailed(true)} className={cn("bg-chip object-cover", className)} />
  );
}
