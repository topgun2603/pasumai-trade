import type { LucideIcon } from "lucide-react";
import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * The photograph on an entity record.
 *
 * Falls back to initials rather than a stock portrait when no photo has been
 * uploaded. Records here describe real people, and inventing a face for one is
 * worse than showing none — initials also make an unphotographed record
 * visibly incomplete, which is what operations needs to see.
 *
 * `unoptimized` is set because the seeded placeholders are SVGs, which the
 * Next image optimizer refuses unless `dangerouslyAllowSVG` is enabled. Real
 * photographs coming from Cloud Storage should drop it and configure
 * `images.remotePatterns` instead.
 */

/**
 * A stable tint per record, so the same farmer keeps the same colour across
 * every screen. Six hues chosen to sit with the platform's green rather than
 * fight it, and to hold contrast against white initials in both themes.
 */
const TINTS = [
  "bg-[#1c5b3e]",
  "bg-[#2f6f8f]",
  "bg-[#7a5410]",
  "bg-[#8c3324]",
  "bg-[#4a7c5c]",
  "bg-[#5c4a7c]",
];

function tintFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return TINTS[hash % TINTS.length];
}

/** `R. Murugan` → `RM`, `Kongu Agri Traders` → `KA`. */
function initialsOf(name: string): string {
  const parts = name
    .replace(/[^\p{L}\p{N}\s.]/gu, " ")
    .split(/[\s.]+/)
    .filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const SIZES = {
  sm: "size-8 text-xs rounded-md",
  md: "size-12 text-sm rounded-lg",
  lg: "size-16 text-base rounded-lg",
} as const;

export function EntityPhoto({
  name,
  seed,
  photoUrl,
  size = "md",
  icon: Icon,
  className,
}: {
  name: string;
  /** Keeps the tint stable when two records share a name. */
  seed: string;
  photoUrl?: string;
  size?: keyof typeof SIZES;
  /** Shown instead of initials where a name has none — a vehicle. */
  icon?: LucideIcon;
  className?: string;
}) {
  if (photoUrl) {
    return (
      <span
        className={cn(
          "bg-secondary relative shrink-0 overflow-hidden",
          SIZES[size],
          className,
        )}
      >
        <Image
          src={photoUrl}
          alt={`Photograph of ${name}`}
          fill
          unoptimized
          sizes="64px"
          className="object-cover"
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      title={`No photo on file for ${name}`}
      className={cn(
        "flex shrink-0 items-center justify-center font-semibold text-white",
        tintFor(seed),
        SIZES[size],
        className,
      )}
    >
      {Icon ? <Icon className="size-5" /> : initialsOf(name)}
    </span>
  );
}

/** Marks a record that has no photograph, so the gap is visible not silent. */
export function MissingPhotoNote({ photoUrl }: { photoUrl?: string }) {
  if (photoUrl) return null;
  return <span className="text-faint text-xs">No photo on file</span>;
}
