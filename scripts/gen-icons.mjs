// Gera os ícones PNG do PWA (sem dependências externas) a partir de um desenho
// simples: fundo na cor da marca + nós/linhas evocando a rede neural do logo.
// Uso: node scripts/gen-icons.mjs
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

// Cor primária do Nerva (aprox. do tema — verde-azulado).
const BG = [15, 118, 110]; // teal-700
const FG = [255, 255, 255];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(size, pixels) {
  // pixels: Uint8Array RGBA de size*size*4
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter none
    pixels.copy
      ? pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
      : Buffer.from(pixels.slice(y * size * 4, (y + 1) * size * 4)).copy(raw, y * (size * 4 + 1) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function makeIcon(size, { maskable = false } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  // raio do "ícone" (menor se maskable, p/ safe-area)
  const pad = maskable ? size * 0.14 : 0;
  const setPx = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
  };
  const disc = (dx, dy, radius, color) => {
    for (let y = Math.floor(dy - radius); y <= dy + radius; y++) {
      for (let x = Math.floor(dx - radius); x <= dx + radius; x++) {
        if ((x - dx) ** 2 + (y - dy) ** 2 <= radius * radius) setPx(x, y, color);
      }
    }
  };
  const line = (x1, y1, x2, y2, w, color) => {
    const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      disc(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, w / 2, color);
    }
  };

  // fundo (retângulo cheio; iOS aplica o próprio arredondamento)
  for (let i = 0; i < size * size; i++) {
    px[i * 4] = BG[0]; px[i * 4 + 1] = BG[1]; px[i * 4 + 2] = BG[2]; px[i * 4 + 3] = 255;
  }

  // motivo rede neural (nó central + 4 satélites + conexões)
  const R = (size - pad * 2) * 0.5;
  const outer = R * 0.62;
  const nodes = [
    [cx, cy - outer], [cx, cy + outer], [cx - outer, cy], [cx + outer, cy],
  ];
  for (const [nx, ny] of nodes) line(cx, cy, nx, ny, size * 0.02, FG);
  for (const [nx, ny] of nodes) disc(nx, ny, size * 0.045, FG);
  disc(cx, cy, size * 0.09, FG);

  return encodePNG(size, px);
}

const targets = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-maskable-512.png', size: 512, maskable: true },
  { name: 'apple-touch-icon.png', size: 180 },
];
for (const t of targets) {
  const buf = makeIcon(t.size, { maskable: t.maskable });
  fs.writeFileSync(path.join(outDir, t.name), buf);
  console.log('wrote', t.name, buf.length, 'bytes');
}
console.log('done');
