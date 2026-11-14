// food-picture-01 entry program.
//
// What it does: copies the finished food picture shipped with this
// repository (./entry.png) into the output directory, as /output/entry.png.
//
// Before copying it validates the image so a broken or oversized file can
// never be submitted by accident:
//   - the file must start with the JPEG magic bytes (FF D8 FF) or the PNG
//     magic bytes (89 50 4E 47), matching the competition's rule that the
//     file is a PNG or a JPEG told apart by its first bytes;
//   - the file must be at most 1 MiB (1048576 bytes).
// The program is deterministic: copying the same bytes twice produces
// byte-identical output, as the competition requires.
//
// It uses only the Node.js standard library (node:fs, node:path) and no
// network, and it runs with plain `node main.ts` on Node 22+.

import { copyFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const MAX_BYTES = 1048576;
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

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

function validateImage(bytes: Buffer, size: number): "JPEG" | "PNG" {
  if (size > MAX_BYTES) {
    throw new Error(
      `entry.png is ${size} bytes, over the 1 MiB limit (${MAX_BYTES} bytes)`
    );
  }

  const isJpeg = startsWith(bytes, JPEG_MAGIC);
  const isPng = startsWith(bytes, PNG_MAGIC);
  if (!isJpeg && !isPng) {
    throw new Error(
      "entry.png is neither a JPEG (magic FF D8 FF) nor a PNG (magic 89 50 4E 47)"
    );
  }

  return isJpeg ? "JPEG" : "PNG";
}

function main(): void {
  const source = join(import.meta.dirname, "entry.png");
  const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  const destination = join(outputDir, "entry.png");

  // Read the shipped picture and validate it before anything is written.
  const bytes = readFileSync(source);
  const size = statSync(source).size;

  const format = validateImage(bytes, size);

  // Validation passed: write the picture to the output directory.
  mkdirSync(outputDir, { recursive: true });
  copyFileSync(source, destination);

  console.log(`Wrote ${destination} (${format}, ${size} bytes)`);
}

main();
