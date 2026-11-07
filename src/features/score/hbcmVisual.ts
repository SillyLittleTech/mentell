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
  /** Inset ring so mid/high heat does not melt into paper. */
  tileRing: string;
  tileGlow: string;
};

/** Saturated liquid inside the digit; washed colors for the outer tile. */
export function hbcmLiquidPalette(display: number): HbcmLiquidPalette {
  switch (display) {
    case 5:
      return {
        deep: "rgb(14,128,66)",
        bright: "rgb(78,220,140)",
        tileDeep: "rgba(12, 118, 62, 0.52)",
        tileBright: "rgba(88, 228, 150, 0.38)",
        tileRing: "rgba(18, 150, 78, 0.55)",
        tileGlow: "rgba(40, 190, 110, 0.22)",
      };
    case 4:
      return {
        deep: "rgb(82, 132, 28)",
        bright: "rgb(210, 228, 72)",
        tileDeep: "rgba(76, 128, 32, 0.48)",
        tileBright: "rgba(215, 225, 95, 0.34)",
        tileRing: "rgba(110, 160, 40, 0.5)",
        tileGlow: "rgba(170, 210, 60, 0.2)",
      };
    case 3:
      return {
        deep: "rgb(188, 142, 28)",
        bright: "rgb(248, 218, 108)",
        tileDeep: "rgba(188, 138, 24, 0.44)",
        tileBright: "rgba(245, 215, 110, 0.32)",
        tileRing: "rgba(198, 152, 28, 0.48)",
        tileGlow: "rgba(235, 195, 70, 0.18)",
      };
    case 2:
      return {
        deep: "rgb(215,110,38)",
        bright: "rgb(245,175,88)",
        tileDeep: "rgba(215,110,38,0.26)",
        tileBright: "rgba(245,175,88,0.16)",
        tileRing: "rgba(215, 110, 38, 0.28)",
        tileGlow: "rgba(245, 160, 70, 0.1)",
      };
    case 1:
      return {
        deep: "rgb(185,32,32)",
        bright: "rgb(235,95,68)",
        tileDeep: "rgba(185,32,32,0.24)",
        tileBright: "rgba(235,95,68,0.14)",
        tileRing: "rgba(185, 32, 32, 0.26)",
        tileGlow: "rgba(235, 95, 68, 0.08)",
      };
    default:
      return {
        deep: "rgba(120,120,130,0.35)",
        bright: "rgba(160,160,170,0.2)",
        tileDeep: "rgba(120,120,130,0.08)",
        tileBright: "rgba(160,160,170,0.05)",
        tileRing: "transparent",
        tileGlow: "transparent",
      };
  }
}
