/** Contact sheet geometry, shared by the native and web renderers. */

export const SHEET = { columns: 3, cell: 560, gap: 28, margin: 56, label: 56, header: 150 } as const;

export function sheetSize(count: number) {
  const rows = Math.ceil(count / SHEET.columns);
  const cellHeight = Math.round((SHEET.cell * 5) / 4);
  return {
    width: SHEET.margin * 2 + SHEET.columns * SHEET.cell + (SHEET.columns - 1) * SHEET.gap,
    height: SHEET.header + SHEET.margin + rows * (cellHeight + SHEET.label + SHEET.gap),
    cellHeight,
  };
}
