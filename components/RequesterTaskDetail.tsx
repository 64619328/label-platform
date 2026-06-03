"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { ImageViewer } from "@/components/ImageViewer";
import { PackageBadge, TaskMeta } from "@/components/TaskMeta";
import { SourceDataMeta } from "@/components/SourceDataMeta";
import { issueTypeLabels } from "@/lib/labels";
import {
  approvePackage,
  approveAllPendingReviewPackages,
  approveReviewItem,
  cancelTask,
  createReviewBatch,
  handleAppeal,
  rejectReviewItem,
  selectQuote,
  taskStats
} from "@/lib/task-actions";
import type { AnnotationItem, DemoUser, RejectionIssueType, ReviewSamplingMode, Task } from "@/lib/types";
import { formatDate, money } from "@/lib/utils";

type Props = {
  task: Task;
  users: DemoUser[];
  operatorId: string;
  onTaskChange: (task: Task) => void;
  showCreationInfo?: boolean;
};

const creationModeLabels: Record<Task["creationMode"], string> = {
  from_scratch: "从 0 创建",
  from_history: "基于历史任务创建"
};

const entryModeLabels: Record<Task["entryMode"], string> = {
  trial_quote: "试标报价后进入正式标注",
  direct_formal: "直接进入正式标注"
};

const samplingModeLabels = {
  first_n: "前 N 条",
  random_n: "随机 N 条"
} as const;

const imageDataModeLabels: Record<Task["displayConfig"]["imageDataMode"], string> = {
  single_image: "单张图片",
  multi_image: "多张图片"
};

const multiImageDisplayModeLabels = {
  parallel: "全部并列展示",
  carousel: "单张展示 + 左右切换"
} as const;

const zoomDisplayModeLabels = {
  modal: "弹窗居中展示",
  fullscreen: "全屏沉浸展示"
} as const;

