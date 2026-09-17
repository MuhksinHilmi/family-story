"use client";

/**
 * FamilyTreeLoader
 * Komponen loading bertema "pohon keluarga tumbuh" — pengganti spinner generik.
 *
 * Props:
 *  - size?      : 'sm' | 'md' | 'lg'   (default 'md')
 *  - message?   : string                (default 'Menyusun cerita keluarga...')
 *  - fullscreen?: boolean               (default true)
 */

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Size = "sm" | "md" | "lg";

interface FamilyTreeLoaderProps {
  size?: Size;
  message?: string;
  fullscreen?: boolean;
}

// ---------------------------------------------------------------------------
// Constants — SVG geometry
// ---------------------------------------------------------------------------

/**
 * The tree is drawn as a series of path segments: trunk → two main branches →
 * one sub-branch per main branch, giving 5 branch tips in total.
 * All paths are defined for a 96×96 viewBox; the SVG is then scaled via CSS.
 *
 * Tip coordinates (where leaves appear):
 *   tipA – top of trunk continuation / "crown centre"
 *   tipB – left main branch tip
 *   tipC – right main branch tip
 *   tipD – left sub-branch tip
 *   tipE – right sub-branch tip
 *   tipF – extra sub-branch (left, lower) → gives us 6 tips → 6 leaves
 */

const TRUNK = "M48 90 L48 58";                    // trunk: bottom → mid
const BRANCH_LEFT  = "M48 65 Q30 60 18 48";       // main left branch
const BRANCH_RIGHT = "M48 65 Q66 60 78 48";       // main right branch
const BRANCH_LEFT_UP   = "M48 58 Q42 44 36 34";   // trunk continuation / crown left
const BRANCH_RIGHT_UP  = "M48 58 Q54 44 60 34";   // crown right
const BRANCH_SUB_L = "M18 48 Q12 40 10 30";       // sub-branch from left tip
const BRANCH_SUB_R = "M78 48 Q84 40 86 30";       // sub-branch from right tip

// All segments drawn in order
const SEGMENTS = [
  TRUNK,
  BRANCH_LEFT,
  BRANCH_RIGHT,
  BRANCH_LEFT_UP,
  BRANCH_RIGHT_UP,
  BRANCH_SUB_L,
  BRANCH_SUB_R,
];

// Leaf positions — [cx, cy] in viewBox units, color index (0 = green, 1 = gold)
const LEAVES: Array<{ cx: number; cy: number; colorIdx: 0 | 1 }> = [
  { cx: 36, cy: 34, colorIdx: 0 }, // crown left tip
  { cx: 60, cy: 34, colorIdx: 1 }, // crown right tip
  { cx: 18, cy: 48, colorIdx: 0 }, // left main tip
  { cx: 78, cy: 48, colorIdx: 1 }, // right main tip
  { cx: 10, cy: 30, colorIdx: 1 }, // sub-left tip
  { cx: 86, cy: 30, colorIdx: 0 }, // sub-right tip
  { cx: 48, cy: 58, colorIdx: 1 }, // junction (centre-ish)
];

const LEAF_COLORS = ["#4A7C59", "#C4922A"] as const;

// Per-size SVG dimensions (px)
const SIZE_MAP: Record<Size, number> = { sm: 64, md: 96, lg: 128 };

// ---------------------------------------------------------------------------
// Helpers — measure path length
// ---------------------------------------------------------------------------

/**
 * We need the dasharray/dashoffset values for each path segment.
 * Since this runs on the client, we create a temporary SVG, measure each path,
 * then discard it. The result is memoised so the animation never flickers.
 */
