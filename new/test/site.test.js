"use strict";

const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const YAML = require("yaml");

const root = path.resolve(__dirname, "..");
const run = (script, args, options = {}) =>
  spawnSync(process.execPath, [path.join(root, "tools", script), ...args], {
    encoding: "utf8",
    ...options,
  });

test("menu import makes a review-required draft and refuses to overwrite", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "point-after-menu-"));
  const output = path.join(directory, "draft.yaml");
  const pdf = path.join(root, "assets", "winter_2026.pdf");
  const result = run("import-menu.js", [pdf, "regular", output]);
  assert.equal(result.status, 0, result.stderr);
  const draft = YAML.parse(fs.readFileSync(output, "utf8"));
  assert.equal(draft.reviewRequired, true);
  assert.equal(draft.sections.length, 4);
  assert.ok(
    draft.sections[0].items.some((item) => item.name.includes("Cheese Curds")),
  );
  assert.equal(run("import-menu.js", [pdf, "regular", output]).status, 1);
});

test("review import keeps OCR text and marks candidates for review", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "point-after-review-"),
  );
  const executable = path.join(directory, "tesseract");
  fs.writeFileSync(
    executable,
    '#!/bin/sh\nprintf "Jane Doe\\nLocal Guide\\n2 months ago\\nDinner | \\$10-20\\nGreat fish fry!\\nFood: 5/5\\n"\n',
    { mode: 0o755 },
  );
  const output = path.join(directory, "draft.yaml");
  const result = run("import-reviews.js", [output, "review.jpg"], {
    env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
  });
  assert.equal(result.status, 0, result.stderr);
  const { reviews } = YAML.parse(fs.readFileSync(output, "utf8"));
  assert.equal(reviews[0].reviewer, "Jane Doe");
  assert.equal(reviews[0].quote, "Great fish fry!");
  assert.equal(reviews[0].reviewRequired, true);
  assert.match(reviews[0].rawOcr, /Food: 5\/5/);
  assert.equal(run("import-reviews.js", [output, "review.jpg"]).status, 1);
});

test("review import reports missing OCR without creating output", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "point-after-no-ocr-"),
  );
  const output = path.join(directory, "draft.yaml");
  const result = run("import-reviews.js", [output, "review.jpg"], {
    env: { ...process.env, PATH: directory },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Install Tesseract/);
  assert.equal(fs.existsSync(output), false);
});

