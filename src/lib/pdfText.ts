/** One run of text on a line, and where it starts across the page. */
export interface Cell {
  x: number;
  s: string;
}

export type Line = Cell[];

/**
 * A practice sheet exported from a spreadsheet keeps its columns as positions, not structure:
 * time down the left, the drill in the middle, the boxes you fill in on the right. Rows are
 * rebuilt by height on the page and each keeps where its pieces start, which is what lets the
 * importer tell a drill's description from the question it asks.
 *
 * pdf.js is loaded only here, on demand, so nobody pays for it until they import a file.
 */
export async function pdfLines(file: File): Promise<Line[]> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const lines: Line[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const rows = new Map<number, Cell[]>();
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5] / 3) * 3;
      const row = rows.get(y) ?? [];
      row.push({ x: item.transform[4], s: item.str.trim() });
      rows.set(y, row);
    }
    for (const y of [...rows.keys()].sort((a, b) => b - a)) {
      lines.push(rows.get(y)!.sort((a, b) => a.x - b.x));
    }
  }
  return lines;
}

/** Pasted or plain text has no columns, so every line is one cell. */
export function textLines(text: string): Line[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => [{ x: 0, s }]);
}
