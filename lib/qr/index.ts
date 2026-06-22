import QRCode from 'qrcode'

// Single source of truth for QR rendering. `qrcode` is a pure-JS encoder (no
// native/canvas deps), so both forms run fine server-side:
//   * qrSvg     — crisp inline SVG for on-page previews (no client JS).
//   * qrPngBuffer — a real PNG for the "download as PNG" action.
// Both encode the same upload URL; error-correction level M tolerates a bit of
// print smudging / logo overlay later without failing to scan.
const BASE_OPTIONS = {
  margin: 1,
  errorCorrectionLevel: 'M',
  color: { dark: '#000000', light: '#ffffff' },
} as const

export function qrSvg(text: string, width = 256): Promise<string> {
  return QRCode.toString(text, { ...BASE_OPTIONS, type: 'svg', width })
}

export async function qrPngBuffer(text: string, width = 512): Promise<Buffer> {
  // Derive the PNG from a data URL rather than toBuffer() so we don't depend on
  // that method's optional-callback signature — toDataURL reliably returns a
  // promise in Node.
  const dataUrl = await QRCode.toDataURL(text, { ...BASE_OPTIONS, width })
  return Buffer.from(dataUrl.split(',')[1], 'base64')
}
