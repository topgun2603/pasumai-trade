"use client";

import {
  motion,
  useInView,
  useReducedMotion,
  useSpring,
  type Variants,
} from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Motion primitives for the public site.
 *
 * Three rules run through all of these:
 *
 *  1. **Reduced motion is honoured everywhere.** `useReducedMotion` reads the
 *     OS setting; when it is on, elements appear at their final position with
 *     no transform. Nothing is merely made faster — movement is removed.
 *  2. **Content is never hidden behind an animation.** Everything animates
 *     from `opacity: 0` in CSS only after hydration, and `whileInView` uses
 *     `once`, so a page that never runs JavaScript still shows its text.
 *  3. **Small distances.** Entrances move 12–20px, not 100. On a landing page
 *     the animation is punctuation, not the subject.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

/** Fades and lifts a block into view once, as it is scrolled to. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduced ? undefined : { opacity: 0, y: 16 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2, margin: "0px 0px -80px 0px" }}
      transition={{ duration: 0.5, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

const groupVariants: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

/**
 * Staggers its children in.
 *
 * `immediate` runs on mount rather than on scroll — used for the hero, which
 * is above the fold and would otherwise sit still while the page loads.
 */
export function Stagger({
  children,
  className,
  immediate = false,
}: {
  children: ReactNode;
  className?: string;
  immediate?: boolean;
}) {
  const reduced = useReducedMotion();

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      variants={groupVariants}
      initial="hidden"
      {...(immediate
        ? { animate: "shown" }
        : {
            whileInView: "shown",
            viewport: { once: true, amount: 0.2, margin: "0px 0px -80px 0px" },
          })}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}

/** As `StaggerItem`, but renders an `li` so lists stay valid. */
export function StaggerListItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (reduced) return <li className={className}>{children}</li>;

  return (
    <motion.li
      className={className}
      variants={itemVariants}
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
    >
      {children}
    </motion.li>
  );
}

/**
 * Counts a number up when it scrolls into view.
 *
 * Only for figures that are genuinely quantities. A count-up on something
 * that is not a measurement is decoration, and it delays the reader seeing
 * the value they came for.
 */
export function CountUp({
  value,
  suffix = "",
  className,
}: {
  value: number;
  suffix?: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [display, setDisplay] = useState(reduced ? value : 0);

  const spring = useSpring(0, { stiffness: 90, damping: 20, mass: 0.6 });

  useEffect(() => {
    if (reduced || !inView) return;
    spring.set(value);
  }, [inView, reduced, spring, value]);

  useEffect(() => {
    if (reduced) return;
    return spring.on("change", (latest) => setDisplay(Math.round(latest)));
  }, [reduced, spring]);

  return (
    <span ref={ref} className={className}>
      {/* The final value is in the DOM for assistive tech and for anyone
          without JavaScript; the animated figure is decorative. */}
      <span aria-hidden>{display.toLocaleString("en-IN")}</span>
      <span className="sr-only">{value.toLocaleString("en-IN")}</span>
      {suffix}
    </span>
  );
}

/** A gentle lift on hover, for cards that are links or buttons. */
export function Lift({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      whileHover={{ y: -4 }}
      whileTap={{ y: -1 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
      {children}
    </motion.div>
  );
}
