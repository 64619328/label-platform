"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { RequesterShell } from "@/components/RequesterShell";
import { RequesterTaskDetail } from "@/components/RequesterTaskDetail";
import { ReviewBatchDialog } from "@/components/ReviewBatchDialog";
import { statusBadgeClass, taskStatusLabels } from "@/lib/labels";
import { getCurrentUser, getTasks, getUsers, saveTasks } from "@/lib/storage";
import { buildDownloadData, taskStats } from "@/lib/task-actions";
import type { Task } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type TaskFilter = "attention" | "all" | Task["status"];

const attentionStatuses = new Set<Task["status"]>(["pending_quote_selection", "pending_review", "partially_rejected"]);
const queueFilterMap: Record<string, TaskFilter> = {
  待选报价: "pending_quote_selection",
  待验收: "pending_review",
  需复核: "partially_rejected"
};
const taskStatusFilters: Task["status"][] = [
  "draft",
  "pending_trial",
  "trial_in_progress",
  "pending_quote_selection",
  "formal_in_progress",
  "pending_review",
  "partially_rejected",
  "completed",
  "cancelled"
];

const toastMessages: Record<string, string> = {
  draft_saved: "草稿已保存，可稍后继续编辑。",
  published: "任务已发布，已进入任务管理。",
  draft_published: "草稿已发布，任务已进入流程。"
};

function isTaskFilter(value: string | null): value is TaskFilter {
  return value === "attention" || value === "all" || taskStatusFilters.includes(value as Task["status"]);
}

