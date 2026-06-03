"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { RequesterTaskDetail } from "@/components/RequesterTaskDetail";
import { taskStatusLabels } from "@/lib/labels";
import { getCurrentUser, getTasks, getUsers, saveTasks } from "@/lib/storage";
import { buildDownloadData, taskStats } from "@/lib/task-actions";
import type { Task } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function RequesterDashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    const loaded = getTasks();
    setTasks(loaded);
    setSelectedId(loaded[0]?.id ?? "");
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
      <div className="page grid">
        <section className="product-hero">
          <div>
            <span className="side-kicker">Annota</span>
            <h1>图标台</h1>
            <p>从试标到验收，一台搞定。</p>
          </div>
          <Link href="/requester/tasks/new">
            <button className="primary">发布任务</button>
          </Link>
        </section>

        <section className="stats three">
          <StatCard label="正在标注中的任务" value={totals.formal} trend={`${totals.packages} 个子任务包`} icon="▣" />
          <StatCard label="待验收任务" value={totals.review} trend={`${totals.approved} 条已通过`} icon="◎" />
          <StatCard label="任务完成率" value={`${totals.completionRate}%`} progress={totals.completionRate} icon="✓" />
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
                  return (
                    <Fragment key={task.id}>
                      <tr className={task.id === selected?.id ? "active" : ""} onClick={() => toggleTaskDetail(task.id)}>
                        <td className="mono">#{task.id.slice(-8).toUpperCase()}</td>
                        <td>
                          <strong>{task.title}</strong>
                          <div className="muted">正式数据 {task.formalItems.length} 条 · 截止 {formatDate(task.deadline)}</div>
                        </td>
                        <td>{task.requesterId}</td>
                        <td><span className="badge">{taskStatusLabels[task.status]}</span></td>
                        <td>{annotator}</td>
                        <td>
                          <div className="action-cell">
                            {task.status === "draft" ? (
                              <Link href={`/requester/tasks/new?edit=${task.id}`} onClick={(event) => event.stopPropagation()}>
                                <button className="small-icon" title="继续编辑草稿">✎</button>
                              </Link>
                            ) : null}
                            <Link href={`/requester/tasks/${task.id}`} onClick={(event) => event.stopPropagation()}>
                              <button className="small-icon" title="任务详情">↗</button>
                            </Link>
                            <button
                              className="small-icon"
                              title="下载 JSON"
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
