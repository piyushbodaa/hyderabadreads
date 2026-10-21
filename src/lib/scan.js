// Reading a book's barcode with the phone camera. Chrome on Android has a
// barcode reader built in; elsewhere (Safari, Firefox) the site loads ZXing,
// compiled to WebAssembly and served from hyderabadreads.fun itself.
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

const FORMATS = ['ean_13']

async function reader() {
  if ('BarcodeDetector' in window) {
    const supported = await window.BarcodeDetector.getSupportedFormats?.().catch(() => [])
    if (supported?.includes('ean_13')) return new window.BarcodeDetector({ formats: FORMATS })
  }
  const { BarcodeDetector, prepareZXingModule } = await import('barcode-detector/ponyfill')
  prepareZXingModule({ overrides: { locateFile: (path, prefix) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) } })
  return new BarcodeDetector({ formats: FORMATS })
}

export const canScan = () => Boolean(navigator.mediaDevices?.getUserMedia)

// Opens the camera over the page and resolves with the first ISBN it reads
// (books carry their ISBN as an EAN-13 starting 978 or 979), or null if the
// reader gives up. Rejects if the camera can't be opened.
export function scanIsbn() {
  const overlay = document.createElement('div')
  overlay.className = 'scanner'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-label', 'Scan a barcode')
  overlay.innerHTML = `
    <div class="scanner__frame"><video playsinline muted></video><span class="scanner__line" aria-hidden="true"></span></div>
    <p class="scanner__hint">Hold the barcode on the back cover inside the frame.</p>
    <button type="button" class="btn btn--ghost" data-cancel>Cancel</button>`
  document.body.append(overlay)
  document.documentElement.classList.add('is-locked')
  const video = overlay.querySelector('video')
  let stream = null
  let done = false

  return new Promise((resolve, reject) => {
    const finish = (value, error) => {
      if (done) return
      done = true
      stream?.getTracks().forEach((t) => t.stop())
      overlay.remove()
      document.documentElement.classList.remove('is-locked')
      removeEventListener('keydown', onKey)
      error ? reject(error) : resolve(value)
    }
    const onKey = (e) => e.key === 'Escape' && finish(null)
    addEventListener('keydown', onKey)
    overlay.querySelector('[data-cancel]').addEventListener('click', () => finish(null))
    overlay.querySelector('[data-cancel]').focus()

    ;(async () => {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      video.srcObject = stream
      await video.play()
      const barcodes = await reader()
      const look = async () => {
        if (done) return
        try {
          const found = (await barcodes.detect(video)).map((c) => c.rawValue).find((v) => /^97[89]\d{10}$/.test(v))
          if (found) {
            navigator.vibrate?.(60)
            return finish(found)
          }
        } catch {
          // A frame the reader couldn't use; try the next one.
        }
        setTimeout(look, 180)
      }
      look()
    })().catch((err) => finish(null, err))
  })
}
