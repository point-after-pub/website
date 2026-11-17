#!/usr/bin/env node
"use strict";

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const YAML = require("yaml");

const [output, ...images] = process.argv.slice(2);
if (!output || !images.length) {
  console.error(
    "Usage: npm run import:reviews -- <draft.yaml> <image> [image ...]",
  );
  process.exit(1);
}
if (fs.existsSync(output)) {
  console.error(`Refusing to overwrite ${output}. Choose a new draft path.`);
  process.exit(1);
}

try {
  const reviews = images.map((image) => {
    const text = execFileSync("tesseract", [image, "stdout", "-l", "eng"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    if (!text) throw new Error(`No text extracted from ${image}.`);
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const guideIndex = lines.findIndex((line) => /local guide/i.test(line));
    const timeIndex = lines.findIndex((line) =>
      /\b(?:\d+|a|an)\s+(?:day|week|month|year)s?\s+ago\b/i.test(line),
    );
    const quoteLines = timeIndex < 0 ? [] : lines.slice(timeIndex + 1);
    const ratingsIndex = quoteLines.findIndex((line) =>
      /^(?:food|service|atmosphere|recommended dishes)\s*:/i.test(line),
    );
    const candidate = (
      ratingsIndex < 0 ? quoteLines : quoteLines.slice(0, ratingsIndex)
    )
      .filter(
        (line) =>
          !/^(?:take\s*out|dine\s*in|delivery|breakfast|lunch|dinner|\$\d)/i.test(
            line,
          ),
      )
      .join(" ");
    return {
      source: path.basename(image),
      reviewRequired: true,
      reviewer: guideIndex > 0 ? lines[guideIndex - 1] : "",
      quote: candidate,
      rawOcr: text,
    };
  });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, YAML.stringify({ reviews }), { flag: "wx" });
  console.log(
    `Created ${output}. Copy verified names and quotes from rawOcr; check each against the original image.`,
  );
} catch (error) {
  const detail =
    error.code === "ENOENT"
      ? "Install Tesseract OCR and its English language data."
      : error.message;
  console.error(`Review extraction failed: ${detail}`);
  process.exitCode = 1;
}
