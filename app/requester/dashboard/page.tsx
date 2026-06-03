"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { RequesterTaskDetail } from "@/components/RequesterTaskDetail";
import { statusBadgeClass, taskStatusLabels } from "@/lib/labels";
import { getCurrentUser, getTasks, getUsers, saveTasks } from "@/lib/storage";
import { buildDownloadData, taskStats } from "@/lib/task-actions";
import type { Task } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type TaskFilter = "attention" | "all" | Task["status"];

const attentionStatuses = new Set<Task["status"]>(["pending_quote_selection", "pending_review", "partially_rejected"]);

export default function RequesterDashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState<TaskFilter>("attention");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const loaded = getTasks();
    setTasks(loaded);
    setSelectedId("");
  }, []);

  const users = getUsers();
  const currentUser = getCurrentUser();
  const requesterTasks = tasks.filter((task) => task.requesterId === currentUser.id);
  const selected = requesterTasks.find((task) => task.id === selectedId);

  const totals = useMemo(() => {
    const allStats = requesterTasks.map(taskStats);
    const completionRate = requesterTasks.length ? Math.round((requesterTasks.filter((task) => task.status === "completed").length / requesterTasks.length) * 100) : 0;
    return {
      total: requesterTasks.length,
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
    : "Optimal";

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

  return (
    <main className="shell">
      <AppHeader />
      <div className="page page-wide grid">
        <section className="ops-hero">
          <div className="ops-hero-main">
            <span className="side-kicker">Annota Workbench</span>
            <h1>图标台</h1>
            <p>从试标到验收，一台搞定。</p>
          </div>
          <div className="ops-hero-actions">
            <Link href="/requester/tasks/new">
              <button className="primary">发布任务</button>
            </Link>
          </div>
        </section>

        <section className="ops-summary">
          {queueCards.map((card) => (
            <button
              className="queue-card"
              key={card.label}
              onClick={() => setFilter(card.label === "待选报价" ? "pending_quote_selection" : card.label === "待验收" ? "pending_review" : "attention")}
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
          <div className="panel task-list-panel">
            <div className="task-panel-head">
              <div>
                <span className="side-kicker">Task Operations</span>
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
                  return (
                    <Fragment key={task.id}>
                      <tr className={task.id === selected?.id ? "active" : ""} onClick={() => toggleTaskDetail(task.id)}>
                        <td className="market-task-id">任务编号 R-{String(index + 1).padStart(3, "0")}</td>
                        <td>
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
                            <button
                              className="button-compact"
                              title="下载 JSON"
                              disabled={task.status !== "completed" && task.status !== "cancelled"}
                              onClick={(event) => { event.stopPropagation(); download(task); }}
                            >
                              下载
                            </button>
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
            <div className="row between" style={{ padding: "14px 18px", background: "var(--surface-low)" }}>
              <span className="muted">Showing {filteredTasks.length} of {totals.total} tasks</span>
              <div className="row">
                <button>Previous</button>
                <button className="active-page">1</button>
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
              <button>查看诊断记录</button>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
