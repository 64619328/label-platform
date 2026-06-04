"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RequesterShell } from "@/components/RequesterShell";
import { ReviewBatchDialog } from "@/components/ReviewBatchDialog";
import { statusBadgeClass, taskStatusLabels } from "@/lib/labels";
import { getCurrentUser, getTasks, getUsers, saveTasks } from "@/lib/storage";
import { taskStats } from "@/lib/task-actions";
import type { Task } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function RequesterReviewPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTaskId, setActiveTaskId] = useState("");

  useEffect(() => {
    setTasks(getTasks());
  }, []);

  const currentUser = getCurrentUser();
  const users = getUsers();
  const reviewTasks = tasks.filter((task) => {
    if (task.requesterId !== currentUser.id) return false;
    return task.status === "pending_review" || task.status === "partially_rejected";
  });
  const pendingPackageCount = reviewTasks.reduce((sum, task) => sum + task.packages.filter((pkg) => pkg.status === "pending_review").length, 0);
  const appealedCount = reviewTasks.reduce((sum, task) => sum + task.formalItems.filter((item) => item.reviewStatus === "appealed").length, 0);
  const activeTask = reviewTasks.find((task) => task.id === activeTaskId);

  function openBatchDialog(task: Task) {
    setActiveTaskId(task.id);
  }

  function persist(nextTask: Task) {
    const nextTasks = tasks.map((task) => (task.id === nextTask.id ? nextTask : task));
    setTasks(nextTasks);
    saveTasks(nextTasks);
  }

  return (
    <RequesterShell title="验收中心">
      <div className="page page-wide grid">
        <section className="stats three">
          <Stat label="待验收任务" value={reviewTasks.length} />
          <Stat label="待抽检包" value={pendingPackageCount} />
          <Stat label="待处理申诉" value={appealedCount} />
        </section>

        <section className="panel my-task-list">
          <div className="monitor-head">
            <h2>验收列表</h2>
            <span className="muted">{reviewTasks.length} 个任务</span>
          </div>
          {reviewTasks.length === 0 ? (
            <div className="empty">暂无待验收任务</div>
          ) : (
            <div className="my-task-rows">
              {reviewTasks.map((task, index) => {
                const stats = taskStats(task);
                const annotator = users.find((user) => user.id === task.selectedAnnotatorId || user.id === task.assignedAnnotatorId)?.name ?? "-";
                const imageUrl = task.formalItems[0]?.imageUrls[0] ?? task.trialItems[0]?.imageUrls[0];
                const pendingPackages = task.packages.filter((pkg) => pkg.status === "pending_review").length;
                const pendingItems = task.formalItems.filter((item) => item.reviewStatus === "pending_review").length;

                return (
                  <article className="my-task-row" key={task.id}>
                    <div className="my-task-thumb">
                      {imageUrl ? <img src={imageUrl} alt="" /> : null}
                    </div>
                    <div className="my-task-main">
                      <div className="market-task-title">
                        <div>
                          <span className="market-task-id">验收编号 R-{String(index + 1).padStart(3, "0")}</span>
                          <h2>{task.title}</h2>
                        </div>
                        <span className={statusBadgeClass(task.status)}>{taskStatusLabels[task.status]}</span>
                      </div>
                      <div className="market-task-meta">
                        <span className="badge">标注方 {annotator}</span>
                        <span className="badge">待抽检包 {pendingPackages}</span>
                        <span className="badge">待验收数据 {pendingItems}</span>
                        <span className="badge">通过 {stats.approvedItems}</span>
                        <span className="badge">截止 {formatDate(task.deadline)}</span>
                      </div>
                    </div>
                    <div className="my-task-side">
                      <span className="muted">验收进度</span>
                      <strong>{stats.approvedItems}/{task.formalItems.length}</strong>
                      <div className="mini-progress">
                        <span style={{ width: `${task.formalItems.length ? Math.round((stats.approvedItems / task.formalItems.length) * 100) : 0}%` }} />
                      </div>
                      <div className="market-task-actions">
                        <button className="primary" disabled={pendingPackages === 0} onClick={() => openBatchDialog(task)}>
                          验收
                        </button>
                        <Link href={`/requester/tasks/${task.id}`}>
                          <button>详情</button>
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        {activeTask ? <ReviewBatchDialog task={activeTask} currentUserId={currentUser.id} onTaskChange={persist} onClose={() => setActiveTaskId("")} /> : null}
      </div>
    </RequesterShell>
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
