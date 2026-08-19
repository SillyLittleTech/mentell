import { QRCodeSVG } from 'qrcode.react'
import { canEncodeQrValue } from './cryptCode'

export function CryptQrBlock({ value }: { value: string }) {
  if (!canEncodeQrValue(value)) {
    return (
      <p className="ink-muted text-center text-sm">
        This snapshot is too large for a QR code. Copy the crypto code or link instead.
      </p>
    )
  }

  return (
    <div className="rounded-2xl bg-white p-4">
      <QRCodeSVG value={value} size={256} level="L" />
    </div>
  )
}
