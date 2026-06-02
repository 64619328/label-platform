"use client";

import { useState } from "react";
import type { DisplayConfig } from "@/lib/types";

type Props = {
  imageUrls: string[];
  displayConfig: DisplayConfig;
};

export function ImageViewer({ imageUrls, displayConfig }: Props) {
  const [active, setActive] = useState(0);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
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
