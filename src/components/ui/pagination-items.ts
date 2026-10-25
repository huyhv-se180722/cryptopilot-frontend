/** The pages to show: the first, the last and two around the current one. */
export function pageItems(page: number, pages: number): (number | 'gap')[] {
  const shown = new Set(
    [1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages),
  );
  const sorted = [...shown].sort((a, b) => a - b);
  const items: (number | 'gap')[] = [];
  sorted.forEach((n, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined && n - previous > 1) items.push('gap');
    items.push(n);
  });
  return items;
}
