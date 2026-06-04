"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createReviewBatchWithResult } from "@/lib/task-actions";
import type { ReviewSamplingMode, Task } from "@/lib/types";

type Props = {
  task: Task;
  currentUserId: string;
  onTaskChange: (task: Task) => void;
  onClose: () => void;
};

export function ReviewBatchDialog({ task, currentUserId, onTaskChange, onClose }: Props) {
  const pendingPackages = task.packages.filter((pkg) => pkg.status === "pending_review");
  const [packageId, setPackageId] = useState(pendingPackages[0]?.id ?? "");
  const [samplingMode, setSamplingMode] = useState<ReviewSamplingMode>("random");
  const [sampleCount, setSampleCount] = useState(2);
  const [labelConfigId, setLabelConfigId] = useState(task.labelConfigs[0]?.id ?? "");
  const [labelOptionIds, setLabelOptionIds] = useState<string[]>([]);
  const [manualIds, setManualIds] = useState<string[]>([]);
  const router = useRouter();

  const selectedPackage = pendingPackages.find((pkg) => pkg.id === packageId) ?? pendingPackages[0];
  const packageItems = selectedPackage ? task.formalItems.filter((item) => selectedPackage.itemIds.includes(item.id)) : [];
  const selectedLabel = task.labelConfigs.find((config) => config.id === labelConfigId) ?? task.labelConfigs[0];

  function createBatch() {
    if (!selectedPackage) return;
    const result = createReviewBatchWithResult(
      task,
      selectedPackage.id,
      samplingMode,
      currentUserId,
      sampleCount,
      manualIds,
      labelConfigId,
      labelOptionIds
    );
    onTaskChange(result.task);
    if (result.batch) {
      router.push(`/requester/review/${result.task.id}/batches/${result.batch.id}`);
    }
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card review-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="row between">
          <div>
            <h2>创建抽检批次</h2>
            <p className="muted">{task.title}</p>
          </div>
          <button onClick={onClose}>关闭</button>
        </div>
        {pendingPackages.length === 0 ? (
          <div className="empty">当前任务暂无待验收子任务包</div>
        ) : (
          <div className="grid">
            <div className="grid three">
              <div className="field">
                <label>子任务包</label>
                <select value={selectedPackage?.id ?? ""} onChange={(event) => setPackageId(event.target.value)}>
                  {pendingPackages.map((pkg, index) => (
                    <option key={pkg.id} value={pkg.id}>
                      子任务包 {index + 1} · {pkg.itemIds.length} 条
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>抽检方式</label>
                <select value={samplingMode} onChange={(event) => setSamplingMode(event.target.value as ReviewSamplingMode)}>
                  <option value="random">随机抽检</option>
                  <option value="label_filter">按标签筛选</option>
                  <option value="manual">手动选择</option>
                </select>
              </div>
              <div className="field">
                <label>抽检条数</label>
                <input type="number" min="1" max={packageItems.length || 1} value={sampleCount} onChange={(event) => setSampleCount(Number(event.target.value))} />
              </div>
            </div>
            <div className="field">
              <label>筛选问题组</label>
              <select value={labelConfigId} onChange={(event) => setLabelConfigId(event.target.value)}>
                {task.labelConfigs.map((config) => (
                  <option key={config.id} value={config.id}>
                    {config.title}
                  </option>
                ))}
              </select>
            </div>
            {samplingMode === "label_filter" && selectedLabel ? (
              <div className="row">
                {selectedLabel.options.map((option) => (
                  <label key={option.id} className="badge">
                    <input
                      style={{ width: "auto" }}
                      type="checkbox"
                      checked={labelOptionIds.includes(option.id)}
                      onChange={() =>
                        setLabelOptionIds(
                          labelOptionIds.includes(option.id)
                            ? labelOptionIds.filter((id) => id !== option.id)
                            : [...labelOptionIds, option.id]
                        )
                      }
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            ) : null}
            {samplingMode === "manual" ? (
              <div className="review-manual-grid">
                {packageItems.map((item, index) => (
                  <label key={item.id} className="badge">
                    <input
                      style={{ width: "auto" }}
                      type="checkbox"
                      checked={manualIds.includes(item.id)}
                      onChange={() => setManualIds(manualIds.includes(item.id) ? manualIds.filter((id) => id !== item.id) : [...manualIds, item.id])}
                    />
                    数据 {index + 1}
                  </label>
                ))}
              </div>
            ) : null}
            <button className="primary" onClick={createBatch}>
              创建抽检批次
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
