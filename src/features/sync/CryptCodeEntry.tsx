import { useRef, useState } from "react";
import { Scanner, type IScannerHandle } from "@yudiel/react-qr-scanner";
import { useEffect } from "react";

export function CryptCodeEntry({
  busy = false,
  error = null,
  onCode,
}: {
  busy?: boolean;
  error?: string | null;
  onCode: (code: string) => void;
}) {
  const [tab, setTab] = useState<"scan" | "paste">("scan");
  const [pastedCode, setPastedCode] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const lastScanned = useRef("");
  const scannerRef = useRef<IScannerHandle>(null);

  useEffect(() => {
    const scanner = scannerRef.current;
    return () => {
      if (scanner) {
        scanner
          .getStream()
          ?.getTracks()
          .forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <>
      <div className="mt-4 flex gap-4 border-b border-[var(--paper-border)] pb-2 text-sm font-semibold">
        <button
          type="button"
          className={`px-2 ${tab === "scan" ? "border-b-2 border-[var(--accent)] text-[var(--accent)]" : "opacity-60"}`}
          onClick={() => setTab("scan")}
        >
          Camera scanner
        </button>
        <button
          type="button"
          className={`px-2 ${tab === "paste" ? "border-b-2 border-[var(--accent)] text-[var(--accent)]" : "opacity-60"}`}
          onClick={() => setTab("paste")}
        >
          Enter code
        </button>
      </div>

      <div className="mt-4 min-h-[250px]">
        {tab === "scan" ? (
          <div className="overflow-hidden rounded-2xl">
            <Scanner
              onScan={(result: Array<{ rawValue: string }>) => {
                const value = result[0]?.rawValue?.trim();
                if (!value || busy || value === lastScanned.current) return;
                lastScanned.current = value;
                onCode(value);
              }}
              onError={() => {
                setScanError(
                  (prev) =>
                    prev ??
                    "Camera is unavailable. Enter the crypto code instead.",
                );
              }}
              formats={["qr_code"]}
              ref={scannerRef}
              paused={busy}
            />
            {scanError ? (
              <div className="mt-3 text-sm" style={{ color: "var(--danger)" }}>
                {scanError}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <textarea
              className="focus-ring h-32 w-full rounded-2xl border border-[var(--paper-border)] bg-transparent p-3 text-sm font-mono"
              placeholder="Paste a crypto code or share link..."
              value={pastedCode}
              onChange={(e) => setPastedCode(e.target.value)}
            />
            <button
              type="button"
              className="focus-ring rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
              disabled={!pastedCode.trim() || busy}
              onClick={() => onCode(pastedCode)}
            >
              {busy ? "Decrypting..." : "Decrypt code"}
            </button>
          </div>
        )}
        {error ? (
          <div className="mt-4 text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </div>
        ) : null}
      </div>
    </>
  );
}
