// food-picture-01 entry program (v2 — double smash burger picture).
//
// What it does: copies the finished food picture shipped with this
// repository (./entry.png) into the output directory as /output/entry.png.
//
// Before copying, it validates the picture against every limit the
// competition's gate enforces, so a broken or oversized file can never
// be submitted by accident:
//   - the file must start with the JPEG magic bytes (FF D8 FF) or the PNG
//     magic bytes (89 50 4E 47) — the gate tells PNG from JPEG by the
//     first bytes, and the file name stays entry.png either way;
//   - the file must be at most 1 MiB (1048576 bytes);
//   - the picture must be at most 1024 x 1024 pixels, read from the PNG
//     IHDR chunk or the JPEG start-of-frame segment, whichever it is.
//
// The program is deterministic: copying the same bytes twice produces
// byte-identical output, as the competition requires (the program is run
// twice and both runs must write the same bytes).
//
// It uses only the Node.js standard library (node:fs, node:path), no
// network, and runs with plain `node main.ts` on Node 22+.

import { copyFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const MAX_BYTES = 1048576;
const MAX_WIDTH = 1024;
const MAX_HEIGHT = 1024;
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(bytes: Buffer, magic: number[]): boolean {
  if (bytes.length < magic.length) {
    return false;
  }
  for (let i = 0; i < magic.length; i++) {
    if (bytes[i] !== magic[i]) {
      return false;
    }
  }
  return true;
}

// PNG layout: 8-byte signature, then the IHDR chunk — its data starts
// with width and height as big-endian uint32 at offsets 16 and 20.
function pngDimensions(bytes: Buffer): { width: number; height: number } {
  if (bytes.length < 24) {
    throw new Error("entry.png is a truncated PNG (no complete IHDR)");
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

// JPEG layout: a chain of segments, each FF <marker> <length:uint16 BE>
// <payload>. The start-of-frame markers (C0-CF except C4, C8, CC) carry
// precision (1 byte), height (uint16 BE) and width (uint16 BE).
function jpegDimensions(bytes: Buffer): { width: number; height: number } {
  let offset = 2; // skip the SOI marker (FF D8)
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      throw new Error("entry.png is a malformed JPEG (lost segment sync)");
    }
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2) {
      throw new Error("entry.png is a malformed JPEG (bad segment length)");
    }
    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf &&
      marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame) {
      if (offset + 9 > bytes.length) {
        throw new Error("entry.png is a truncated JPEG (short frame header)");
      }
      return {
        height: bytes.readUInt16BE(offset + 5),
        width: bytes.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  throw new Error("entry.png is a malformed JPEG (no start-of-frame found)");
}

function validateImage(
  bytes: Buffer,
  size: number
): { format: "JPEG" | "PNG"; width: number; height: number } {
  if (size > MAX_BYTES) {
    throw new Error(
      `entry.png is ${size} bytes, over the 1 MiB limit (${MAX_BYTES} bytes)`
    );
  }

  let format: "JPEG" | "PNG";
  let dimensions: { width: number; height: number };
  if (startsWith(bytes, JPEG_MAGIC)) {
    format = "JPEG";
    dimensions = jpegDimensions(bytes);
  } else if (startsWith(bytes, PNG_MAGIC)) {
    format = "PNG";
    dimensions = pngDimensions(bytes);
  } else {
    throw new Error(
      "entry.png is neither a JPEG (magic FF D8 FF) nor a PNG (magic 89 50 4E 47)"
    );
  }

  if (dimensions.width > MAX_WIDTH || dimensions.height > MAX_HEIGHT) {
    throw new Error(
      `entry.png is ${dimensions.width}x${dimensions.height}, over the ` +
        `${MAX_WIDTH}x${MAX_HEIGHT} pixel limit`
    );
  }

  return { format, width: dimensions.width, height: dimensions.height };
}

function main(): void {
  const source = join(import.meta.dirname, "entry.png");
  const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  const destination = join(outputDir, "entry.png");

  // Read the shipped picture and validate it before anything is written.
  const bytes = readFileSync(source);
  const size = statSync(source).size;

  const { format, width, height } = validateImage(bytes, size);

  // Validation passed: write the picture to the output directory.
  mkdirSync(outputDir, { recursive: true });
  copyFileSync(source, destination);

  console.log(`Wrote ${destination} (${format}, ${width}x${height}, ${size} bytes)`);
}

main();
