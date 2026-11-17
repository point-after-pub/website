#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const pug = require("pug");
const YAML = require("yaml");
const { optimizePhotos } = require("./optimize-photos");

const root = path.resolve(__dirname, "..");
const readYaml = (name) =>
  YAML.parse(fs.readFileSync(path.join(root, "data", `${name}.yaml`), "utf8"));
const requireText = (value, label) => {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${label} must be a non-empty string`);
};
const validateMenu = (menu, name) => {
  if (menu.reviewRequired)
    throw new Error(
      `${name} is an unreviewed PDF draft; correct it and remove reviewRequired before building`,
    );
  requireText(menu.title, `${name}.title`);
  requireText(menu.pdf, `${name}.pdf`);
  if (!Array.isArray(menu.sections) || !menu.sections.length)
    throw new Error(`${name}.sections must not be empty`);
  for (const [sectionIndex, section] of menu.sections.entries()) {
    requireText(section.name, `${name}.sections[${sectionIndex}].name`);
    if (!Array.isArray(section.items) || !section.items.length)
      throw new Error(`${section.name} needs items`);
    for (const [itemIndex, item] of section.items.entries()) {
      requireText(item.name, `${section.name}.items[${itemIndex}].name`);
      for (const field of ["description", "price", "extra"]) {
        if (item[field] !== undefined && typeof item[field] !== "string")
          throw new Error(`${item.name}.${field} must be a string`);
      }
    }
  }
  if (!fs.existsSync(path.join(root, menu.pdf)))
    throw new Error(`${name}: PDF does not exist: ${menu.pdf}`);
};

try {
  const regular = readYaml("regular");
  const friday = readYaml("friday");
  const { reviews } = readYaml("reviews");
  const { photos } = readYaml("gallery");
  const scriptVersion = createHash("sha256")
    .update(fs.readFileSync(path.join(root, "assets", "site.js")))
    .digest("hex")
    .slice(0, 12);
  const styleVersion = createHash("sha256")
    .update(fs.readFileSync(path.join(root, "assets", "style.css")))
    .digest("hex")
    .slice(0, 12);
  validateMenu(regular, "regular");
  validateMenu(friday, "friday");
  if (!Array.isArray(reviews) || !reviews.length)
    throw new Error("reviews must not be empty");
  reviews.forEach((review, index) => {
    if (review.reviewRequired)
      throw new Error(`reviews[${index}] is an unreviewed OCR draft`);
    requireText(review.quote, `reviews[${index}].quote`);
    requireText(review.reviewer, `reviews[${index}].reviewer`);
  });
  if (!Array.isArray(photos) || !photos.length)
    throw new Error("gallery photos must not be empty");
  photos.forEach((photo, index) => {
    requireText(photo.src, `photos[${index}].src`);
    requireText(photo.alt, `photos[${index}].alt`);
    if (
      !Number.isInteger(photo.width) ||
      photo.width < 1 ||
      !Number.isInteger(photo.height) ||
      photo.height < 1
    ) {
      throw new Error(
        `photos[${index}] needs positive integer width and height`,
      );
    }
    if (!fs.existsSync(path.join(root, photo.src)))
      throw new Error(`Missing gallery photo: ${photo.src}`);
  });
  const optimizedPhotos = optimizePhotos(photos, root);
  for (const [name, data] of Object.entries({ regular, friday, reviews })) {
    fs.writeFileSync(
      path.join(root, "data", `${name}.json`),
      `${JSON.stringify(data, null, 2)}\n`,
    );
  }
  const pages = [
    [
      "index.html",
      "home.pug",
      { reviews, photos: optimizedPhotos, page: "home" },
    ],
    ["menu.html", "menu.pug", { menu: regular, page: "regular" }],
    ["friday-menu.html", "menu.pug", { menu: friday, page: "friday" }],
    ["specials.html", "specials.pug", { page: "specials" }],
  ];
  for (const [output, template, locals] of pages) {
    const html = pug.renderFile(path.join(root, "templates", template), {
      ...locals,
      scriptVersion,
      styleVersion,
      pretty: true,
    });
    fs.writeFileSync(path.join(root, output), `${html}\n`);
    console.log(`Built ${output}`);
  }
} catch (error) {
  console.error(`Build failed: ${error.message}`);
  process.exitCode = 1;
}
