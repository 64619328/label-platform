"use client";

import { useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { ImageViewer } from "@/components/ImageViewer";
import {
  DISPLAY_GRID_COLUMNS,
  DISPLAY_GRID_ROWS,
  autoFillFrames,
  canPlaceFrame,
  findAvailableGrid,
  findOverlappingFrameIds,
  frameToGrid,
  gridToFrame,
  snapFrameToGrid
} from "@/lib/display-layout";
import type { DisplayConfig, DisplayFrame, DisplayFrameType } from "@/lib/types";
import { uid } from "@/lib/utils";

type Props = {
  value: DisplayConfig;
  onChange: (value: DisplayConfig) => void;
  sampleImageUrls: string[];
  sampleSourceData?: Record<string, unknown>;
};

type DragMode = "move" | "resize";

const defaultFrames: DisplayFrame[] = [
  { id: "frame_main_image", type: "image", label: "主图", bindingKey: "image_1", x: 0, y: 0, w: 58.3333, h: 62.5, fit: "contain", allowFullscreen: true },
  { id: "frame_ref_image", type: "image", label: "参考图", bindingKey: "image_2", x: 58.3333, y: 0, w: 41.6667, h: 62.5, fit: "contain", allowFullscreen: true },
  { id: "frame_text", type: "text", label: "辅助文本", bindingKey: "prompt", x: 0, y: 62.5, w: 100, h: 37.5, allowFullscreen: false }
];

export function DisplayLayoutBuilder({ value, onChange, sampleImageUrls, sampleSourceData }: Props) {
  const [selectedId, setSelectedId] = useState(value.frames?.[0]?.id ?? defaultFrames[0].id);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [layoutMessage, setLayoutMessage] = useState("");
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const config = normalizeDisplayConfig(value);
  const selected = config.frames?.find((frame) => frame.id === selectedId) ?? config.frames?.[0];
  const bindingOptions = useMemo(() => buildBindingOptions(sampleImageUrls, sampleSourceData), [sampleImageUrls, sampleSourceData]);
  const overlappingIds = useMemo(() => findOverlappingFrameIds(config.frames ?? []), [config.frames]);

  function emit(next: DisplayConfig) {
    onChange(normalizeDisplayConfig(next));
  }

  function updateFrame(frameId: string, patch: Partial<DisplayFrame>, message = "展示框之间不能重叠") {
    const nextFrames = config.frames?.map((frame) => (frame.id === frameId ? snapFrameToGrid({ ...frame, ...patch }) : frame)) ?? [];
    const candidate = nextFrames.find((frame) => frame.id === frameId);
    if (candidate && !canPlaceFrame(nextFrames.filter((frame) => frame.id !== frameId), candidate)) {
      setLayoutMessage(message);
      return false;
    }
    setLayoutMessage("");
    emit({
      ...config,
      frames: nextFrames
    });
    return true;
  }

  function addFrame(type: DisplayFrameType) {
    const count = config.frames?.length ?? 0;
    const bindingKey = type === "text" ? bindingOptions.find((option) => option.type === "text")?.key ?? "prompt" : `${type}_${type === "image" ? Math.min(count + 1, 4) : 1}`;
    const grid = findAvailableGrid(config.frames, type === "text" ? 4 : 3, type === "text" ? 2 : 3);
    const frame: DisplayFrame = {
      id: uid("frame"),
      type,
      label: type === "image" ? "图片框" : type === "video" ? "视频框" : "文本框",
      bindingKey,
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      fit: type === "text" ? undefined : "contain",
      allowFullscreen: type !== "text"
    };
    const nextFrame = gridToFrame(frame, grid);
    if (!canPlaceFrame(config.frames, nextFrame)) {
      setLayoutMessage("当前画布没有足够空位，请先删除或缩小其他展示框");
      return;
    }
    emit({ ...config, frames: [...(config.frames ?? []), nextFrame] });
    setLayoutMessage("");
    setSelectedId(nextFrame.id);
  }

  function removeFrame(frameId: string) {
    const nextFrames = config.frames?.filter((frame) => frame.id !== frameId) ?? [];
    emit({ ...config, frames: nextFrames });
    setSelectedId(nextFrames[0]?.id ?? "");
  }

  function fillCanvas() {
    emit({ ...config, frames: autoFillFrames(config.frames) });
    setLayoutMessage("已按网格自动填满画布");
  }

  function startDrag(event: PointerEvent<HTMLDivElement>, frame: DisplayFrame, dragMode: DragMode) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(frame.id);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const startX = Math.round(((event.clientX - rect.left) / rect.width) * DISPLAY_GRID_COLUMNS);
    const startY = Math.round(((event.clientY - rect.top) / rect.height) * DISPLAY_GRID_ROWS);
    const startGrid = frameToGrid(frame);

    function move(pointerEvent: globalThis.PointerEvent) {
      const nextX = Math.round(((pointerEvent.clientX - rect.left) / rect.width) * DISPLAY_GRID_COLUMNS);
      const nextY = Math.round(((pointerEvent.clientY - rect.top) / rect.height) * DISPLAY_GRID_ROWS);
      const dx = nextX - startX;
      const dy = nextY - startY;
      if (dragMode === "move") {
        const nextFrame = gridToFrame(frame, {
          ...startGrid,
          col: clamp(startGrid.col + dx, 0, DISPLAY_GRID_COLUMNS - startGrid.colSpan),
          row: clamp(startGrid.row + dy, 0, DISPLAY_GRID_ROWS - startGrid.rowSpan)
        });
        updateFrame(frame.id, nextFrame);
      } else {
        const nextFrame = gridToFrame(frame, {
          ...startGrid,
          colSpan: clamp(startGrid.colSpan + dx, 1, DISPLAY_GRID_COLUMNS - startGrid.col),
          rowSpan: clamp(startGrid.rowSpan + dy, 1, DISPLAY_GRID_ROWS - startGrid.row)
        });
        updateFrame(frame.id, nextFrame);
      }
    }

    function stop() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  return (
    <div className="layout-builder">
      <div className="row between">
        <div>
          <h3>标注对象展示布局</h3>
          <p className="muted">先拖出每条数据默认看到的图片、视频和文本框，再进入标签配置。</p>
          <p className="muted">画布按 {DISPLAY_GRID_COLUMNS} × {DISPLAY_GRID_ROWS} 网格吸附，框之间不可重叠。</p>
        </div>
        <div className="segmented-control">
          <button className={mode === "edit" ? "active" : ""} onClick={() => setMode("edit")}>编辑布局</button>
          <button className={mode === "preview" ? "active" : ""} onClick={() => setMode("preview")}>预览模式</button>
        </div>
      </div>

      {mode === "preview" ? (
        <div className="layout-preview-panel">
          <ImageViewer imageUrls={sampleImageUrls} sourceData={sampleSourceData} displayConfig={config} compact />
        </div>
      ) : (
        <div className="layout-builder-grid">
          <aside className="layout-palette">
            <strong>展示框</strong>
            <button onClick={() => addFrame("image")}>添加图片框</button>
            <button onClick={() => addFrame("video")}>添加视频框</button>
            <button onClick={() => addFrame("text")}>添加文本框</button>
            <button onClick={fillCanvas}>自动填满画布</button>
            {layoutMessage ? <p className={layoutMessage.includes("不能重叠") || layoutMessage.includes("没有足够") ? "field-error-message" : "muted"}>{layoutMessage}</p> : null}
            <div className="layout-frame-list">
              {(config.frames ?? []).map((frame) => (
                <div key={frame.id} className={overlappingIds.has(frame.id) ? "layout-frame-list-item invalid" : "layout-frame-list-item"}>
                  <button className={frame.id === selected?.id ? "active" : ""} onClick={() => setSelectedId(frame.id)}>
                    {frame.label}
                    <span>{frame.type}</span>
                  </button>
                  <button className="layout-delete-button" onClick={() => removeFrame(frame.id)} aria-label={`删除${frame.label}`}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          </aside>

          <div className={`layout-edit-canvas ratio-${(config.canvasRatio ?? "16:9").replace(":", "-")}`} ref={canvasRef}>
            {(config.frames ?? []).map((frame) => (
              <div
                className={frame.id === selected?.id ? "layout-frame selected" : "layout-frame"}
                key={frame.id}
                style={{ left: `${frame.x}%`, top: `${frame.y}%`, width: `${frame.w}%`, height: `${frame.h}%` }}
                onPointerDown={(event) => startDrag(event, frame, "move")}
              >
                <span>{frame.label}</span>
                <small>{bindingOptions.find((option) => option.key === frame.bindingKey)?.label ?? frame.bindingKey}</small>
                <small>{formatGridLabel(frame)}</small>
                <div className="layout-resize-handle" onPointerDown={(event) => startDrag(event, frame, "resize")} />
              </div>
            ))}
          </div>

          <aside className="layout-properties">
            {selected ? (
              <>
                <strong>框属性</strong>
                <div className="field">
                  <label>名称</label>
                  <input value={selected.label} onChange={(event) => updateFrame(selected.id, { label: event.target.value })} />
                </div>
                <div className="field">
                  <label>类型</label>
                  <select value={selected.type} onChange={(event) => updateFrame(selected.id, { type: event.target.value as DisplayFrameType, allowFullscreen: event.target.value !== "text" })}>
                    <option value="image">图片框</option>
                    <option value="video">视频框</option>
                    <option value="text">文本框</option>
                  </select>
                </div>
                <div className="field">
                  <label>绑定字段</label>
                  <select value={selected.bindingKey} onChange={(event) => updateFrame(selected.id, { bindingKey: event.target.value })}>
                    {bindingOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                {selected.type !== "text" ? (
                  <>
                    <div className="field">
                      <label>适配方式</label>
                      <select value={selected.fit ?? "contain"} onChange={(event) => updateFrame(selected.id, { fit: event.target.value as DisplayFrame["fit"] })}>
                        <option value="contain">完整显示</option>
                        <option value="cover">填充裁切</option>
                      </select>
                    </div>
                    <label className="row">
                      <input
                        style={{ width: "auto" }}
                        type="checkbox"
                        checked={selected.allowFullscreen !== false}
                        onChange={(event) => updateFrame(selected.id, { allowFullscreen: event.target.checked })}
                      />
                      点击后进入全屏细节查看
                    </label>
                  </>
                ) : null}
                <div className="grid four compact-fields">
                  <NumberField label="列" value={frameToGrid(selected).col + 1} min={1} max={DISPLAY_GRID_COLUMNS} onChange={(col) => updateFrame(selected.id, gridToFrame(selected, { ...frameToGrid(selected), col: col - 1 }))} />
                  <NumberField label="行" value={frameToGrid(selected).row + 1} min={1} max={DISPLAY_GRID_ROWS} onChange={(row) => updateFrame(selected.id, gridToFrame(selected, { ...frameToGrid(selected), row: row - 1 }))} />
                  <NumberField label="宽" value={frameToGrid(selected).colSpan} min={1} max={DISPLAY_GRID_COLUMNS} onChange={(colSpan) => updateFrame(selected.id, gridToFrame(selected, { ...frameToGrid(selected), colSpan }))} />
                  <NumberField label="高" value={frameToGrid(selected).rowSpan} min={1} max={DISPLAY_GRID_ROWS} onChange={(rowSpan) => updateFrame(selected.id, gridToFrame(selected, { ...frameToGrid(selected), rowSpan }))} />
                </div>
                <button className="danger" onClick={() => removeFrame(selected.id)}>
                  删除当前框
                </button>
              </>
            ) : (
              <div className="empty">请选择一个展示框</div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}

function normalizeDisplayConfig(value: DisplayConfig): DisplayConfig {
  return {
    ...value,
    layoutMode: "custom",
    imageDataMode: value.imageDataMode ?? "multi_image",
    multiImageDisplayMode: value.multiImageDisplayMode ?? "parallel",
    enableDoubleClickZoom: value.enableDoubleClickZoom ?? true,
    zoomDisplayMode: value.zoomDisplayMode ?? "fullscreen",
    canvasRatio: value.canvasRatio ?? "16:9",
    detailViewer: value.detailViewer ?? { enabled: true, navigation: "all_media" },
    frames: value.frames?.length ? value.frames.map(snapFrameToGrid) : defaultFrames
  };
}

function formatGridLabel(frame: DisplayFrame) {
  const grid = frameToGrid(frame);
  return `${grid.col + 1},${grid.row + 1} · ${grid.colSpan}×${grid.rowSpan}`;
}

function buildBindingOptions(imageUrls: string[], sourceData?: Record<string, unknown>) {
  const imageCount = Math.max(4, imageUrls.length);
  const imageOptions = Array.from({ length: imageCount }, (_, index) => ({
    key: `image_${index + 1}`,
    label: `图片 ${index + 1}`,
    type: "image"
  }));
  const videoOptions = [
    { key: "video_1", label: "视频 1", type: "video" },
    { key: "video_2", label: "视频 2", type: "video" }
  ];
  const sourceOptions = Object.keys(sourceData ?? {}).map((key) => ({
    key,
    label: `字段：${key}`,
    type: inferBindingType(sourceData?.[key])
  }));
  return [...imageOptions, ...videoOptions, ...sourceOptions];
}

function inferBindingType(value: unknown) {
  if (typeof value !== "string") return "text";
  if (/\.(mp4|webm|mov)(\?|$)/i.test(value)) return "video";
  if (/^https?:\/\//i.test(value)) return "image";
  return "text";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
