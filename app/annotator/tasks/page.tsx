"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { TaskMeta } from "@/components/TaskMeta";
import { taskStatusLabels } from "@/lib/labels";
import { getCurrentUser, getTasks } from "@/lib/storage";
import { taskStats } from "@/lib/task-actions";
import type { Task } from "@/lib/types";
import { money } from "@/lib/utils";

export default function AnnotatorTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    setTasks(getTasks());
  }, []);

  const currentUser = getCurrentUser();
  const visible = tasks.filter((task) => {
    if (task.status === "draft") return false;
    if (task.assignedAnnotatorId && task.assignedAnnotatorId !== currentUser.id && task.selectedAnnotatorId !== currentUser.id) return false;
    return true;
  });

  const stats = {
    trial: visible.filter((task) => task.status === "pending_trial" || task.status === "pending_quote_selection").length,
    won: visible.filter((task) => task.selectedAnnotatorId === currentUser.id).length,
    packages: visible.reduce((sum, task) => sum + task.packages.filter((pkg) => pkg.annotatorId === currentUser.id).length, 0),
    amount: visible.reduce((sum, task) => sum + (task.selectedAnnotatorId === currentUser.id ? taskStats(task).amount : 0), 0)
  };

  return (
    <main className="shell">
      <AppHeader />
      <div className="page grid">
        <div>
          <h1>标注方任务大厅</h1>
          <p className="muted">草稿和指定给其他标注方的任务会隐藏。已中止任务仅可查看。</p>
        </div>
        <section className="stats">
          <Stat label="可试标/待选择" value={stats.trial} />
          <Stat label="已中标/指定" value={stats.won} />
          <Stat label="我的任务包" value={stats.packages} />
          <Stat label="预计结算" value={money(stats.amount)} />
        </section>
        <section className="grid">
          {visible.length === 0 ? (
            <div className="empty">暂无可见任务</div>
          ) : (
            visible.map((task) => {
              const quote = task.quotes.find((item) => item.annotatorId === currentUser.id);
              const canTrial = task.entryMode === "trial_quote" && !task.selectedAnnotatorId && task.status !== "cancelled";
              const canWork = task.selectedAnnotatorId === currentUser.id && task.status !== "cancelled";
              return (
                <div className="panel grid" key={task.id}>
                  <div className="row between">
                    <div>
                      <h2>{task.title}</h2>
                      <TaskMeta task={task} />
                    </div>
                    <span className="badge">{taskStatusLabels[task.status]}</span>
                  </div>
                  <p className="muted">{task.description}</p>
                  <div className="row">
                    <span className="badge">试标 {task.trialItems.length} 条</span>
                    <span className="badge">正式 {task.formalItems.length} 条</span>
                    {quote ? <span className="badge warn">我的报价 {money(quote.unitPrice)} · {quote.status}</span> : null}
                  </div>
                  <div className="row">
                    <Link href={`/annotator/tasks/${task.id}`}>
                      <button>查看详情</button>
                    </Link>
                    {canTrial ? (
                      <Link href={`/annotator/tasks/${task.id}/trial`}>
                        <button className="primary">进入试标</button>
                      </Link>
                    ) : null}
                    {canWork ? (
                      <Link href={`/annotator/tasks/${task.id}/workspace`}>
                        <button className="primary">正式标注</button>
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
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
