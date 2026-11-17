"use strict";

function currentMenu(date = new Date()) {
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
  }).format(date);
  return day === "Fri" ? "friday-menu.html" : "menu.html";
}

function initializeReviews(section) {
  const pages = [...section.querySelectorAll("[data-review-page]")];
  const controls = section.querySelector("[data-review-controls]");
  if (pages.length < 2 || !controls) return;
  const count = controls.querySelector("[data-review-count]");
  let current = 0;
  const show = () => {
    pages.forEach((page, index) => {
      page.setAttribute("aria-hidden", String(index !== current));
    });
    count.textContent = `${current + 1} / ${pages.length}`;
  };
  controls
    .querySelector("[data-review-previous]")
    .addEventListener("click", () => {
      current = (current - 1 + pages.length) % pages.length;
      show();
    });
  controls.querySelector("[data-review-next]").addEventListener("click", () => {
    current = (current + 1) % pages.length;
    show();
  });
  show();
  section.querySelector("[data-review-pages]").dataset.enhanced = "true";
  controls.hidden = false;
}

function distributeGallery(items, count) {
  const positions = new Map(items.map((item, index) => [item, index]));
  const ratio = (item) => {
    const image = item.querySelector("img");
    return (
      Number(image.getAttribute("height")) / Number(image.getAttribute("width"))
    );
  };
  const columns = Array.from({ length: count }, () => ({
    items: [],
    height: 0,
  }));
  [...items]
    .sort((left, right) => ratio(right) - ratio(left))
    .forEach((item) => {
      const shortest = columns.reduce((left, right) =>
        left.height <= right.height ? left : right,
      );
      shortest.items.push(item);
      shortest.height += ratio(item);
    });
  return columns.map((column) =>
    column.items.sort(
      (left, right) => positions.get(left) - positions.get(right),
    ),
  );
}

function initializeGallery(section, random = Math.random) {
  const items = [...section.querySelectorAll("[data-gallery-item]")];
  const grid = section.querySelector("#gallery-photos");
  const more = section.querySelector("[data-gallery-more]");
  if (!grid || !items.length) return;
  const view = grid.ownerDocument.defaultView;
  for (let index = items.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  let columns = [];
  let expanded = false;
  const render = () => {
    const count = Math.min(
      items.length,
      view.matchMedia("(max-width: 540px)").matches ? 3 : 4,
    );
    if (columns.length !== count) {
      grid.replaceChildren();
      columns = distributeGallery(items, count).map((group) => {
        const column = grid.ownerDocument.createElement("div");
        column.className = "gallery-column";
        group.forEach((item) => {
          item.hidden = false;
          column.append(item);
        });
        grid.append(column);
        return column;
      });
      grid.style.setProperty("--gallery-columns", count);
    }
    grid.style.setProperty("--gallery-limit", "none");
    const gap = parseFloat(view.getComputedStyle(grid).columnGap) || 0;
    const itemGap = parseFloat(view.getComputedStyle(columns[0]).rowGap) || 0;
    const availableWidth =
      grid.getBoundingClientRect().width - gap * (count - 1);
    const columnSizes = columns.map((column) => {
      const children = [...column.children];
      const ratio = children.reduce((sum, item) => {
        const image = item.querySelector("img");
        return (
          sum +
          Number(image.getAttribute("height")) /
            Number(image.getAttribute("width"))
        );
      }, 0);
      return { ratio, gaps: itemGap * (children.length - 1) };
    });
    const targetHeight =
      (availableWidth +
        columnSizes.reduce((sum, size) => sum + size.gaps / size.ratio, 0)) /
      columnSizes.reduce((sum, size) => sum + 1 / size.ratio, 0);
    const widths = columnSizes.map(
      (size) => (targetHeight - size.gaps) / size.ratio,
    );
    if (widths.every((width) => Number.isFinite(width) && width > 0)) {
      grid.style.setProperty(
        "--gallery-template",
        widths.map((width) => `${width}px`).join(" "),
      );
    } else {
      grid.style.removeProperty("--gallery-template");
    }
    const initialHeight = Math.min(
      480,
      ...columns.map((column) => {
        const children = [...column.children];
        const last =
          children[Math.min(1, children.length - 1)].getBoundingClientRect();
        return last.bottom - column.getBoundingClientRect().top;
      }),
    );
    const limit = expanded ? Infinity : initialHeight;
    let hasMore = false;
    columns.forEach((column) => {
      const top = column.getBoundingClientRect().top;
      if (column.scrollHeight > limit + 1) hasMore = true;
      [...column.children].forEach((item) => {
        const visible = item.getBoundingClientRect().top - top < limit;
        item.setAttribute("aria-hidden", String(!visible));
        const image = item.querySelector("img");
        if (visible && image.dataset.src) {
          image.src = image.dataset.src;
          delete image.dataset.src;
        }
      });
    });
    grid.style.setProperty("--gallery-limit", expanded ? "none" : `${limit}px`);
    if (more) more.hidden = !hasMore;
  };
  if (more) {
    more.addEventListener("click", () => {
      expanded = true;
      render();
      grid.tabIndex = -1;
      grid.focus({ preventScroll: true });
    });
  }
  view.addEventListener("resize", render);
  render();
}

if (typeof document !== "undefined") {
  document.querySelectorAll("[data-menu-link]").forEach((link) => {
    const updateMenu = () => {
      link.href = currentMenu();
    };
    updateMenu();
    link.addEventListener("click", updateMenu);
  });
  document.querySelectorAll("[data-reviews]").forEach(initializeReviews);
  document
    .querySelectorAll("[data-gallery]")
    .forEach((section) => initializeGallery(section));
}

if (typeof module !== "undefined")
  module.exports = {
    currentMenu,
    initializeReviews,
    distributeGallery,
    initializeGallery,
  };
