import type { CSSProperties } from "react";
import type { HbcmLiquidPalette } from "./hbcmVisual";

/** Wii Homebrew–style rolling liquid waves inside the heat tile pool. */
export function HbcmTileWaves({
  palette,
  reduced,
}: {
  palette: HbcmLiquidPalette;
  reduced: boolean;
}) {
  const style = {
    "--hbcm-wave-a": palette.tileBright,
    "--hbcm-wave-b": palette.tileDeep,
  } as CSSProperties;

  return (
    <div
      className="hbcm-tile-waves pointer-events-none absolute inset-x-0 bottom-0 top-[-20%]"
      style={style}
      aria-hidden
    >
      <svg
        className="hbcm-tile-waves__svg"
        viewBox="0 0 240 56"
        preserveAspectRatio="none"
        role="presentation"
      >
        <g
          className={
            reduced
              ? undefined
              : "hbcm-tile-waves__layer hbcm-tile-waves__layer--a"
          }
        >
          <path
            className="hbcm-tile-waves__path"
            d="M-80,30 C-55,10 -30,42 -5,30 S45,10 70,30 S120,42 145,30 S195,10 220,30 S270,42 295,30 V80 H-80 Z"
          />
        </g>
        <g
          className={
            reduced
              ? undefined
              : "hbcm-tile-waves__layer hbcm-tile-waves__layer--b"
          }
        >
          <path
            className="hbcm-tile-waves__path hbcm-tile-waves__path--shine"
            d="M-80,34 C-50,18 -20,46 10,34 S70,16 100,34 S160,48 190,34 S250,16 280,34 V80 H-80 Z"
          />
        </g>
        <g
          className={
            reduced
              ? undefined
              : "hbcm-tile-waves__layer hbcm-tile-waves__layer--c"
          }
        >
          <path
            className="hbcm-tile-waves__path hbcm-tile-waves__path--crest"
            d="M-80,26 C-35,8 10,38 55,26 S145,6 190,26 S275,40 320,26 V48 H-80 Z"
          />
        </g>
      </svg>
      {!reduced ? <div className="hbcm-tile-waves__sheen" aria-hidden /> : null}
    </div>
  );
}