function measurePaths(paths: string[]): number[] {
  if (typeof document === "undefined") return paths.map(() => 80); // SSR fallback
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 96 96");
  svg.style.position = "absolute";
  svg.style.visibility = "hidden";
  document.body.appendChild(svg);
  const lengths = paths.map((d) => {
    const p = document.createElementNS(ns, "path");
    p.setAttribute("d", d);
    svg.appendChild(p);
    const len = p.getTotalLength();
    svg.removeChild(p);
    return len;
  });
  document.body.removeChild(svg);
  return lengths;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** A single animated path segment (trunk / branch). */
function AnimatedSegment({
  d,
  length,
  delay,
  duration,
}: {
  d: string;
  length: number;
  delay: number;
  duration: number;
}) {
  return (
    <motion.path
      d={d}
      stroke="#4A7C59"
      strokeWidth={2.5}
      strokeLinecap="round"
      fill="none"
      initial={{ strokeDashoffset: length, strokeDasharray: length }}
      animate={{ strokeDashoffset: 0 }}
      transition={{
        duration,
        delay,
        ease: "easeInOut",
      }}
    />
  );
}

/** A single leaf that scales + fades in. */
function Leaf({
  cx,
  cy,
  colorIdx,
  delay,
}: {
  cx: number;
  cy: number;
  colorIdx: 0 | 1;
  delay: number;
}) {
  return (
    <motion.circle
      cx={cx}
      cy={cy}
      r={4.5}
      fill={LEAF_COLORS[colorIdx]}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        duration: 0.35,
        delay,
        ease: [0.34, 1.56, 0.64, 1], // spring-ish
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function FamilyTreeLoader({
  size = "md",
  message = "Menyusun cerita keluarga...",
  fullscreen = true,
}: FamilyTreeLoaderProps) {
  const svgSize = SIZE_MAP[size];

  // Measure path lengths once on mount
  const [lengths, setLengths] = useState<number[] | null>(null);
  const [cycleKey, setCycleKey] = useState(0); // bumped every loop to re-trigger animation
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLengths(measurePaths(SEGMENTS));
  }, []);

  // Loop: after all leaves appear (SEGMENTS draw + LEAVES stagger), wait, then restart
  useEffect(() => {
    if (lengths === null) return;

    // Total segment draw time: each segment ~0.25s, staggered 0.1s apart
    const segDuration = 0.25;
    const segStagger = 0.1;
    const totalSegTime = (SEGMENTS.length - 1) * segStagger + segDuration;

    // Leaves stagger: starts after segments + 0.05s buffer
    const leafStart = totalSegTime + 0.05;
    const leafStagger = 0.15;
    const totalLeafTime = (LEAVES.length - 1) * leafStagger + 0.35; // 0.35 = leaf transition

    // Hold time after all leaves visible
    const holdMs = 700;

    // Fade out duration (handled by AnimatePresence exit)
    const totalMs = (leafStart + totalLeafTime) * 1000 + holdMs;

    timerRef.current = setTimeout(() => {
      setCycleKey((k) => k + 1);
    }, totalMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [lengths, cycleKey]);

  // Derived timing for segments and leaves
  const segDuration = 0.25;
  const segStagger = 0.1;
  const totalSegTime = (SEGMENTS.length - 1) * segStagger + segDuration;
  const leafStart = totalSegTime + 0.05;
  const leafStagger = 0.15;

  const tree = (
    <div
      role="status"
      aria-live="polite"
      aria-label="Memuat data..."
      className={
        fullscreen
          ? "flex flex-col items-center gap-5"
          : "flex flex-col items-center gap-3"
      }
    >
      {/* Screen-reader only text */}
      <span className="sr-only">Memuat data...</span>

      {/* SVG tree — wrapped in a card only when fullscreen */}
      <div
        className={
          fullscreen
            ? "bg-[#FDFAF5] border border-[#D4C4A8] rounded-3xl p-6 flex items-center justify-center shadow-sm"
            : ""
        }
        style={
          fullscreen
            ? { width: svgSize + 48, height: svgSize + 48 }
            : { width: svgSize, height: svgSize }
        }
      >
        <AnimatePresence mode="wait">
          <motion.svg
            key={cycleKey}
            viewBox="0 0 96 96"
            width={svgSize}
            height={svgSize}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          >
            {/* Ground line */}
            <line
              x1="32"
              y1="91"
              x2="64"
              y2="91"
              stroke="#D4C4A8"
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.6}
            />

            {/* Animated branch segments */}
            {lengths &&
              SEGMENTS.map((d, i) => (
                <AnimatedSegment
                  key={i}
                  d={d}
                  length={lengths[i]}
                  delay={i * segStagger}
                  duration={segDuration}
                />
              ))}

            {/* Animated leaves */}
            {lengths &&
              LEAVES.map((leaf, i) => (
                <Leaf
                  key={i}
                  cx={leaf.cx}
                  cy={leaf.cy}
                  colorIdx={leaf.colorIdx}
                  delay={leafStart + i * leafStagger}
                />
              ))}
          </motion.svg>
        </AnimatePresence>
      </div>

      {/* Message with fade-pulse */}
      {message && (
        <motion.p
          className="text-sm text-[#6B5B45] text-center select-none"
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {message}
        </motion.p>
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center">
        {tree}
      </div>
    );
  }

  return tree;
}
