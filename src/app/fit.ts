/**
 * Spec 10.1: text on a tile or button never wraps and never overflows: it shrinks to fit, then shortens.
 * A label is an element with `data-fit` holding its text and no children of its own; fitAll sets its text.
 * `data-fit-min` (px) raises the smallest size it shrinks to.
 */
const MIN_SCALE = 0.72;

export function fit(el: HTMLElement): void {
  const full = el.dataset.fit ?? '';
  el.style.fontSize = '';
  if (el.textContent !== full) el.textContent = full;
  el.title = '';
  // the text's own width against the label's, unrounded (scrollWidth and clientWidth are whole pixels)
  const range = document.createRange();
  const over = () => {
    range.selectNodeContents(el);
    return el.scrollWidth > el.clientWidth || range.getBoundingClientRect().width > el.getBoundingClientRect().width + 0.01;
  };
  if (!el.clientWidth || !over()) return;
  const base = parseFloat(getComputedStyle(el).fontSize);
  // data-fit-min: a floor in px below which the label shortens instead of shrinking (review R16 S4)
  const floor = Math.min(base, Math.max(base * MIN_SCALE, Number(el.dataset.fitMin) || 0));
  let size = base;
  while (over() && size > floor) {
    size = Math.max(floor, size - 0.5);
    el.style.fontSize = `${size}px`;
  }
  if (!over()) return;
  // shorten: the longest start of the text that fits with an ellipsis
  let lo = 0, hi = full.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    el.textContent = full.slice(0, mid).trimEnd() + '…';
    if (over()) hi = mid - 1; else lo = mid;
  }
  el.textContent = full.slice(0, lo).trimEnd() + '…';
  el.title = full;
}

export function fitAll(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-fit]').forEach(fit);
  // a row marked data-fit-row sets every label at the size its smallest needed (review R15 S5: the Treatment tiles)
  root.querySelectorAll<HTMLElement>('[data-fit-row]').forEach((row) => {
    const ls = [...row.querySelectorAll<HTMLElement>('[data-fit]')];
    if (ls.length < 2 || !ls.some((l) => l.style.fontSize)) return;
    const min = Math.min(...ls.map((l) => parseFloat(getComputedStyle(l).fontSize)));
    for (const l of ls) if (parseFloat(getComputedStyle(l).fontSize) > min) l.style.fontSize = `${min}px`;
  });
}
