/** Digit liquid height — only level 0 reads empty. */
export function hbcmFillRatio(display: number): number {
  switch (display) {
    case 5:
      return 0.96;
    case 4:
      return 0.76;
    case 3:
      return 0.56;
    case 2:
      return 0.38;
    case 1:
      return 0.22;
    default:
      return 0;
  }
}

/** Tile wash sits higher than digit fill so the wave reads across the chip. */
export function hbcmTileFillRatio(display: number): number {
  switch (display) {
    case 5:
      return 1;
    case 4:
      return 0.88;
    case 3:
      return 0.72;
    case 2:
      return 0.55;
    case 1:
      return 0.38;
    default:
      return 0;
  }
}

export type HbcmLiquidPalette = {
  deep: string;
  bright: string;
  tileDeep: string;
  tileBright: string;
};

/** Saturated liquid inside the digit; washed colors for the outer tile. */
export function hbcmLiquidPalette(display: number): HbcmLiquidPalette {
  switch (display) {
    case 5:
      return {
        deep: "rgb(18,150,78)",
        bright: "rgb(95,235,155)",
        tileDeep: "rgba(18,150,78,0.22)",
        tileBright: "rgba(95,235,155,0.14)",
      };
    case 4:
      return {
        deep: "rgb(95,140,42)",
        bright: "rgb(225,210,70)",
        tileDeep: "rgba(95,140,42,0.2)",
        tileBright: "rgba(225,210,70,0.12)",
      };
    case 3:
      return {
        deep: "rgb(200,175,55)",
        bright: "rgb(235,215,95)",
        tileDeep: "rgba(200,175,55,0.18)",
        tileBright: "rgba(235,215,95,0.11)",
      };
    case 2:
      return {
        deep: "rgb(215,110,38)",
        bright: "rgb(245,175,88)",
        tileDeep: "rgba(215,110,38,0.2)",
        tileBright: "rgba(245,175,88,0.12)",
      };
    case 1:
      return {
        deep: "rgb(185,32,32)",
        bright: "rgb(235,95,68)",
        tileDeep: "rgba(185,32,32,0.18)",
        tileBright: "rgba(235,95,68,0.1)",
      };
    default:
      return {
        deep: "rgba(120,120,130,0.35)",
        bright: "rgba(160,160,170,0.2)",
        tileDeep: "rgba(120,120,130,0.08)",
        tileBright: "rgba(160,160,170,0.05)",
      };
  }
}
