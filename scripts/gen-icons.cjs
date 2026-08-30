/* eslint-disable @typescript-eslint/no-require-imports */
// One-off icon generator. Run: node scripts/gen-icons.cjs
// Source is the user's original 256x256 favicon (recovered from git), so the
// existing artwork/framing is preserved — we only downscale and add sizes.
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const APP = path.join(__dirname, "..", "app");
const opts = { fit: "cover", position: "centre" };

// Extract the largest embedded PNG from the original .ico to use as the source.
function pngFromIco(icoPath) {
  const buf = fs.readFileSync(icoPath);
  const count = buf.readUInt16LE(4);
  let best = null;
  for (let i = 0; i < count; i++) {
    const e = 6 + i * 16;
    const size = buf.readUInt32LE(e + 8);
    const offset = buf.readUInt32LE(e + 12);
    const dim = buf.readUInt8(e) || 256;
    if (!best || dim > best.dim) best = { dim, data: buf.subarray(offset, offset + size) };
  }
  return best.data;
}

const SRC = pngFromIco(path.join(__dirname, "source-favicon.ico"));

const square = (size) =>
  sharp(SRC).resize(size, size, opts).png({ compressionLevel: 9 }).toBuffer();

function buildIco(buffers, sizes) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(buffers.length, 4); // image count

  let offset = 6 + 16 * buffers.length;
  const entries = buffers.map((buf, i) => {
    const e = Buffer.alloc(16);
    const s = sizes[i];
    e.writeUInt8(s >= 256 ? 0 : s, 0); // width (0 => 256)
    e.writeUInt8(s >= 256 ? 0 : s, 1); // height
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(buf.length, 8); // size of PNG data
    e.writeUInt32LE(offset, 12); // offset of PNG data
    offset += buf.length;
    return e;
  });

  return Buffer.concat([header, ...entries, ...buffers]);
}

(async () => {
  // Modern browsers — tiny, decodes instantly
  await sharp(SRC).resize(48, 48, opts).png().toFile(path.join(APP, "icon.png"));
  // Safari bookmarks / iOS home screen
  await sharp(SRC).resize(180, 180, opts).png().toFile(path.join(APP, "apple-icon.png"));

  // Legacy + browser auto-request to /favicon.ico — multi-size, small
  const sizes = [16, 32, 48];
  const buffers = await Promise.all(sizes.map(square));
  fs.writeFileSync(path.join(APP, "favicon.ico"), buildIco(buffers, sizes));

  for (const f of ["favicon.ico", "icon.png", "apple-icon.png"]) {
    console.log(f, fs.statSync(path.join(APP, f)).size, "bytes");
  }
})();
