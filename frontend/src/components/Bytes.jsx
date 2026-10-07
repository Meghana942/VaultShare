import { useEffect, useRef } from 'react'

// Bytes drawn as grey pixels. Structured data shows patterns; random data is TV static.
export function ByteCanvas({ bytes, width = 64, scale = 3, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const height = Math.ceil(bytes.length / width)
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    const img = ctx.createImageData(width, height)
    for (let i = 0; i < width * height; i++) {
      const v = i < bytes.length ? bytes[i] : 0
      img.data[i * 4] = v
      img.data[i * 4 + 1] = v
      img.data[i * 4 + 2] = v
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  }, [bytes, width])
  return (
    <canvas
      ref={ref}
      className={`rounded-xl border border-line ${className}`}
      style={{ width: width * scale, height: Math.ceil(bytes.length / width) * scale, imageRendering: 'pixelated' }}
    />
  )
}
