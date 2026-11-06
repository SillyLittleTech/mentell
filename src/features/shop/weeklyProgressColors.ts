import type { FeelingDayClass } from "../compilation/feelingsSemantics";

/** Match Shoppe bar / issue palette */
export const FEELING_RGB: Record<
  Exclude<FeelingDayClass, "missed" | "no_data">,
  string
> = {
  positive: "42,155,88",
  neutral: "214,189,64",
  negative: "198,29,29",
};

export const MISSED_RGB = "22,22,22";
export const NO_DATA_RGB = "190,190,195";

export function rgbForFeelingClass(c: FeelingDayClass): string {
  switch (c) {
    case "positive":
      return FEELING_RGB.positive;
    case "neutral":
      return FEELING_RGB.neutral;
    case "negative":
      return FEELING_RGB.negative;
    case "missed":
      return MISSED_RGB;
    default:
      return NO_DATA_RGB;
  }
}