test("build generates standalone pages and local assets resolve", () => {
  execFileSync(process.execPath, [path.join(root, "tools", "build.js")]);
  for (const page of [
    "index.html",
    "menu.html",
    "friday-menu.html",
    "specials.html",
  ]) {
    const html = fs.readFileSync(path.join(root, page), "utf8");
    assert.match(html, /<main/);
    for (const target of ["index.html", "menu.html", "specials.html"]) {
      assert.ok(
        html.includes(`href="${target}"`),
        `${page}: missing navigation to ${target}`,
      );
    }
    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const target = match[1];
      if (/^(?:#|https?:|tel:)/.test(target)) continue;
      const filename = target.split(/[?#]/)[0];
      assert.ok(
        fs.existsSync(path.join(root, filename)),
        `${page}: missing ${filename}`,
      );
    }
  }
  assert.match(
    fs.readFileSync(path.join(root, "menu.html"), "utf8"),
    /Cheese Curds/,
  );
  assert.match(
    fs.readFileSync(path.join(root, "menu.html"), "utf8"),
    /<h1>Menu<\/h1>/,
  );
  for (const page of ["menu.html", "friday-menu.html"]) {
    const html = fs.readFileSync(path.join(root, page), "utf8");
    assert.doesNotMatch(
      html,
      /← Back to Point After|POINT AFTER PUB &amp; GRILL.*STEVENS POINT|ON THE MENU/,
    );
  }
  assert.doesNotMatch(
    fs.readFileSync(path.join(root, "menu.html"), "utf8"),
    /Good food, good company\./,
  );
  assert.match(
    fs.readFileSync(path.join(root, "menu.html"), "utf8"),
    /href="friday-menu\.html"/,
  );
  assert.match(
    fs.readFileSync(path.join(root, "friday-menu.html"), "utf8"),
    /href="menu\.html"/,
  );
  assert.match(
    fs.readFileSync(path.join(root, "friday-menu.html"), "utf8"),
    /Fish Fry/,
  );
  assert.match(
    fs.readFileSync(path.join(root, "friday-menu.html"), "utf8"),
    /winter_friday_2026\.pdf/,
  );
  assert.match(
    fs.readFileSync(path.join(root, "specials.html"), "utf8"),
    /mystery shots/,
  );
  assert.doesNotMatch(
    fs.readFileSync(path.join(root, "index.html"), "utf8"),
    /Pull up a chair|id="menus"|id="specials"/,
  );
  const homepage = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(
    homepage,
    /class="visit-address"[\s\S]*?801 Second Street[\s\S]*?href="tel:\+17153447222"/,
  );
  assert.ok(homepage.indexOf('id="visit"') < homepage.indexOf('id="photos"'));
  assert.equal((homepage.match(/data-gallery-item/g) || []).length, 15);
  assert.equal(
    (homepage.match(/data-src="assets\/gallery\//g) || []).length,
    15,
  );
  assert.match(homepage, /<noscript>/);
  assert.doesNotMatch(homepage, /data-gallery-dialog|<a class="gallery-photo"/);
});

test("menu navigation uses the day in Stevens Point", () => {
  const { currentMenu } = require("../assets/site.js");
  assert.equal(currentMenu(new Date("2026-11-20T05:30:00Z")), "menu.html");
  assert.equal(
    currentMenu(new Date("2026-11-20T06:30:00Z")),
    "friday-menu.html",
  );
  assert.equal(
    currentMenu(new Date("2026-11-21T05:30:00Z")),
    "friday-menu.html",
  );
  assert.equal(currentMenu(new Date("2026-11-21T06:30:00Z")), "menu.html");
});

test("review controls paginate, wrap, and leave all reviews available without JavaScript", () => {
  const { initializeReviews } = require("../assets/site.js");
  const pages = Array.from({ length: 2 }, () => ({
    setAttribute: function (name, value) {
      this[name] = value;
    },
  }));
  const count = {};
  const previous = {
    addEventListener: (_, callback) => {
      previous.click = callback;
    },
  };
  const next = {
    addEventListener: (_, callback) => {
      next.click = callback;
    },
  };
  const controls = {
    hidden: true,
    querySelector: (selector) =>
      ({
        "[data-review-count]": count,
        "[data-review-previous]": previous,
        "[data-review-next]": next,
      })[selector],
  };
  const grid = { dataset: {} };
  const section = {
    querySelectorAll: () => pages,
    querySelector: (selector) =>
      selector === "[data-review-controls]" ? controls : grid,
  };
  initializeReviews(section);
  assert.deepEqual(
    pages.map((page) => page["aria-hidden"]),
    ["false", "true"],
  );
  assert.equal(controls.hidden, false);
  assert.equal(count.textContent, "1 / 2");
  next.click();
  assert.deepEqual(
    pages.map((page) => page["aria-hidden"]),
    ["true", "false"],
  );
  previous.click();
  previous.click();
  assert.deepEqual(
    pages.map((page) => page["aria-hidden"]),
    ["true", "false"],
  );
  assert.equal(count.textContent, "2 / 2");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.equal((html.match(/data-review-page /g) || []).length, 2);
  assert.equal((html.match(/class="review"/g) || []).length, 6);
  assert.doesNotMatch(html, /data-review-page[^>]*aria-hidden/);
  assert.doesNotMatch(html, /class="photo-strip"/);
});

function galleryFixture() {
  const items = Array.from({ length: 12 }, (_, index) => {
    const image = {
      dataset: { src: `assets/gallery/${index}.jpg` },
      getAttribute: () => "100",
    };
    return {
      index,
      image,
      hidden: true,
      querySelector: () => image,
      setAttribute(name, value) {
        this[name] = value;
      },
      getBoundingClientRect() {
        const top = this.column.children.indexOf(this) * 110;
        return { top, bottom: top + 100 };
      },
    };
  });
  const more = {
    hidden: true,
    addEventListener: (_, callback) => {
      more.click = callback;
    },
  };
  const view = {
    matchMedia: () => ({ matches: false }),
    getComputedStyle: () => ({ columnGap: "12px", rowGap: "12px" }),
    addEventListener() {},
  };
  const grid = {
    columns: [],
    style: {
      setProperty(name, value) {
        this[name] = value;
      },
      removeProperty(name) {
        delete this[name];
      },
    },
    ownerDocument: {
      defaultView: view,
      createElement: () => ({
        children: [],
        append(item) {
          item.column = this;
          this.children.push(item);
        },
        getBoundingClientRect: () => ({ top: 0 }),
        get scrollHeight() {
          return this.children.length * 110 - 10;
        },
      }),
    },
    replaceChildren() {
      this.columns = [];
    },
    append(column) {
      this.columns.push(column);
    },
    getBoundingClientRect: () => ({ width: 1000 }),
    focus() {
      this.focused = true;
    },
  };
  const section = {
    querySelectorAll: () => items,
    querySelector: (selector) =>
      selector === "[data-gallery-more]" ? more : grid,
  };
  return { items, more, grid, section };
}

test("gallery shuffles, clips evenly and loads the remaining photos on expansion", () => {
  const { initializeGallery } = require("../assets/site.js");
  const { items, more, grid, section } = galleryFixture();
  initializeGallery(section, () => 0);
  assert.deepEqual(
    grid.columns.map((column) => column.children.map((item) => item.index)),
    [
      [1, 5, 9],
      [2, 6, 10],
      [3, 7, 11],
      [4, 8, 0],
    ],
  );
  assert.equal(grid.style["--gallery-limit"], "210px");
  assert.equal(items.filter((item) => item.image.src).length, 8);
  assert.equal(
    items.filter((item) => item["aria-hidden"] === "true").length,
    4,
  );
  assert.equal(more.hidden, false);
  more.click();
  assert.equal(items.filter((item) => item.image.src).length, 12);
  assert.equal(
    items.filter((item) => item["aria-hidden"] === "true").length,
    0,
  );
  assert.equal(grid.style["--gallery-limit"], "none");
  assert.equal(grid.focused, true);
  assert.equal(more.hidden, true);
});

test("gallery initializes through the browser document", () => {
  const { section, grid } = galleryFixture();
  const document = {
    querySelectorAll: (selector) =>
      selector === "[data-gallery]" ? [section] : [],
  };
  const script = fs.readFileSync(path.join(root, "assets", "site.js"), "utf8");
  assert.doesNotThrow(() => vm.runInNewContext(script, { document }));
  assert.equal(grid.columns.length, 4);
});

test("photo optimization preserves originals and reuses generated images", () => {
  const { optimizePhotos } = require("../tools/optimize-photos");
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "point-after-optimize-"),
  );
  const sourceDirectory = path.join(directory, "assets", "gallery");
  fs.mkdirSync(sourceDirectory, { recursive: true });
  const source = path.join(sourceDirectory, "14.jpg");
  fs.copyFileSync(path.join(root, "assets", "gallery", "14.jpg"), source);
  const original = fs.readFileSync(source);
  const photos = [
    { src: "assets/gallery/14.jpg", width: 574, height: 600, alt: "Food" },
  ];
  const output = optimizePhotos(photos, directory)[0];
  const outputPath = path.join(directory, output.src);
  assert.notEqual(output.src, photos[0].src);
  assert.ok(fs.statSync(outputPath).size < original.length);
  assert.deepEqual(fs.readFileSync(source), original);
  assert.equal(
    execFileSync("magick", ["identify", "-format", "%wx%h", outputPath], {
      encoding: "utf8",
    }),
    "574x600",
  );
  const modified = fs.statSync(outputPath).mtimeMs;
  assert.deepEqual(optimizePhotos(photos, directory), [output]);
  assert.equal(fs.statSync(outputPath).mtimeMs, modified);
});
