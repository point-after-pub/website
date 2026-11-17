# Point After preview

This is a self-contained preview of the proposed site. It does not change the existing site at the repository root. Once deployed, the preview is accessible at `/new/` and is public unless the hosting service restricts access. All links are relative so the preview can later be moved to the site root.

Before publishing, confirm menu prices and descriptions against the PDFs, verify hours and specials with the owner, and confirm permission to use the selected photos and review quotations. PDF downloads and website menus are maintained separately and should be checked for consistency.

## Local setup

The build requires Node.js, npm and ImageMagick (`magick`) with WebP support to optimize gallery images. PDF imports additionally need Poppler's `pdftotext`; review imports need Tesseract OCR and its English language data. These are local tools only; the website itself has no JavaScript framework or external library dependency.

```sh
cd new
npm ci
npm run build
npm test
```

From the repository root, run `python3 -m http.server 8123` and visit `http://localhost:8123/new/`. Keep `index.html`, `menu.html`, `friday-menu.html`, `specials.html`, `assets/` and the generated JSON files when publishing the preview. Do not publish `node_modules/` or unreviewed OCR drafts.

## Edit a menu

Edit `data/regular.yaml` or `data/friday.yaml` and run `npm run build`. Each section has a `name`, optional `note` and `footer`, and `items` with `name` and optional `description`, `price` and `extra`. Keep prices in quotes; `extra` can include multiple prices or options. The build validates the structure, produces JSON in `data/`, and renders static HTML. The menu is readable without JavaScript.

To extract a new PDF into a **draft**:

```sh
npm run import:menu -- assets/winter_2026.pdf regular drafts/regular-update.yaml
npm run import:menu -- assets/winter_friday_2026.pdf friday drafts/friday-update.yaml
```

The importer targets layouts similar to the supplied PDFs, not arbitrary menus or image-only PDFs. It preserves cropped raw text and creates draft item candidates; headings and columns can overlap, prices may be ambiguous, and unrelated text may be included. Compare every item, option, price and disclaimer against the PDF. Correct the data, add any missing fields, remove `reviewRequired` and the raw text fields, then replace the appropriate menu YAML. The tool will not overwrite an existing draft. Copy a new PDF into `assets/` and update the YAML `pdf` path when appropriate.

## Extract reviews

```sh
npm run import:reviews -- drafts/reviews-update.yaml ../media_2026/r1.jpg ../media_2026/r2.jpg
```

The tool extracts raw OCR and suggests reviewer and quotation fields when it can. It does not infer a rating or guarantee that a name or quotation is correct. Compare every quotation and attribution to its source image, omit unverifiable fields, and confirm permission before adding reviewed entries to `data/reviews.yaml`. Unreviewed entries cannot be built. The tool will not overwrite an existing draft. Run `npm run build` after editing reviews.

## Edit the photo gallery

Add photos to `assets/gallery/` and entries to `data/gallery.yaml` with their relative paths, pixel dimensions and descriptive alt text, then run `npm run build`. The build preserves originals and creates cached, high-quality WebP copies in `assets/gallery/optimized/`, using the original if it is smaller. WebP is visually high-quality but not lossless. The gallery chooses a new order on each page load; the initially visible photos load lazily, and the remainder are requested after selecting More photos. Photos retain their original proportions; only the bottom of the gallery preview is clipped. With JavaScript disabled, all photos remain visible in their listed order. Confirm permission to publish photos of people, including children.

## Preview contents

- `templates/`, `assets/style.css`: page templates and styling.
- `data/*.yaml`: editable menu, review and gallery content; menu and review JSON is generated.
- `tools/`: local import and build commands.
- `assets/`: copied photos, fonts and PDF downloads, plus the logo and textures extracted from the menu PDF; original assets remain untouched. The WebP logo is lossless; the JPEG textures are retained because lossless recompression did not reduce their size.
- `assets/site.js`: lightweight menu-day selection and optional manual review pagination. Without JavaScript, the regular menu link and all reviews remain available.
- `drafts/`: local ignored extraction drafts, which require manual review.
