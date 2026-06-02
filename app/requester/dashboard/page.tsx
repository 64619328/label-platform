"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ImageViewer } from "@/components/ImageViewer";
import { PackageBadge, TaskMeta } from "@/components/TaskMeta";
import { issueTypeLabels, packageStatusLabels, taskStatusLabels } from "@/lib/labels";
import { getCurrentUser, getTasks, getUsers, saveTasks } from "@/lib/storage";
import {
  approvePackage,
  approveReviewItem,
  buildDownloadData,
  cancelTask,
  createReviewBatch,
  handleAppeal,
  rejectReviewItem,
  selectQuote,
  taskStats
} from "@/lib/task-actions";
import type { AnnotationItem, RejectionIssueType, ReviewSamplingMode, Task } from "@/lib/types";
import { formatDate, money } from "@/lib/utils";

export default function RequesterDashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [sampleCount, setSampleCount] = useState(2);
  const [samplingMode, setSamplingMode] = useState<ReviewSamplingMode>("random");
  const [manualIds, setManualIds] = useState<string[]>([]);
  const [labelConfigId, setLabelConfigId] = useState("");
  const [labelOptionIds, setLabelOptionIds] = useState<string[]>([]);
  const [cancelReason, setCancelReason] = useState("");
  const [rejectDraft, setRejectDraft] = useState<Record<string, { issue: RejectionIssueType; reason: string }>>({});

  useEffect(() => {
    const loaded = getTasks();
    setTasks(loaded);
    setSelectedId(loaded[0]?.id ?? "");
  }, []);

  const users = getUsers();
  const currentUser = getCurrentUser();
  const requesterTasks = tasks.filter((task) => task.requesterId === currentUser.id);
  const selected = requesterTasks.find((task) => task.id === selectedId) ?? requesterTasks[0];

  const totals = useMemo(() => {
    const allStats = requesterTasks.map(taskStats);
    const active = requesterTasks.filter((task) => !["completed", "cancelled", "draft"].includes(task.status)).length;
    const completionRate = requesterTasks.length ? Math.round((requesterTasks.filter((task) => task.status === "completed").length / requesterTasks.length) * 100) : 0;
    return {
      total: requesterTasks.length,
      active,
      formal: requesterTasks.filter((task) => task.status === "formal_in_progress").length,
      review: requesterTasks.filter((task) => task.status === "pending_review").length,
      completed: requesterTasks.filter((task) => task.status === "completed").length,
      cancelled: requesterTasks.filter((task) => task.status === "cancelled").length,
      packages: requesterTasks.reduce((sum, task) => sum + task.packages.length, 0),
      items: requesterTasks.reduce((sum, task) => sum + task.formalItems.length, 0),
      approved: allStats.reduce((sum, stats) => sum + stats.approvedItems, 0),
      amount: allStats.reduce((sum, stats) => sum + stats.amount, 0),
      completionRate
    };
  }, [requesterTasks]);

  const supplierDistribution = useMemo(() => {
    const map = new Map<string, number>();
    requesterTasks.forEach((task) => {
      const supplierId = task.selectedAnnotatorId ?? task.assignedAnnotatorId;
      if (!supplierId) return;
      map.set(supplierId, (map.get(supplierId) ?? 0) + task.formalItems.length);
    });
    return Array.from(map.entries()).map(([supplierId, count]) => ({
      supplierId,
      name: users.find((user) => user.id === supplierId)?.name ?? supplierId,
      count
    }));
  }, [requesterTasks, users]);

  const maxSupplierCount = Math.max(1, ...supplierDistribution.map((item) => item.count));
  const healthStatus = totals.review > 3 || requesterTasks.some((task) => task.status === "partially_rejected")
    ? "需要关注"
    : "Optimal";

  function persist(nextTask: Task) {
    const next = tasks.map((task) => (task.id === nextTask.id ? nextTask : task));
    setTasks(next);
    saveTasks(next);
  }

  function chooseQuote(task: Task, quoteId: string) {
    persist(selectQuote(task, quoteId));
  }

  function createBatch(task: Task, packageId: string) {
    persist(createReviewBatch(task, packageId, samplingMode, currentUser.id, sampleCount, manualIds, labelConfigId, labelOptionIds));
    setManualIds([]);
  }

  function approveItem(task: Task, batchId: string, itemId: string) {
    persist(approveReviewItem(task, batchId, itemId));
  }

  function rejectItem(task: Task, batchId: string, packageId: string, itemId: string) {
    const draft = rejectDraft[itemId] ?? { issue: "label_error" as RejectionIssueType, reason: "" };
    if (!draft.reason.trim()) return;
    persist(rejectReviewItem(task, batchId, packageId, itemId, draft.issue, draft.reason));
  }

  function download(task: Task) {
    const data = buildDownloadData(task);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `task-${task.id}-annotations.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function cancel(task: Task) {
    if (!cancelReason.trim()) return;
    persist(cancelTask(task, cancelReason));
    setCancelReason("");
  }

  return (
    <main className="shell">
      <AppHeader />
      <div className="page grid">
        <div className="row between">
          <div>
            <span className="side-kicker">Task Management</span>
            <h1>任务管理</h1>
            <p className="muted">管理图像标注任务、报价选择、子任务包进度和抽检验收。</p>
          </div>
          <Link href="/requester/tasks/new">
            <button className="primary">发布任务</button>
          </Link>
        </div>

        <section className="stats three">
          <StatCard label="Active Tasks" value={totals.active} trend={`+${totals.review} 待验收`} icon="▣" />
          <StatCard label="Total Suppliers" value={supplierDistribution.length} trend={`${totals.packages} 个子任务包`} icon="◎" />
          <StatCard label="Completion Rate" value={`${totals.completionRate}%`} progress={totals.completionRate} icon="✓" />
        </section>

        <section className="dashboard">
          <div className="panel task-list-panel">
            <div className="monitor-head">
              <span className="side-kicker">Live Tasks Monitor</span>
              <div className="row">
                <button className="small-icon">↻</button>
                <button className="small-icon">⋯</button>
              </div>
            </div>
            <table className="task-table">
              <thead>
                <tr>
                  <th>任务 ID</th>
                  <th>任务名称</th>
                  <th>创建者</th>
                  <th>状态</th>
                  <th>标注方</th>
                  <th style={{ textAlign: "right" }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {requesterTasks.map((task) => {
                  const annotator = users.find((user) => user.id === task.selectedAnnotatorId || user.id === task.assignedAnnotatorId)?.name ?? "-";
                  const creator = users.find((user) => user.id === task.requesterId)?.name ?? task.requesterId;
                  return (
                    <Fragment key={task.id}>
                      <tr className={task.id === selected?.id ? "active" : ""} onClick={() => setSelectedId(task.id)}>
                        <td className="mono">#{task.id.slice(-8).toUpperCase()}</td>
                        <td>
                          <strong>{task.title}</strong>
                          <div className="muted">正式数据 {task.formalItems.length} 条 · 截止 {formatDate(task.deadline)}</div>
                        </td>
                        <td>{creator}</td>
                        <td><span className="badge">{taskStatusLabels[task.status]}</span></td>
                        <td>{annotator}</td>
                        <td>
                          <div className="action-cell">
                            {task.status === "draft" ? (
                              <Link href={`/requester/tasks/new?edit=${task.id}`}>
                                <button className="small-icon" title="继续编辑草稿">✎</button>
                              </Link>
                            ) : (
                              <button className="small-icon" title="查看详情">↗</button>
                            )}
                            <button
                              className="small-icon"
                              title="下载"
                              disabled={task.status !== "completed" && task.status !== "cancelled"}
                              onClick={(event) => { event.stopPropagation(); download(task); }}
                            >
                              ⇩
                            </button>
                          </div>
                        </td>
                      </tr>
                      {task.id === selected?.id ? (
                        <tr className="embedded-detail-row">
                          <td colSpan={6}>
                            <TaskDetail
                              task={task}
                              users={users}
                              sampleCount={sampleCount}
                              setSampleCount={setSampleCount}
                              samplingMode={samplingMode}
                              setSamplingMode={setSamplingMode}
                              manualIds={manualIds}
                              setManualIds={setManualIds}
                              labelConfigId={labelConfigId}
                              setLabelConfigId={setLabelConfigId}
                              labelOptionIds={labelOptionIds}
                              setLabelOptionIds={setLabelOptionIds}
                              rejectDraft={rejectDraft}
                              setRejectDraft={setRejectDraft}
                              cancelReason={cancelReason}
                              setCancelReason={setCancelReason}
                              chooseQuote={chooseQuote}
                              createBatch={createBatch}
                              approveItem={approveItem}
                              rejectItem={rejectItem}
                              approvePackage={(task, packageId) => persist(approvePackage(task, packageId))}
                              handleAppeal={(task, itemId, approve, reason) => persist(handleAppeal(task, itemId, approve, reason))}
                              cancel={cancel}
                              download={download}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            <div className="row between" style={{ padding: "14px 18px", background: "var(--surface-low)" }}>
              <span className="muted">Showing {requesterTasks.length} of {totals.total} tasks</span>
              <div className="row">
                <button>Previous</button>
                <button className="primary">1</button>
                <button>Next</button>
              </div>
            </div>
          </div>
        </section>

        <section className="insights-grid">
          <div className="panel">
            <h2>任务分布</h2>
            <p className="muted">按照供应商承接的正式数据量统计。</p>
            <div className="bar-chart">
              {supplierDistribution.length ? supplierDistribution.map((item) => (
                <div className="bar-wrap" key={item.supplierId}>
                  <div className="bar" style={{ height: `${Math.max(10, (item.count / maxSupplierCount) * 100)}%` }} title={item.name}></div>
                  <span className="muted">{item.name.replace("标注方 ", "")}</span>
                  <strong>{item.count}</strong>
                </div>
              )) : <div className="empty" style={{ width: "100%" }}>暂无供应商数据</div>}
            </div>
          </div>

          <div className="health-card">
            <div style={{ position: "relative", zIndex: 1 }}>
              <h2>健康诊断：{healthStatus}</h2>
              <p>当前待验收任务 {totals.review} 个，部分驳回任务 {requesterTasks.filter((task) => task.status === "partially_rejected").length} 个，平均处理链路稳定。</p>
              <button>View Diagnostic Logs</button>
            </div>
          </div>
        </section>

      </div>
    </main>
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

function StatCard({ label, value, trend, progress, icon }: { label: string; value: string | number; trend?: string; progress?: number; icon: string }) {
  return (
    <div className="stat large">
      <div>
        <span className="side-kicker">{label}</span>
        <b>{value}</b>
        {typeof progress === "number" ? (
          <div className="mini-progress">
            <span style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
          </div>
        ) : (
          <div className="trend">↗ {trend}</div>
        )}
      </div>
      <div className="stat-icon">{icon}</div>
    </div>
  );
}

function TaskDetail(props: {
  task: Task;
  users: ReturnType<typeof getUsers>;
  sampleCount: number;
  setSampleCount: (value: number) => void;
  samplingMode: ReviewSamplingMode;
  setSamplingMode: (value: ReviewSamplingMode) => void;
  manualIds: string[];
  setManualIds: (value: string[]) => void;
  labelConfigId: string;
  setLabelConfigId: (value: string) => void;
  labelOptionIds: string[];
  setLabelOptionIds: (value: string[]) => void;
  rejectDraft: Record<string, { issue: RejectionIssueType; reason: string }>;
  setRejectDraft: (value: Record<string, { issue: RejectionIssueType; reason: string }>) => void;
  cancelReason: string;
  setCancelReason: (value: string) => void;
  chooseQuote: (task: Task, quoteId: string) => void;
  createBatch: (task: Task, packageId: string) => void;
  approveItem: (task: Task, batchId: string, itemId: string) => void;
  rejectItem: (task: Task, batchId: string, packageId: string, itemId: string) => void;
  approvePackage: (task: Task, packageId: string) => void;
  handleAppeal: (task: Task, itemId: string, approve: boolean, reason: string) => void;
  cancel: (task: Task) => void;
  download: (task: Task) => void;
}) {
  const {
    task,
    users,
    sampleCount,
    setSampleCount,
    samplingMode,
    setSamplingMode,
    manualIds,
    setManualIds,
    labelConfigId,
    setLabelConfigId,
    labelOptionIds,
    setLabelOptionIds,
    rejectDraft,
    setRejectDraft,
    cancelReason,
    setCancelReason
  } = props;
  const stats = taskStats(task);
  const selectedLabel = task.labelConfigs.find((config) => config.id === labelConfigId) ?? task.labelConfigs[0];

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
                <tr key={quote.id}>
                  <td>{users.find((user) => user.id === quote.annotatorId)?.name ?? quote.annotatorId}</td>
                  <td>{money(quote.unitPrice)}</td>
                  <td>{quote.quoteNote}</td>
                  <td>{quote.status}</td>
                  <td>
                    <button disabled={task.status !== "pending_quote_selection" || quote.status !== "submitted"} onClick={() => props.chooseQuote(task, quote.id)}>
                      选择
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel grid">
        <h2>子任务包与抽检</h2>
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
                  <button disabled={pkg.status !== "pending_review" || hasRejected} onClick={() => props.approvePackage(task, pkg.id)}>
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
                    <button className="primary" onClick={() => props.createBatch(task, pkg.id)}>
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
                          <AnnotationSummary task={task} item={item} />
                          <div className="row">
                            <button onClick={() => props.approveItem(task, batch.id, item.id)}>通过</button>
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
                            <button className="danger" onClick={() => props.rejectItem(task, batch.id, pkg.id, item.id)}>
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
                  <button onClick={() => props.handleAppeal(task, item.id, false, "维持驳回")}>维持驳回</button>
                  <button className="primary" onClick={() => props.handleAppeal(task, item.id, true, "申诉通过")}>
                    改为通过
                  </button>
                </div>
              </div>
            ))
        )}
      </section>

      <section className="panel grid">
        <h2>中止与下载</h2>
        <div className="row">
          <input style={{ maxWidth: 420 }} placeholder="中止原因" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
          <button className="danger" disabled={task.status === "completed" || task.status === "cancelled"} onClick={() => props.cancel(task)}>
            中止任务
          </button>
          <button disabled={task.status !== "completed" && task.status !== "cancelled"} onClick={() => props.download(task)}>
            下载 JSON
          </button>
        </div>
        {task.cancelReason ? <p className="muted">中止原因：{task.cancelReason}</p> : null}
      </section>
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
