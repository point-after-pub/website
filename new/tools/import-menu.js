#!/usr/bin/env node
"use strict";

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const YAML = require("yaml");

const [pdf, profile, output] = process.argv.slice(2);
if (!pdf || !["regular", "friday"].includes(profile) || !output) {
  console.error(
    "Usage: npm run import:menu -- <menu.pdf> <regular|friday> <draft.yaml>",
  );
  process.exit(1);
}
if (fs.existsSync(output)) {
  console.error(`Refusing to overwrite ${output}. Choose a new draft path.`);
  process.exit(1);
}

const regions = [
  { page: 1, x: 0, width: 235, name: "Appetizers" },
  {
    page: 1,
    x: 235,
    width: 377,
    name: profile === "regular" ? "Wraps & Sandwiches" : "Burgers & Chicken",
  },
  { page: 2, x: 0, width: 235, name: "Soups & Salads" },
  {
    page: 2,
    x: 235,
    width: 377,
    name: profile === "regular" ? "Burgers & Chicken" : "Seafood",
  },
];

try {
  const sections = regions.map((region) => {
    const text = execFileSync(
      "pdftotext",
      [
        "-f",
        String(region.page),
        "-l",
        String(region.page),
        "-r",
        "72",
        "-x",
        String(region.x),
        "-y",
        "0",
        "-W",
        String(region.width),
        "-H",
        "1100",
        "-layout",
        pdf,
        "-",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();
    if (!text)
      throw new Error(
        `No text found on page ${region.page}; image-only PDFs require manual transcription.`,
      );
    const items = text.split(/\n\s*\n/).map((block) => {
      const lines = block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const name = lines.shift();
      const description = lines.join(" ");
      const prices = [...description.matchAll(/[•·]\s*(\d+\.\d{2})/g)];
      if (prices.length === 1 && /[•·]\s*\d+\.\d{2}\s*$/.test(description)) {
        return {
          name,
          description: description.replace(/\s*[•·]\s*\d+\.\d{2}\s*$/, ""),
          price: prices[0][1],
        };
      }
      return { name, description };
    });
    return { name: region.name, sourcePage: region.page, items, rawText: text };
  });
  const draft = {
    title: profile === "regular" ? "Menu" : "Friday Menu",
    pdf: `assets/${path.basename(pdf)}`,
    source: path.basename(pdf),
    reviewRequired: true,
    sections,
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, YAML.stringify(draft), { flag: "wx" });
  console.log(
    `Created ${output}. Check every line against the PDF; columns, headings and prices can overlap.`,
  );
} catch (error) {
  console.error(`Menu extraction failed: ${error.message}`);
  process.exitCode = 1;
}