export default function RequesterDashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState<TaskFilter>("attention");
  const [query, setQuery] = useState("");
  const [reviewTaskId, setReviewTaskId] = useState("");
  const [toast, setToast] = useState("");
  const [highlightedTaskId, setHighlightedTaskId] = useState("");

  useEffect(() => {
    const loaded = getTasks();
    const params = new URLSearchParams(window.location.search);
    const filterParam = params.get("filter");
    const createdTaskId = params.get("created") ?? "";
    const toastParam = params.get("toast") ?? "";
    setTasks(loaded);
    setSelectedId("");
    if (isTaskFilter(filterParam)) setFilter(filterParam);
    if (createdTaskId) {
      setHighlightedTaskId(createdTaskId);
    }
    if (toastMessages[toastParam]) {
      setToast(toastMessages[toastParam]);
    }
  }, []);

  const users = getUsers();
  const currentUser = getCurrentUser();
  const requesterTasks = tasks.filter((task) => task.requesterId === currentUser.id);
  const selected = requesterTasks.find((task) => task.id === selectedId);
  const reviewTask = requesterTasks.find((task) => task.id === reviewTaskId);

  const totals = useMemo(() => {
    const allStats = requesterTasks.map(taskStats);
    const completionRate = requesterTasks.length ? Math.round((requesterTasks.filter((task) => task.status === "completed").length / requesterTasks.length) * 100) : 0;
    return {
      total: requesterTasks.length,
      formal: requesterTasks.filter((task) => task.status === "formal_in_progress").length,
      review: requesterTasks.filter((task) => task.status === "pending_review").length,
      completed: requesterTasks.filter((task) => task.status === "completed").length,
      cancelled: requesterTasks.filter((task) => task.status === "cancelled").length,
      draft: requesterTasks.filter((task) => task.status === "draft").length,
      pendingTrial: requesterTasks.filter((task) => task.status === "pending_trial").length,
      trialInProgress: requesterTasks.filter((task) => task.status === "trial_in_progress").length,
      packages: requesterTasks.reduce((sum, task) => sum + task.packages.length, 0),
      items: requesterTasks.reduce((sum, task) => sum + task.formalItems.length, 0),
      approved: allStats.reduce((sum, stats) => sum + stats.approvedItems, 0),
      amount: allStats.reduce((sum, stats) => sum + stats.amount, 0),
      completionRate
    };
  }, [requesterTasks]);

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return requesterTasks.filter((task) => {
      const matchesFilter =
        filter === "all"
          ? true
          : filter === "attention"
            ? attentionStatuses.has(task.status)
            : task.status === filter;
      const matchesQuery =
        !normalizedQuery ||
        task.title.toLowerCase().includes(normalizedQuery) ||
        task.id.toLowerCase().includes(normalizedQuery) ||
        task.requesterId.toLowerCase().includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [filter, query, requesterTasks]);

  const queueCards = [
    {
      label: "待选报价",
      value: requesterTasks.filter((task) => task.status === "pending_quote_selection").length,
      help: "需要审核试标并选择标注方"
    },
    {
      label: "待验收",
      value: requesterTasks.filter((task) => task.status === "pending_review").length,
      help: "子任务包已提交，等待抽检"
    },
    {
      label: "需复核",
      value: requesterTasks.filter((task) => task.status === "partially_rejected").length,
      help: "存在驳回、申诉或质量风险"
    }
  ];

  const filters: { label: string; value: TaskFilter; count: number }[] = [
    { label: "待处理", value: "attention", count: requesterTasks.filter((task) => attentionStatuses.has(task.status)).length },
    { label: "全部", value: "all", count: requesterTasks.length },
    { label: "草稿", value: "draft", count: totals.draft },
    { label: "待试标", value: "pending_trial", count: totals.pendingTrial },
    { label: "试标中", value: "trial_in_progress", count: totals.trialInProgress },
    { label: "待选报价", value: "pending_quote_selection", count: requesterTasks.filter((task) => task.status === "pending_quote_selection").length },
    { label: "标注中", value: "formal_in_progress", count: totals.formal },
    { label: "待验收", value: "pending_review", count: totals.review },
    { label: "已完成", value: "completed", count: totals.completed },
    { label: "已中止", value: "cancelled", count: totals.cancelled }
  ];

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
    : "健康";

  function persist(nextTask: Task) {
    const next = tasks.map((task) => (task.id === nextTask.id ? nextTask : task));
    setTasks(next);
    saveTasks(next);
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

  function toggleTaskDetail(taskId: string) {
    setSelectedId((current) => (current === taskId ? "" : taskId));
  }

  function focusTaskList(nextFilter: TaskFilter) {
    setFilter(nextFilter);
    window.setTimeout(() => {
      document.getElementById("task-list")?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 50);
  }

  return (
    <RequesterShell title="任务管理">
      <div className="page page-wide grid">
        <section className="ops-hero">
          <div className="ops-hero-main">
            <h1>图标台</h1>
            <p>从试标到验收，一台搞定。</p>
          </div>
          <div className="ops-hero-actions">
            <div className="hero-action-row">
              <Link href="/requester/tasks/new">
                <button className="primary">发布任务</button>
              </Link>
              <Link href="/requester/review">
                <button>查看验收</button>
              </Link>
            </div>
          </div>
        </section>

        <section className="ops-summary">
          {queueCards.map((card) => (
            <button
              className="queue-card"
              key={card.label}
              onClick={() => focusTaskList(queueFilterMap[card.label])}
            >
              <span className="side-kicker">{card.label}</span>
              <strong>{card.value}</strong>
              <span className="muted">{card.help}</span>
            </button>
          ))}
          <div className="queue-card passive">
            <span className="side-kicker">完成率</span>
            <strong>{totals.completionRate}%</strong>
            <div className="mini-progress">
              <span style={{ width: `${Math.min(100, Math.max(0, totals.completionRate))}%` }} />
            </div>
          </div>
        </section>

        <section className="dashboard">
          <div className="panel task-list-panel" id="task-list">
            {toast ? (
              <div className="toast-card success task-list-toast">
                <span>{toast}</span>
                <button onClick={() => setToast("")}>我知道了</button>
              </div>
            ) : null}
            <div className="task-panel-head">
              <div>
                <h2>任务列表</h2>
                <p className="muted">优先处理报价选择、抽检验收和质量风险任务。</p>
              </div>
              <div className="task-tools">
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索任务名称或 ID" />
              </div>
            </div>
            <div className="filter-tabs">
              {filters.map((item) => (
                <button key={item.value} className={filter === item.value ? "filter-tab active" : "filter-tab"} onClick={() => setFilter(item.value)}>
                  {item.label}
                  <span>{item.count}</span>
                </button>
              ))}
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
                {filteredTasks.map((task, index) => {
                  const annotator = users.find((user) => user.id === task.selectedAnnotatorId || user.id === task.assignedAnnotatorId)?.name ?? "-";
                  const rowClassName = [
                    task.id === selected?.id ? "active" : "",
                    task.id === highlightedTaskId ? "created-highlight" : ""
                  ].filter(Boolean).join(" ");
                  return (
                    <Fragment key={task.id}>
                      <tr id={`task-row-${task.id}`} className={rowClassName} onClick={() => toggleTaskDetail(task.id)}>
                        <td className="market-task-id">任务编号 R-{String(index + 1).padStart(3, "0")}</td>
                        <td>
                          <button
                            className="row-toggle"
                            aria-expanded={task.id === selected?.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleTaskDetail(task.id);
                            }}
                          >
                            {task.id === selected?.id ? "收起" : "展开"}
                          </button>
                          <strong>{task.title}</strong>
                          <div className="muted">正式数据 {task.formalItems.length} 条 · 截止 {formatDate(task.deadline)}</div>
                        </td>
                        <td>{task.requesterId}</td>
                        <td><span className={statusBadgeClass(task.status)}>{taskStatusLabels[task.status]}</span></td>
                        <td>{annotator}</td>
                        <td>
                          <div className="action-cell">
                            {task.status === "draft" ? (
                              <Link href={`/requester/tasks/new?edit=${task.id}`} onClick={(event) => event.stopPropagation()}>
                                <button className="button-compact" title="继续编辑草稿">编辑</button>
                              </Link>
                            ) : null}
                            <Link href={`/requester/tasks/${task.id}`} onClick={(event) => event.stopPropagation()}>
                              <button className="button-compact" title="任务详情">详情</button>
                            </Link>
                            {task.status === "pending_review" || task.status === "partially_rejected" ? (
                              <button
                                className="button-compact primary"
                                title="验收任务"
                                disabled={!task.packages.some((pkg) => pkg.status === "pending_review")}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setReviewTaskId(task.id);
                                }}
                              >
                                验收
                              </button>
                            ) : null}
                            <button
                              className="button-compact"
                              title="下载 JSON"
                              disabled={task.status !== "completed" && task.status !== "cancelled"}
                              onClick={(event) => { event.stopPropagation(); download(task); }}
                            >
                              下载
                            </button>
                            {task.status !== "completed" && task.status !== "cancelled" ? (
                              <span className="action-hint">仅完成/中止可下载</span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {task.id === selected?.id ? (
                        <tr className="embedded-detail-row">
                          <td colSpan={6}>
                            <RequesterTaskDetail
                              task={task}
                              users={users}
                              operatorId={currentUser.id}
                              onTaskChange={persist}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty">当前筛选下暂无任务</div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            <div className="task-table-footer">
              <span className="muted">当前展示 {filteredTasks.length} / {totals.total} 个任务</span>
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
              <div className="health-actions">
                <button onClick={() => focusTaskList("partially_rejected")}>查看需复核</button>
                <button onClick={() => focusTaskList("pending_review")}>查看待验收</button>
              </div>
            </div>
          </div>
        </section>

        {reviewTask ? <ReviewBatchDialog task={reviewTask} currentUserId={currentUser.id} onTaskChange={persist} onClose={() => setReviewTaskId("")} /> : null}

      </div>
    </RequesterShell>
  );
}
