"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ImageViewer } from "@/components/ImageViewer";
import { SourceDataMeta } from "@/components/SourceDataMeta";
import { annotationReviewStatusLabels, issueTypeLabels, statusBadgeClass } from "@/lib/labels";
import { getCurrentUser, getTasks, saveTasks } from "@/lib/storage";
import { approveReviewItemAndMaybePackage, rejectReviewItem } from "@/lib/task-actions";
import type { AnnotationItem, RejectionIssueType, Task } from "@/lib/types";

type LayoutMode = "masonry" | "single";

export default function RequesterReviewBatchPage() {
  const params = useParams<{ taskId: string; batchId: string }>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("masonry");
  const [rejectDraft, setRejectDraft] = useState<Record<string, { issue: RejectionIssueType; reason: string }>>({});

  useEffect(() => {
    setTasks(getTasks());
    setLoaded(true);
  }, []);

  const currentUser = getCurrentUser();
  const task = tasks.find((item) => item.id === params.taskId && item.requesterId === currentUser.id);
  const batch = task?.reviewBatches.find((item) => item.id === params.batchId);
  const packageItem = task?.packages.find((item) => item.id === batch?.packageId);
  const sampledItems = useMemo(() => {
    if (!task || !batch) return [];
    return batch.sampledItemIds
      .map((itemId) => task.formalItems.find((item) => item.id === itemId))
      .filter((item): item is AnnotationItem => Boolean(item));
  }, [task, batch]);

  const approvedCount = sampledItems.filter((item) => item.reviewStatus === "approved").length;
  const rejectedCount = sampledItems.filter((item) => item.reviewStatus === "rejected").length;
  const masonryColumns = useMemo(() => {
    const columns: AnnotationItem[][] = [[], [], [], []];
    sampledItems.forEach((item, index) => {
      columns[index % columns.length].push(item);
    });
    return columns;
  }, [sampledItems]);

  function persist(nextTask: Task) {
    const nextTasks = tasks.map((item) => (item.id === nextTask.id ? nextTask : item));
    setTasks(nextTasks);
    saveTasks(nextTasks);
  }

  function approveItem(itemId: string) {
    if (!task || !batch) return;
    persist(approveReviewItemAndMaybePackage(task, batch.id, itemId));
  }

  function rejectItem(itemId: string) {
    if (!task || !batch) return;
    const draft = rejectDraft[itemId] ?? { issue: "label_error" as RejectionIssueType, reason: "" };
    if (!draft.reason.trim()) return;
    persist(rejectReviewItem(task, batch.id, batch.packageId, itemId, draft.issue, draft.reason));
  }

  if (!task || !batch) {
    return (
      <main className="review-workspace">
        <div className="review-workspace-top">
          <div>
            <h1>抽检批次</h1>
            <p>{loaded ? "未找到批次，或当前身份无权查看。" : "正在加载批次..."}</p>
          </div>
          <Link href="/requester/review">
            <button>返回验收列表</button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="review-workspace">
      <div className="review-workspace-top">
        <div>
          <span className="side-kicker">Review Batch</span>
          <h1>抽检批次 {batch.id}</h1>
          <p className="muted">
            {task.title} · {batch.samplingMode} · 通过 {approvedCount} · 驳回 {rejectedCount} · 样本 {sampledItems.length}
            {packageItem ? ` · 子任务包 ${packageItem.status}` : ""}
          </p>
        </div>
        <div className="row">
          <button className={layoutMode === "masonry" ? "primary" : ""} onClick={() => setLayoutMode("masonry")}>
            瀑布流
          </button>
          <button className={layoutMode === "single" ? "primary" : ""} onClick={() => setLayoutMode("single")}>
            单列
          </button>
          <Link href="/requester/review">
            <button>返回验收列表</button>
          </Link>
          <Link href={`/requester/tasks/${task.id}`}>
            <button>任务详情</button>
          </Link>
        </div>
      </div>

      <section className={layoutMode === "masonry" ? "review-masonry review-masonry-columns" : "review-masonry single"}>
        {layoutMode === "masonry"
          ? masonryColumns.map((column, columnIndex) => (
              <div className="review-masonry-column" key={columnIndex}>
                {column.map((item) => (
                  <ReviewCard
                    key={item.id}
                    item={item}
                    itemIndex={sampledItems.findIndex((sampledItem) => sampledItem.id === item.id)}
                    task={task}
                    draft={rejectDraft[item.id] ?? { issue: "label_error" as RejectionIssueType, reason: "" }}
                    onApprove={approveItem}
                    onReject={rejectItem}
                    onDraftChange={(nextDraft) => setRejectDraft({ ...rejectDraft, [item.id]: nextDraft })}
                  />
                ))}
              </div>
            ))
          : sampledItems.map((item, index) => (
              <ReviewCard
                key={item.id}
                item={item}
                itemIndex={index}
                task={task}
                draft={rejectDraft[item.id] ?? { issue: "label_error" as RejectionIssueType, reason: "" }}
                onApprove={approveItem}
                onReject={rejectItem}
                onDraftChange={(nextDraft) => setRejectDraft({ ...rejectDraft, [item.id]: nextDraft })}
              />
            ))}
      </section>
    </main>
  );
}

function ReviewCard({
  item,
  itemIndex,
  task,
  draft,
  onApprove,
  onReject,
  onDraftChange
}: {
  item: AnnotationItem;
  itemIndex: number;
  task: Task;
  draft: { issue: RejectionIssueType; reason: string };
  onApprove: (itemId: string) => void;
  onReject: (itemId: string) => void;
  onDraftChange: (draft: { issue: RejectionIssueType; reason: string }) => void;
}) {
  const isApproved = item.reviewStatus === "approved";
  return (
    <article className="review-card">
      <div className="row between">
        <div>
          <span className="market-task-id">标注对象 {String(itemIndex + 1).padStart(2, "0")}</span>
          <h2>{item.sourceData?.msg ? String(item.sourceData.msg) : item.id}</h2>
        </div>
        <span className={statusBadgeClass(item.reviewStatus)}>{annotationReviewStatusLabels[item.reviewStatus]}</span>
      </div>
      <ImageViewer imageUrls={item.imageUrls} displayConfig={task.displayConfig} />
      <SourceDataMeta item={item} />
      <AnnotationSummary task={task} item={item} />
      <div className="review-actions">
        <button disabled={isApproved} onClick={() => onApprove(item.id)}>
          {isApproved ? "已通过" : "通过"}
        </button>
        <select value={draft.issue} onChange={(event) => onDraftChange({ ...draft, issue: event.target.value as RejectionIssueType })}>
          {Object.entries(issueTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          placeholder="驳回原因"
          value={draft.reason}
          onChange={(event) => onDraftChange({ ...draft, reason: event.target.value })}
        />
        <button className="danger" onClick={() => onReject(item.id)}>
          驳回
        </button>
      </div>
    </article>
  );
}

function AnnotationSummary({ task, item }: { task: Task; item: AnnotationItem }) {
  return (
    <div className="review-labels">
      {task.labelConfigs.map((config) => {
        const value = item.annotationValues?.find((entry) => entry.labelConfigId === config.id)?.value;
        const ids = Array.isArray(value) ? value : value ? [value] : [];
        const labels = ids.map((id) => config.options.find((option) => option.id === id)?.label ?? id);
        return (
          <div key={config.id} className="review-label-row">
            <strong>{config.title}</strong>
            <span>{labels.length ? labels.join("、") : "未填写"}</span>
          </div>
        );
      })}
      {item.rejectionReason ? <span className="badge danger">驳回：{item.rejectionReason}</span> : null}
    </div>
  );
}
