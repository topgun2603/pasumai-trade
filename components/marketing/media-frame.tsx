"use client";

import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * A photograph slot on the public site.
 *
 * The subtle scale on entrance is the one place a slightly larger movement is
 * warranted: a photograph settling into its frame reads as intentional, where
 * the same on a paragraph would read as fussy.
 *
 * `unoptimized` is only set for the illustrated stand-ins, which are SVGs the
 * Next optimizer refuses without `dangerouslyAllowSVG`. Real photographs go
 * through the optimizer and get resizing and modern formats — which is most
 * of the reason to use real photographs rather than to inline them.
 */
export function MediaFrame({
  src,
  alt,
  aspect,
  isPhotograph,
  priority = false,
  sizes,
  className,
}: {
  src: string;
  alt: string;
  aspect: string;
  isPhotograph: boolean;
  priority?: boolean;
  sizes: string;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={cn(
        "bg-secondary relative overflow-hidden rounded-2xl border",
        className,
      )}
      style={{ aspectRatio: aspect }}
      initial={reduced ? undefined : { opacity: 0, scale: 0.97 }}
      whileInView={reduced ? undefined : { opacity: 1, scale: 1 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        unoptimized={!isPhotograph}
        sizes={sizes}
        className="object-cover"
      />
    </motion.div>
  );
}
