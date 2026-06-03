"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { PackageBadge, TaskMeta } from "@/components/TaskMeta";
import { taskStatusLabels } from "@/lib/labels";
import { getCurrentUser, getTasks } from "@/lib/storage";
import { taskStats } from "@/lib/task-actions";
import type { Task } from "@/lib/types";
import { money } from "@/lib/utils";

export default function MyAnnotatorTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    setTasks(getTasks());
  }, []);

  const currentUser = getCurrentUser();
  const myTasks = tasks.filter((task) => {
    const hasPackage = task.packages.some((pkg) => pkg.annotatorId === currentUser.id);
    const hasQuote = task.quotes.some((quote) => quote.annotatorId === currentUser.id);
    return task.selectedAnnotatorId === currentUser.id || task.assignedAnnotatorId === currentUser.id || hasPackage || hasQuote;
  });

  const activeTasks = myTasks.filter((task) => !["completed", "cancelled"].includes(task.status));
  const packageCount = myTasks.reduce((sum, task) => sum + task.packages.filter((pkg) => pkg.annotatorId === currentUser.id).length, 0);
  const amount = myTasks.reduce((sum, task) => sum + (task.selectedAnnotatorId === currentUser.id ? taskStats(task).amount : 0), 0);

  return (
    <main className="shell">
      <AppHeader />
      <div className="page grid">
        <div className="row between">
          <div>
            <span className="side-kicker">Annotator Dashboard</span>
            <h1>我的任务</h1>
            <p className="muted">查看当前标注方已领取、已报价、中标或被指定的任务。</p>
          </div>
          <Link href="/annotator/tasks">
            <button>返回任务大厅</button>
          </Link>
        </div>

        <section className="stats three">
          <Stat label="进行中任务" value={activeTasks.length} />
          <Stat label="我的任务包" value={packageCount} />
          <Stat label="预计结算" value={money(amount)} />
        </section>

        <section className="panel my-task-list">
          <div className="monitor-head">
            <h2>任务列表</h2>
            <span className="muted">{myTasks.length} 个任务</span>
          </div>
          {myTasks.length === 0 ? (
            <div className="empty">暂无我的任务</div>
          ) : (
            <div className="my-task-rows">
              {myTasks.map((task) => {
                const packages = task.packages.filter((pkg) => pkg.annotatorId === currentUser.id);
                const progress = task.formalItems.length
                  ? Math.round((task.formalItems.filter((item) => item.annotationValues?.length).length / task.formalItems.length) * 100)
                  : 0;
                const canWork = task.selectedAnnotatorId === currentUser.id && task.status !== "cancelled";
                const quote = task.quotes.find((item) => item.annotatorId === currentUser.id);

                return (
                  <article className="my-task-row" key={task.id}>
                    <div className="my-task-thumb">
                      {task.formalItems[0]?.imageUrls[0] || task.trialItems[0]?.imageUrls[0] ? (
                        <img src={task.formalItems[0]?.imageUrls[0] ?? task.trialItems[0]?.imageUrls[0]} alt="" />
                      ) : null}
                    </div>
                    <div className="my-task-main">
                      <div className="row">
                        <span className="badge">{taskStatusLabels[task.status]}</span>
                        <span className="mono">#{task.id.slice(-8).toUpperCase()}</span>
                      </div>
                      <h2>{task.title}</h2>
                      <TaskMeta task={task} />
                      {quote ? <span className="badge warn">我的报价 {money(quote.unitPrice)} · {quote.status}</span> : null}
                      {packages.length ? (
                        <div className="row">
                          {packages.map((pkg) => (
                            <PackageBadge pkg={pkg} key={pkg.id} />
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="my-task-side">
                      <span className="muted">完成进度</span>
                      <strong>{progress}%</strong>
                      <div className="mini-progress">
                        <span style={{ width: `${progress}%` }} />
                      </div>
                      <div className="row">
                        <Link href={`/annotator/tasks/${task.id}`}>
                          <button>查看详情</button>
                        </Link>
                        {canWork ? (
                          <Link href={`/annotator/tasks/${task.id}/workspace`}>
                            <button className="primary">继续标注</button>
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
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