export function RequesterTaskDetail({ task, users, operatorId, onTaskChange, showCreationInfo = false }: Props) {
  const [sampleCount, setSampleCount] = useState(2);
  const [samplingMode, setSamplingMode] = useState<ReviewSamplingMode>("random");
  const [manualIds, setManualIds] = useState<string[]>([]);
  const [labelConfigId, setLabelConfigId] = useState("");
  const [labelOptionIds, setLabelOptionIds] = useState<string[]>([]);
  const [cancelReason, setCancelReason] = useState("");
  const [rejectDraft, setRejectDraft] = useState<Record<string, { issue: RejectionIssueType; reason: string }>>({});
  const [reviewQuoteId, setReviewQuoteId] = useState("");

  const stats = taskStats(task);
  const selectedLabel = task.labelConfigs.find((config) => config.id === labelConfigId) ?? task.labelConfigs[0];
  const assignedAnnotator = users.find((user) => user.id === task.assignedAnnotatorId);

  function chooseQuote(quoteId: string) {
    onTaskChange(selectQuote(task, quoteId));
  }

  function createBatch(packageId: string) {
    onTaskChange(createReviewBatch(task, packageId, samplingMode, operatorId, sampleCount, manualIds, labelConfigId, labelOptionIds));
    setManualIds([]);
  }

  function approveItem(batchId: string, itemId: string) {
    onTaskChange(approveReviewItem(task, batchId, itemId));
  }

  function rejectItem(batchId: string, packageId: string, itemId: string) {
    const draft = rejectDraft[itemId] ?? { issue: "label_error" as RejectionIssueType, reason: "" };
    if (!draft.reason.trim()) return;
    onTaskChange(rejectReviewItem(task, batchId, packageId, itemId, draft.issue, draft.reason));
  }

  function cancel() {
    if (!cancelReason.trim()) return;
    onTaskChange(cancelTask(task, cancelReason));
    setCancelReason("");
  }

  return (
    <div className="grid">
      <section className="panel grid">
        <div className="row between">
          <div>
            <h2>{task.title}</h2>
            <TaskMeta task={task} />
          </div>
          <div className="row">
            <span className="badge">截止 {formatDate(task.deadline)}</span>
            {task.status === "draft" ? (
              <Link href={`/requester/tasks/new?edit=${task.id}`}>
                <button className="primary">继续编辑草稿</button>
              </Link>
            ) : null}
          </div>
        </div>
        <p>{task.description}</p>
        <div className="grid two">
          <div className="item">
            <strong>标注规则</strong>
            <p className="muted">{task.rules}</p>
          </div>
          <div className="item">
            <strong>培训说明</strong>
            <p className="muted">{task.trainingContent}</p>
          </div>
        </div>
      </section>

      <section className="stats">
        <Stat label="正式数据" value={task.formalItems.length} />
        <Stat label="已标注" value={stats.submittedItems} />
        <Stat label="通过数据" value={stats.approvedItems} />
        <Stat label="预计结算" value={money(stats.amount)} />
      </section>

      {showCreationInfo ? (
        <section className="panel grid">
          <h2>创建任务信息</h2>
          <div className="grid three">
            <InfoItem label="任务 ID" value={task.id} />
            <InfoItem label="创建者 ID" value={task.requesterId} />
            <InfoItem label="创建时间" value={formatDate(task.createdAt)} />
            <InfoItem label="更新时间" value={formatDate(task.updatedAt)} />
            <InfoItem label="创建方式" value={creationModeLabels[task.creationMode]} />
            <InfoItem label="历史任务" value={task.historyTaskId ?? "无"} />
            <InfoItem label="任务进入方式" value={entryModeLabels[task.entryMode]} />
            <InfoItem label="指定标注方" value={assignedAnnotator ? `${assignedAnnotator.name}（${assignedAnnotator.id}）` : task.assignedAnnotatorId ?? "不指定"} />
            <InfoItem label="单价" value={money(task.quotedUnitPrice ?? task.manualUnitPrice ?? 0)} />
            <InfoItem label="截止时间" value={formatDate(task.deadline)} />
            <InfoItem label="试标抽取方式" value={task.trialSamplingMode ? samplingModeLabels[task.trialSamplingMode] : "不试标"} />
            <InfoItem label="试标条数" value={task.trialSampleSize ?? task.trialItems.length} />
            <InfoItem label="数据形态" value={imageDataModeLabels[task.displayConfig.imageDataMode]} />
            <InfoItem label="多图展示方式" value={task.displayConfig.multiImageDisplayMode ? multiImageDisplayModeLabels[task.displayConfig.multiImageDisplayMode] : "无"} />
            <InfoItem label="放大展示" value={task.displayConfig.enableDoubleClickZoom ? zoomDisplayModeLabels[task.displayConfig.zoomDisplayMode ?? "modal"] : "不支持"} />
          </div>
          <div className="grid">
            {task.labelConfigs.map((config) => (
              <div className="item" key={config.id}>
                <div className="row between">
                  <strong>{config.title}</strong>
                  <span className="badge">{config.selectionMode === "single" ? "单选" : "多选"}</span>
                </div>
                <p className="muted">{config.options.map((option) => option.label).join("、")}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <h2>报价对比</h2>
        {task.quotes.length === 0 ? (
          <div className="empty">暂无报价，直接正式标注任务可跳过此区块。</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>标注方</th>
                <th>单价</th>
                <th>说明</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {task.quotes.map((quote) => (
                <Fragment key={quote.id}>
                  <tr>
                    <td>{users.find((user) => user.id === quote.annotatorId)?.name ?? quote.annotatorId}</td>
                    <td>{money(quote.unitPrice)}</td>
                    <td>{quote.quoteNote}</td>
                    <td>{quote.status}</td>
                    <td>
                      <div className="row">
                        <button onClick={() => setReviewQuoteId(reviewQuoteId === quote.id ? "" : quote.id)}>
                          审核试标结果
                        </button>
                        <button disabled={task.status !== "pending_quote_selection" || quote.status !== "submitted"} onClick={() => chooseQuote(quote.id)}>
                          选择
                        </button>
                      </div>
                    </td>
                  </tr>
                  {reviewQuoteId === quote.id ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="grid">
                          <h3>审核试标结果</h3>
                          {task.trialItems.map((item, index) => (
                            <div className="item grid" key={item.id}>
                              <div className="row between">
                                <strong>试标数据 {index + 1}</strong>
                                <span className="badge">{item.id}</span>
                              </div>
                              <ImageViewer imageUrls={item.imageUrls} displayConfig={task.displayConfig} />
                              <SourceDataMeta item={item} />
                              <AnnotationSummary task={task} item={{ ...item, annotationValues: quote.trialValues?.[item.id] ?? item.annotationValues }} />
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel grid">
        <div className="row between">
          <h2>子任务包抽检</h2>
          <button
            className="primary"
            disabled={!task.packages.some((pkg) => pkg.status === "pending_review")}
            onClick={() => onTaskChange(approveAllPendingReviewPackages(task))}
          >
            一键全部抽检通过
          </button>
        </div>
        {task.packages.length === 0 ? (
          <div className="empty">正式标注方进入工作台后会生成子任务包。</div>
        ) : (
          task.packages.map((pkg) => {
            const items = task.formalItems.filter((item) => pkg.itemIds.includes(item.id));
            const batches = task.reviewBatches.filter((batch) => batch.packageId === pkg.id);
            const hasRejected = items.some((item) => item.reviewStatus === "rejected");
            return (
              <div className="item grid" key={pkg.id}>
                <div className="row between">
                  <div className="row">
                    <strong>{pkg.id}</strong>
                    <PackageBadge pkg={pkg} />
                    <span className="badge">数据 {items.length} 条</span>
                    <span className="badge">抽检 {batches.length} 批</span>
                  </div>
                  <button disabled={pkg.status !== "pending_review" || hasRejected} onClick={() => onTaskChange(approvePackage(task, pkg.id))}>
                    通过整个包
                  </button>
                </div>

                {pkg.status === "pending_review" ? (
                  <div className="panel grid">
                    <h3>创建抽检批次</h3>
                    <div className="grid three">
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
                        <input type="number" min="1" value={sampleCount} onChange={(event) => setSampleCount(Number(event.target.value))} />
                      </div>
                      <div className="field">
                        <label>筛选问题组</label>
                        <select value={labelConfigId || selectedLabel?.id || ""} onChange={(event) => setLabelConfigId(event.target.value)}>
                          {task.labelConfigs.map((config) => (
                            <option key={config.id} value={config.id}>
                              {config.title}
                            </option>
                          ))}
                        </select>
                      </div>
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
                      <div className="row">
                        {items.map((item) => (
                          <label key={item.id} className="badge">
                            <input
                              style={{ width: "auto" }}
                              type="checkbox"
                              checked={manualIds.includes(item.id)}
                              onChange={() =>
                                setManualIds(manualIds.includes(item.id) ? manualIds.filter((id) => id !== item.id) : [...manualIds, item.id])
                              }
                            />
                            {item.id.slice(-6)}
                          </label>
                        ))}
                      </div>
                    ) : null}
                    <button className="primary" onClick={() => createBatch(pkg.id)}>
                      创建抽检批次
                    </button>
                  </div>
                ) : null}

                {batches.map((batch) => (
                  <div className="panel grid" key={batch.id}>
                    <div className="row between">
                      <strong>抽检批次 {batch.id}</strong>
                      <span className="muted">
                        {batch.samplingMode} · 通过 {batch.approvedCount} · 驳回 {batch.rejectedCount}
                      </span>
                    </div>
                    {batch.sampledItemIds.map((itemId) => {
                      const item = task.formalItems.find((entry) => entry.id === itemId);
                      if (!item) return null;
                      const draft = rejectDraft[item.id] ?? { issue: "label_error" as RejectionIssueType, reason: "" };
                      return (
                        <div className="item grid" key={item.id}>
                          <ImageViewer imageUrls={item.imageUrls} displayConfig={task.displayConfig} />
                          <SourceDataMeta item={item} />
                          <AnnotationSummary task={task} item={item} />
                          <div className="row">
                            <button disabled={item.reviewStatus === "approved"} onClick={() => approveItem(batch.id, item.id)}>
                              {item.reviewStatus === "approved" ? "已通过" : "通过"}
                            </button>
                            <select
                              style={{ width: 160 }}
                              value={draft.issue}
                              onChange={(event) =>
                                setRejectDraft({ ...rejectDraft, [item.id]: { ...draft, issue: event.target.value as RejectionIssueType } })
                              }
                            >
                              {Object.entries(issueTypeLabels).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                            <input
                              style={{ width: 260 }}
                              placeholder="驳回原因"
                              value={draft.reason}
                              onChange={(event) => setRejectDraft({ ...rejectDraft, [item.id]: { ...draft, reason: event.target.value } })}
                            />
                            <button className="danger" onClick={() => rejectItem(batch.id, pkg.id, item.id)}>
                              驳回
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })
        )}
      </section>

      <section className="panel grid">
        <h2>申诉 / 质疑</h2>
        {task.formalItems.filter((item) => item.reviewStatus === "appealed").length === 0 ? (
          <div className="empty">暂无申诉</div>
        ) : (
          task.formalItems
            .filter((item) => item.reviewStatus === "appealed")
            .map((item) => (
              <div className="item" key={item.id}>
                <p>{item.appealReason}</p>
                <div className="row">
                  <button onClick={() => onTaskChange(handleAppeal(task, item.id, false, "维持驳回"))}>维持驳回</button>
                  <button className="primary" onClick={() => onTaskChange(handleAppeal(task, item.id, true, "申诉通过"))}>
                    改为通过
                  </button>
                </div>
              </div>
            ))
        )}
      </section>

      <section className="panel grid">
        <h2>中止任务</h2>
        <div className="row">
          <input style={{ maxWidth: 420 }} placeholder="中止原因" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
          <button className="danger" disabled={task.status === "completed" || task.status === "cancelled"} onClick={cancel}>
            中止任务
          </button>
        </div>
        {task.cancelReason ? <p className="muted">中止原因：{task.cancelReason}</p> : null}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat">
      <span className="muted">{label}</span>
      <b>{value}</b>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="item">
      <span className="muted">{label}</span>
      <div style={{ marginTop: 6 }}>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function AnnotationSummary({ task, item }: { task: Task; item: AnnotationItem }) {
  return (
    <div className="grid">
      {task.labelConfigs.map((config) => {
        const value = item.annotationValues?.find((entry) => entry.labelConfigId === config.id)?.value;
        const ids = Array.isArray(value) ? value : value ? [value] : [];
        const labels = ids.map((id) => config.options.find((option) => option.id === id)?.label ?? id);
        return (
          <div key={config.id}>
            <strong>{config.title}：</strong>
            <span>{labels.length ? labels.join("、") : "未填写"}</span>
          </div>
        );
      })}
      {item.rejectionReason ? <span className="badge danger">驳回：{item.rejectionReason}</span> : null}
    </div>
  );
}
