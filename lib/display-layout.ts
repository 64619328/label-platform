import type { DisplayConfig, DisplayFrame } from "./types";

export const DISPLAY_GRID_COLUMNS = 12;
export const DISPLAY_GRID_ROWS = 8;

const unitX = 100 / DISPLAY_GRID_COLUMNS;
const unitY = 100 / DISPLAY_GRID_ROWS;
const overlapTolerance = 0.01;

export type GridFrame = {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
};

export function frameToGrid(frame: DisplayFrame): GridFrame {
  return {
    col: clamp(Math.round(frame.x / unitX), 0, DISPLAY_GRID_COLUMNS - 1),
    row: clamp(Math.round(frame.y / unitY), 0, DISPLAY_GRID_ROWS - 1),
    colSpan: clamp(Math.round(frame.w / unitX), 1, DISPLAY_GRID_COLUMNS),
    rowSpan: clamp(Math.round(frame.h / unitY), 1, DISPLAY_GRID_ROWS)
  };
}

export function gridToFrame(frame: DisplayFrame, grid: GridFrame): DisplayFrame {
  const col = clamp(grid.col, 0, DISPLAY_GRID_COLUMNS - 1);
  const row = clamp(grid.row, 0, DISPLAY_GRID_ROWS - 1);
  const colSpan = clamp(grid.colSpan, 1, DISPLAY_GRID_COLUMNS - col);
  const rowSpan = clamp(grid.rowSpan, 1, DISPLAY_GRID_ROWS - row);
  return {
    ...frame,
    x: roundPercent(col * unitX),
    y: roundPercent(row * unitY),
    w: roundPercent(colSpan * unitX),
    h: roundPercent(rowSpan * unitY)
  };
}

export function snapFrameToGrid(frame: DisplayFrame): DisplayFrame {
  return gridToFrame(frame, frameToGrid(frame));
}

export function framesOverlap(a: DisplayFrame, b: DisplayFrame) {
  return (
    a.x + a.w > b.x + overlapTolerance &&
    b.x + b.w > a.x + overlapTolerance &&
    a.y + a.h > b.y + overlapTolerance &&
    b.y + b.h > a.y + overlapTolerance
  );
}

export function findOverlappingFrameIds(frames: DisplayFrame[] = []) {
  const ids = new Set<string>();
  for (let i = 0; i < frames.length; i += 1) {
    for (let j = i + 1; j < frames.length; j += 1) {
      if (framesOverlap(frames[i], frames[j])) {
        ids.add(frames[i].id);
        ids.add(frames[j].id);
      }
    }
  }
  return ids;
}

export function validateDisplayConfigLayout(displayConfig: DisplayConfig) {
  const frames = displayConfig.frames ?? [];
  if (displayConfig.layoutMode !== "custom") return null;
  if (frames.length === 0) return "请至少添加一个展示框";
  if (findOverlappingFrameIds(frames).size > 0) return "展示框之间不能重叠，请调整后再继续";
  return null;
}

export function canPlaceFrame(frames: DisplayFrame[] = [], candidate: DisplayFrame) {
  return !frames.some((frame) => frame.id !== candidate.id && framesOverlap(frame, candidate));
}

export function autoFillFrames(frames: DisplayFrame[] = []) {
  if (frames.length === 0) return frames;
  const columns = Math.ceil(Math.sqrt(frames.length));
  const rows = Math.ceil(frames.length / columns);
  const baseColSpan = Math.floor(DISPLAY_GRID_COLUMNS / columns);
  const baseRowSpan = Math.floor(DISPLAY_GRID_ROWS / rows);

  return frames.map((frame, index) => {
    const colIndex = index % columns;
    const rowIndex = Math.floor(index / columns);
    const col = colIndex * baseColSpan;
    const row = rowIndex * baseRowSpan;
    const colSpan = colIndex === columns - 1 ? DISPLAY_GRID_COLUMNS - col : baseColSpan;
    const rowSpan = rowIndex === rows - 1 ? DISPLAY_GRID_ROWS - row : baseRowSpan;
    return gridToFrame(frame, { col, row, colSpan, rowSpan });
  });
}

export function findAvailableGrid(frames: DisplayFrame[] = [], preferredColSpan = 4, preferredRowSpan = 3): GridFrame {
  const colSpan = clamp(preferredColSpan, 1, DISPLAY_GRID_COLUMNS);
  const rowSpan = clamp(preferredRowSpan, 1, DISPLAY_GRID_ROWS);
  const probe: DisplayFrame = {
    id: "__probe__",
    type: "image",
    label: "",
    bindingKey: "",
    x: 0,
    y: 0,
    w: 0,
    h: 0
  };

  for (let row = 0; row <= DISPLAY_GRID_ROWS - rowSpan; row += 1) {
    for (let col = 0; col <= DISPLAY_GRID_COLUMNS - colSpan; col += 1) {
      const candidate = gridToFrame(probe, { col, row, colSpan, rowSpan });
      if (canPlaceFrame(frames, candidate)) return { col, row, colSpan, rowSpan };
    }
  }

  return { col: 0, row: 0, colSpan, rowSpan };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function roundPercent(value: number) {
  return Number(value.toFixed(4));
}
