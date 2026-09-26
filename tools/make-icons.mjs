// 生成 PWA 图标（纯 Node，无第三方依赖）
// node tools/make-icons.mjs
import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '..', 'public')

const crcTable = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function encodePng(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1)
    raw[rowStart] = 0
    rgba.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function px(buf, size, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= size || y >= size) return
  const i = (y * size + x) * 4
  buf[i] = r
  buf[i + 1] = g
  buf[i + 2] = b
  buf[i + 3] = a
}

function rect(buf, size, x0, y0, w, h, color) {
  for (let y = Math.round(y0); y < Math.round(y0 + h); y++) {
    for (let x = Math.round(x0); x < Math.round(x0 + w); x++) {
      px(buf, size, x, y, ...color)
    }
  }
}

function roundedBg(buf, size, radius, color) {
  const r = color[0]
  const g = color[1]
  const b = color[2]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 圆角判定
      const dx = Math.min(x, size - 1 - x)
      const dy = Math.min(y, size - 1 - y)
      if (dx < radius && dy < radius) {
        const ox = radius - dx
        const oy = radius - dy
        if (ox * ox + oy * oy > radius * radius) continue
      }
      px(buf, size, x, y, r, g, b, 255)
    }
  }
}

function drawIcon(size, { fullBleed = false } = {}) {
  const buf = Buffer.alloc(size * size * 4)
  const pad = fullBleed ? 0 : Math.round(size * 0.02)
  const inner = size - pad * 2
  roundedBg(
    buf,
    size,
    fullBleed ? 0 : Math.round(inner * 0.22),
    fullBleed ? [11, 15, 20, 255] : [11, 15, 20, 255]
  )
  // 若非 fullBleed，外面一圈做圆角透明
  if (!fullBleed) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4
        const dx = Math.min(x, size - 1 - x)
        const dy = Math.min(y, size - 1 - y)
        const radius = Math.round(inner * 0.22) + pad
        const ox = radius - dx
        const oy = radius - dy
        if (dx < radius && dy < radius && ox * ox + oy * oy > radius * radius) buf[i + 3] = 0
      }
    }
  }

  const white = [255, 255, 255, 255]
  const accent = [51, 139, 255, 255]

  const cy = size / 2
  const barLen = size * 0.42
  const barH = Math.max(2, Math.round(size * 0.058))
  const plateW = Math.max(2, Math.round(size * 0.075))
  const plateH = size * 0.3
  const innerPlateW = Math.max(1, Math.round(size * 0.038))
  const innerPlateH = size * 0.19

  // 横杆
  rect(buf, size, (size - barLen) / 2, cy - barH / 2, barLen, barH, white)
  // 外侧大片（蓝色）
  rect(buf, size, (size - barLen) / 2 - plateW, cy - plateH / 2, plateW, plateH, accent)
  rect(buf, size, (size + barLen) / 2, cy - plateH / 2, plateW, plateH, accent)
  // 内侧小片（白色）
  rect(buf, size, (size - barLen) / 2 + plateW * 0.25, cy - innerPlateH / 2, innerPlateW, innerPlateH, white)
  rect(buf, size, (size + barLen) / 2 - plateW * 0.25 - innerPlateW, cy - innerPlateH / 2, innerPlateW, innerPlateH, white)

  return encodePng(size, buf)
}

const targets = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-512-maskable.png', 512, { fullBleed: true }],
  ['icon-180.png', 180, {}],
]

for (const [name, size, opts] of targets) {
  const png = drawIcon(size, opts)
  fs.writeFileSync(path.join(outDir, name), png)
  console.log(`${name} (${size}x${size}) ${png.length} bytes`)
}
