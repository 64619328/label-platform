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
  reviewTrialQuote,
  selectQuote,
  taskStats
} from "@/lib/task-actions";
import type { AnnotationItem, DemoUser, RejectionIssueType, ReviewSamplingMode, Task, TrialReviewStatus } from "@/lib/types";
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

const quoteStatusLabels: Record<string, string> = {
  draft: "草稿",
  submitted: "已提交",
  selected: "已选择",
  not_selected: "未选择"
};

const trialReviewStatusLabels: Record<TrialReviewStatus, string> = {
  pending: "试标待审核",
  approved: "试标通过",
  rejected: "试标不通过"
};

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
  const selectedQuote = task.quotes.find((quote) => quote.status === "selected");
  const submittedQuotes = task.quotes.filter((quote) => quote.status === "submitted");
  const approvedQuotes = submittedQuotes.filter((quote) => quote.trialReviewStatus === "approved");
  const pendingReviewPackages = task.packages.filter((pkg) => pkg.status === "pending_review");
  const appealedItems = task.formalItems.filter((item) => item.reviewStatus === "appealed");
  const canReviewPackages = task.status === "pending_review" || task.status === "partially_rejected";
  const quoteTodoActive = task.status === "pending_quote_selection";
  const reviewTodoActive = canReviewPackages && pendingReviewPackages.length > 0;
  const appealTodoActive = appealedItems.length > 0;

  let nextActionTitle = "等待流程推进";
  let nextActionText = "当前任务暂无必须处理的动作，可查看配置和流程状态。";

  if (task.status === "draft") {
    nextActionTitle = "继续完善任务配置";
    nextActionText = "草稿尚未发布，先完成展示布局、标签和数据配置。";
  } else if (task.status === "pending_trial" || task.status === "trial_in_progress") {
    nextActionTitle = "等待试标报价";
    nextActionText = "标注方完成试标并提交报价后，这里会进入报价审核和选择。";
  } else if (task.status === "pending_quote_selection") {
    nextActionTitle = "选择正式标注方";
    nextActionText = `已收到 ${submittedQuotes.length} 份报价，其中 ${approvedQuotes.length} 份试标通过。先审核试标质量，再选择正式标注方。`;
  } else if (task.status === "formal_in_progress") {
    nextActionTitle = "等待正式标注提交";
    nextActionText = selectedQuote
      ? `${users.find((user) => user.id === selectedQuote.annotatorId)?.name ?? selectedQuote.annotatorId} 正在标注，提交子任务包后可进入验收。`
      : "正式标注进行中，提交子任务包后可进入验收。";
  } else if (canReviewPackages) {
    nextActionTitle = "验收子任务包";
    nextActionText = `${pendingReviewPackages.length} 个子任务包待验收，优先创建抽检批次，确认后通过或驳回。`;
  } else if (task.status === "completed") {
    nextActionTitle = "任务已完成";
    nextActionText = "所有子任务包已验收通过，可在列表中下载结果。";
  } else if (task.status === "cancelled") {
    nextActionTitle = "任务已中止";
    nextActionText = task.cancelReason ? `中止原因：${task.cancelReason}` : "该任务已中止。";
  }

  function chooseQuote(quoteId: string) {
    onTaskChange(selectQuote(task, quoteId));
  }

  function reviewQuote(quoteId: string, trialReviewStatus: "approved" | "rejected") {
    onTaskChange(reviewTrialQuote(task, quoteId, trialReviewStatus));
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
    <div className="requester-task-detail grid">
      <section className="panel task-control-hero">
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
      </section>

      <section className="stats">
        <Stat label="正式数据" value={task.formalItems.length} />
        <Stat label="已标注" value={stats.submittedItems} />
        <Stat label="通过数据" value={stats.approvedItems} />
        <Stat label="预计结算" value={money(stats.amount)} />
      </section>

      <section className="panel task-next-action">
        <div>
          <span className="badge">当前待处理</span>
          <h2>{nextActionTitle}</h2>
          <p className="muted">{nextActionText}</p>
        </div>
      </section>

      <details id="quote-section" className="panel task-detail-section" open={quoteTodoActive}>
        <summary>
          <span>
            报价与试标审核
            <small>选择正式标注方前处理</small>
          </span>
          <span className={`badge todo-badge ${quoteTodoActive ? "active" : ""}`}>{task.quotes.length} 份报价</span>
        </summary>
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
                    <td>
                      <div className="row">
                        <span className="badge">{quoteStatusLabels[quote.status]}</span>
                        <span className={quote.trialReviewStatus === "rejected" ? "badge danger" : quote.trialReviewStatus === "approved" ? "badge ok" : "badge warn"}>
                          {trialReviewStatusLabels[quote.trialReviewStatus ?? "pending"]}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="row">
                        <button onClick={() => setReviewQuoteId(reviewQuoteId === quote.id ? "" : quote.id)}>
                          审核试标结果
                        </button>
                        <button disabled={task.status !== "pending_quote_selection" || quote.status !== "submitted" || quote.trialReviewStatus !== "approved"} onClick={() => chooseQuote(quote.id)}>
                          选择
                        </button>
                      </div>
                    </td>
                  </tr>
                  {reviewQuoteId === quote.id ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="grid">
                          <div className="row between">
                            <div>
                              <h3>审核试标结果</h3>
                              <p className="muted">先审核试标质量，通过后才能选择该标注方。</p>
                            </div>
                            <div className="row">
                              <button className={quote.trialReviewStatus === "approved" ? "primary" : ""} onClick={() => reviewQuote(quote.id, "approved")}>
                                通过
                              </button>
                              <button className={quote.trialReviewStatus === "rejected" ? "danger" : ""} onClick={() => reviewQuote(quote.id, "rejected")}>
                                不通过
                              </button>
                            </div>
                          </div>
                          {task.trialItems.map((item, index) => (
                            <div className="item grid" key={item.id}>
                              <div className="row between">
                                <strong>试标数据 {index + 1}</strong>
                                <span className="badge">{item.id}</span>
                              </div>
                              <ImageViewer imageUrls={item.imageUrls} sourceData={item.sourceData} displayConfig={task.displayConfig} />
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
      </details>

      <details id="review-section" className="panel task-detail-section" open={canReviewPackages}>
        <summary>
          <span>
            子任务包验收
            <small>抽检、通过、驳回正式标注结果</small>
          </span>
          <span className={`badge todo-badge ${reviewTodoActive ? "active" : ""}`}>{pendingReviewPackages.length} 个待验收</span>
        </summary>
        <div className="row between task-section-toolbar">
          <p className="muted">只在需要验收时展开，避免和任务配置混在一起。</p>
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
                          <ImageViewer imageUrls={item.imageUrls} sourceData={item.sourceData} displayConfig={task.displayConfig} />
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
      </details>

      <details className="panel task-detail-section" open={appealTodoActive}>
        <summary>
          <span>
            申诉 / 质疑
            <small>处理标注方对驳回结果的反馈</small>
          </span>
          <span className={`badge todo-badge ${appealTodoActive ? "active" : ""}`}>{appealedItems.length} 条申诉</span>
        </summary>
        {appealedItems.length === 0 ? (
          <div className="empty">暂无申诉</div>
        ) : (
          appealedItems.map((item) => (
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
      </details>

      {showCreationInfo ? (
        <details className="panel task-detail-section task-config-section">
          <summary>
            <span>
              任务配置与规则
              <small>纯信息展示，默认收起，按需查看</small>
            </span>
            <span className="badge">{task.labelConfigs.length} 个问题组</span>
          </summary>
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
            <InfoItem label="展示布局" value={task.displayConfig.layoutMode === "custom" ? `自定义画布（${task.displayConfig.frames?.length ?? 0} 个框）` : "基础图片展示"} />
            <InfoItem label="数据形态" value={imageDataModeLabels[task.displayConfig.imageDataMode]} />
            <InfoItem label="多图展示方式" value={task.displayConfig.layoutMode === "custom" ? "按画布展示" : task.displayConfig.multiImageDisplayMode ? multiImageDisplayModeLabels[task.displayConfig.multiImageDisplayMode] : "无"} />
            <InfoItem label="放大展示" value={task.displayConfig.layoutMode === "custom" ? "点击图片/视频全屏查看" : task.displayConfig.enableDoubleClickZoom ? zoomDisplayModeLabels[task.displayConfig.zoomDisplayMode ?? "modal"] : "不支持"} />
          </div>
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
        </details>
      ) : null}

      <details className="panel task-detail-section danger-zone">
        <summary>
          <span>
            中止任务
            <small>低频危险操作，默认收起</small>
          </span>
          {task.cancelReason ? <span className="badge danger">已中止</span> : null}
        </summary>
        <div className="row">
          <input style={{ maxWidth: 420 }} placeholder="中止原因" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
          <button className="danger" disabled={task.status === "completed" || task.status === "cancelled"} onClick={cancel}>
            中止任务
          </button>
        </div>
        {task.cancelReason ? <p className="muted">中止原因：{task.cancelReason}</p> : null}
      </details>
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
