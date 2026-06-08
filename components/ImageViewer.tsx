"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { DisplayConfig, DisplayFrame } from "@/lib/types";

type Props = {
  imageUrls: string[];
  displayConfig: DisplayConfig;
  sourceData?: Record<string, unknown>;
  compact?: boolean;
};

type ResolvedFrame = DisplayFrame & {
  value: string;
};

const ratioClass = {
  "16:9": "ratio-16-9",
  "4:3": "ratio-4-3",
  "1:1": "ratio-1-1",
  free: "ratio-free"
} as const;

export function ImageViewer({ imageUrls, displayConfig, sourceData, compact = false }: Props) {
  const [active, setActive] = useState(0);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const customFrames = displayConfig.layoutMode === "custom" && displayConfig.frames?.length;
  const resolvedFrames = useMemo(
    () => (displayConfig.frames ?? []).map((frame) => resolveFrame(frame, imageUrls, sourceData)).filter((frame): frame is ResolvedFrame => Boolean(frame?.value)),
    [displayConfig.frames, imageUrls, sourceData]
  );
  const detailFrames = resolvedFrames.filter((frame) => frame.type !== "text" && frame.allowFullscreen !== false);

  if (customFrames) {
    const ratio = displayConfig.canvasRatio ?? "16:9";
    const activeDetail = detailIndex === null ? null : detailFrames[detailIndex];
    const detailEnabled = displayConfig.detailViewer?.enabled ?? true;

    function openDetail(frame: ResolvedFrame) {
      if (!detailEnabled || frame.type === "text" || frame.allowFullscreen === false) return;
      const index = detailFrames.findIndex((item) => item.id === frame.id);
      if (index >= 0) setDetailIndex(index);
    }

    function moveDetail(step: number) {
      if (!detailFrames.length || detailIndex === null) return;
      setDetailIndex((detailIndex + step + detailFrames.length) % detailFrames.length);
    }

    return (
      <div className={compact ? "image-viewer custom-object-viewer compact" : "image-viewer custom-object-viewer"}>
        <div className={`display-canvas ${ratioClass[ratio]}`} aria-label="自定义标注对象展示">
          {displayConfig.frames?.map((frame) => {
            const resolved = resolveFrame(frame, imageUrls, sourceData);
            return (
              <DisplayFrameBox
                key={frame.id}
                frame={frame}
                value={resolved?.value ?? ""}
                onOpen={resolved ? () => openDetail(resolved) : undefined}
              />
            );
          })}
        </div>

        {activeDetail ? (
          <div className="modal fullscreen detail-viewer-modal" onClick={() => setDetailIndex(null)}>
            <div className="detail-viewer-card" onClick={(event) => event.stopPropagation()}>
              <div className="row between detail-viewer-head">
                <div>
                  <strong>{activeDetail.label}</strong>
                  <span className="muted">
                    {detailIndex! + 1} / {detailFrames.length}
                  </span>
                </div>
                <button onClick={() => setDetailIndex(null)}>关闭</button>
              </div>
              <button className="detail-nav previous" disabled={detailFrames.length <= 1} onClick={() => moveDetail(-1)}>
                ←
              </button>
              <div className="detail-viewer-media">
                {activeDetail.type === "video" ? (
                  <video src={activeDetail.value} controls autoPlay />
                ) : (
                  <img src={activeDetail.value} alt={activeDetail.label} />
                )}
              </div>
              <button className="detail-nav next" disabled={detailFrames.length <= 1} onClick={() => moveDetail(1)}>
                →
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  const isCarousel =
    displayConfig.imageDataMode === "multi_image" && displayConfig.multiImageDisplayMode === "carousel";
  const shown = isCarousel ? [imageUrls[active] ?? imageUrls[0]] : imageUrls;

  function openZoom(url: string) {
    if (displayConfig.enableDoubleClickZoom) setZoomUrl(url);
  }

  return (
    <div className="image-viewer">
      <div className="image-strip">
        {shown.map((url) => (
          <ImageBox key={url} url={url} onDoubleClick={() => openZoom(url)} />
        ))}
      </div>

      {isCarousel && imageUrls.length > 1 ? (
        <div className="row between">
          <button onClick={() => setActive(Math.max(0, active - 1))} disabled={active === 0}>
            ← 上一张
          </button>
          <span className="muted">
            {active + 1} / {imageUrls.length}
          </span>
          <button onClick={() => setActive(Math.min(imageUrls.length - 1, active + 1))} disabled={active >= imageUrls.length - 1}>
            下一张 →
          </button>
          <div className="thumbs">
            {imageUrls.map((url, index) => (
              <img
                key={url}
                src={url}
                alt=""
                className={index === active ? "thumb active" : "thumb"}
                onClick={() => setActive(index)}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {zoomUrl ? (
        <div className={displayConfig.zoomDisplayMode === "fullscreen" ? "modal fullscreen" : "modal"} onClick={() => setZoomUrl(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="row between" style={{ marginBottom: 8 }}>
              <span className="muted">双击放大预览</span>
              <button onClick={() => setZoomUrl(null)}>关闭</button>
            </div>
            <img src={zoomUrl} alt="放大预览" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DisplayFrameBox({ frame, value, onOpen }: { frame: DisplayFrame; value: string; onOpen?: () => void }) {
  const [failed, setFailed] = useState(false);
  const style: CSSProperties = {
    left: `${frame.x}%`,
    top: `${frame.y}%`,
    width: `${frame.w}%`,
    height: `${frame.h}%`
  };

  return (
    <div className={`display-frame display-frame-${frame.type}`} style={style}>
      <div className="display-frame-label">{frame.label}</div>
      <div className="display-frame-body" onDoubleClick={onOpen} onClick={onOpen}>
        {!value ? <span className="muted">未绑定数据</span> : null}
        {value && frame.type === "text" ? <p>{value}</p> : null}
        {value && frame.type === "image" && !failed ? (
          <img
            src={value}
            alt={frame.label}
            style={{ objectFit: frame.fit ?? "contain" }}
            onError={() => setFailed(true)}
          />
        ) : null}
        {value && frame.type === "video" && !failed ? (
          <video src={value} controls style={{ objectFit: frame.fit ?? "contain" }} onError={() => setFailed(true)} />
        ) : null}
        {failed ? <span className="muted">加载失败</span> : null}
      </div>
    </div>
  );
}

export function resolveFrame(frame: DisplayFrame, imageUrls: string[], sourceData?: Record<string, unknown>) {
  const value = getBoundValue(frame.bindingKey, imageUrls, sourceData);
  return value ? { ...frame, value } : null;
}

export function getBoundValue(bindingKey: string, imageUrls: string[], sourceData?: Record<string, unknown>) {
  const imageMatch = bindingKey.match(/^image_(\d+)$/);
  if (imageMatch) {
    return imageUrls[Number(imageMatch[1]) - 1] ?? "";
  }
  const value = sourceData?.[bindingKey];
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string");
    return typeof first === "string" ? first : JSON.stringify(value);
  }
  if (value && typeof value === "object") return JSON.stringify(value);
  return "";
}

function ImageBox({ url, onDoubleClick }: { url: string; onDoubleClick: () => void }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="image-frame" onDoubleClick={onDoubleClick}>
      {failed ? (
        <span className="muted">图片加载失败</span>
      ) : (
        <img src={url} alt="待标注图片" onError={() => setFailed(true)} />
      )}
    </div>
  );
}
