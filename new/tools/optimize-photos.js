"use strict";

const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function optimizePhotos(photos, root) {
  const outputDirectory = path.join(root, "assets", "gallery", "optimized");
  fs.mkdirSync(outputDirectory, { recursive: true });
  return photos.map((photo) => {
    const source = path.join(root, photo.src);
    const hash = createHash("sha256")
      .update("webp-quality-90-method-6-v1")
      .update(fs.readFileSync(source))
      .digest("hex")
      .slice(0, 12);
    const stem = path.parse(photo.src).name.replace(/[^a-zA-Z0-9_-]/g, "-");
    const relativeOutput = `assets/gallery/optimized/${stem}-${hash}.webp`;
    const output = path.join(root, relativeOutput);
    if (!fs.existsSync(output)) {
      const temporary = `${output}.${process.pid}.tmp`;
      try {
        execFileSync(
          "magick",
          [
            source,
            "-strip",
            "-quality",
            "90",
            "-define",
            "webp:method=6",
            `webp:${temporary}`,
          ],
          { stdio: "pipe" },
        );
        fs.renameSync(temporary, output);
      } catch (error) {
        if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
        if (error.code === "ENOENT")
          throw new Error(
            "ImageMagick (magick) with WebP support is required to optimize gallery photos",
          );
        throw new Error(
          `Could not optimize ${photo.src}: ${error.stderr?.toString().trim() || error.message}`,
        );
      }
    }
    return {
      ...photo,
      src:
        fs.statSync(output).size < fs.statSync(source).size
          ? relativeOutput
          : photo.src,
    };
  });
}

module.exports = { optimizePhotos };
