import type { FeelingDayClass } from "../compilation/feelingsSemantics";

/**
 * Pastel palette for weekly bar (bar fill / legend).
 * Borders are slightly more saturated for label contrast.
 */

const PASTEL_SEGMENT: Record<FeelingDayClass, string> = {
  positive: "168, 232, 201",
  neutral: "246, 236, 160",
  negative: "255, 196, 196",
  missed: "52, 52, 56",
  no_data: "222, 224, 232",
};

const PASTEL_FILL: Record<FeelingDayClass, string> = {
  positive: "235, 252, 243",
  neutral: "255, 252, 225",
  negative: "255, 238, 238",
  missed: "240, 240, 242",
  no_data: "248, 249, 252",
};

const PASTEL_BORDER: Record<FeelingDayClass, string> = {
  positive: "74, 168, 120",
  neutral: "198, 175, 80",
  negative: "198, 90, 90",
  missed: "24, 24, 28",
  no_data: "120, 122, 132",
};

/** Bar segment RGB triplet (comma-separated) for feeling class `c`. */
export function pastelSegmentRgb(c: FeelingDayClass): string {
  return PASTEL_SEGMENT[c];
}

/** Lighter RGB triplet for day-letter fill. */
export function pastelFillRgb(c: FeelingDayClass): string {
  return PASTEL_FILL[c];
}

/** Slightly deeper RGB triplet for day-letter stroke. */
export function pastelBorderRgb(c: FeelingDayClass): string {
  return PASTEL_BORDER[c];
}

/** @deprecated use pastelSegmentRgb */
export function rgbForFeelingClass(c: FeelingDayClass): string {
  return pastelSegmentRgb(c);
}

/** Same family as weekly bar — for projector chart dots/lines */
export function chartRgbForClass(c: FeelingDayClass): string {
  return `rgb(${pastelSegmentRgb(c)})`;
}

/** Tailwind arbitrary background class for legend swatches. */
export function swatchClassForClass(c: FeelingDayClass): string {
  switch (c) {
    case "positive":
      return "bg-[rgb(168,232,201)]";
    case "neutral":
      return "bg-[rgb(246,236,160)]";
    case "negative":
      return "bg-[rgb(255,196,196)]";
    case "missed":
      return "bg-[rgb(52,52,56)]";
    default:
      return "bg-[rgb(222,224,232)]";
  }
}
