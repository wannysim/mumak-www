// 측정 표와 숫자 표기. 값 계산은 하지 않고 받은 값을 표로만 옮긴다.

import type { MeasureEvent } from './measure';
import type { DurationSummary, Size } from './raster-math';

export type TableRow = readonly [label: string, value: string];

export function renderKeyValueTable(table: HTMLTableElement, rows: readonly TableRow[]): void {
  const body = document.createElement('tbody');
  for (const [label, value] of rows) {
    const row = body.insertRow();
    const header = document.createElement('th');
    header.scope = 'row';
    header.textContent = label;
    const cell = document.createElement('td');
    cell.textContent = value;
    row.append(header, cell);
  }
  table.replaceChildren(body);
}

/** first: 로드 사건은 로드 1회 값, 래스터 사건은 첫 래스터(cold) 값. summary: 요약 키의 따뜻한 래스터. */
export type MeasureTableRow = {
  event: MeasureEvent;
  name: string;
  first: number | null;
  summary: DurationSummary | null;
};

const MEASURE_COLUMNS = [
  'measure 이름',
  '로드·첫 래스터 ms',
  '마지막 ms',
  '중앙값 ms',
  '최소 ms',
  '최대 ms',
  'n',
] as const;

export function renderMeasureTable(table: HTMLTableElement, rows: readonly MeasureTableRow[]): void {
  const head = document.createElement('thead');
  const headRow = head.insertRow();
  for (const column of MEASURE_COLUMNS) {
    const header = document.createElement('th');
    header.scope = 'col';
    header.textContent = column;
    headRow.append(header);
  }
  const body = document.createElement('tbody');
  for (const { event, name, first, summary } of rows) {
    const row = body.insertRow();
    row.dataset.event = event;
    const header = document.createElement('th');
    header.scope = 'row';
    header.textContent = name;
    row.append(header);
    const firstText = first === null ? '–' : formatMs(first);
    const values = summary
      ? [firstText, ...[summary.last, summary.median, summary.min, summary.max].map(formatMs), String(summary.count)]
      : [firstText, '–', '–', '–', '–', '0'];
    for (const value of values) row.insertCell().textContent = value;
  }
  table.replaceChildren(head, body);
}

function formatMs(value: number): string {
  return value.toFixed(1);
}

export function formatBytes(bytes: number): string {
  const exact = `${bytes.toLocaleString('en-US')} B`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MiB (${exact})`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB (${exact})`;
  return exact;
}

export function formatSize(size: Size): string {
  return `${formatNumber(size.width)}×${formatNumber(size.height)}`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
