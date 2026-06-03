"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { TaskMeta } from "@/components/TaskMeta";
import { taskStatusLabels } from "@/lib/labels";
import { getCurrentUser, getTasks } from "@/lib/storage";
import type { Task } from "@/lib/types";
import { money } from "@/lib/utils";

export default function AnnotatorTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    setTasks(getTasks());
  }, []);

  const currentUser = getCurrentUser();
  const hallTasks = tasks.filter((task) => {
    if (task.status === "draft") return false;
    if (task.assignedAnnotatorId && task.assignedAnnotatorId !== currentUser.id && task.selectedAnnotatorId !== currentUser.id) return false;
    if (task.selectedAnnotatorId && task.selectedAnnotatorId !== currentUser.id) return false;
    if (task.selectedAnnotatorId === currentUser.id) return false;
    if (task.status === "completed" || task.status === "cancelled") return false;
    return true;
  });

  const stats = {
    available: hallTasks.length,
    trial: hallTasks.filter((task) => task.entryMode === "trial_quote").length,
    direct: hallTasks.filter((task) => task.entryMode === "direct_formal").length,
    quoted: hallTasks.filter((task) => task.quotes.some((quote) => quote.annotatorId === currentUser.id)).length
  };

  return (
    <main className="shell">
      <AppHeader />
      <div className="page grid">
        <div>
          <div className="row between">
            <div>
              <span className="side-kicker">Task Marketplace</span>
              <h1>标注方任务大厅</h1>
              <p className="muted">这里只展示当前标注方可以领取或试标的任务。标注方不能发布任务。</p>
            </div>
            <Link href="/annotator/tasks/my">
              <button className="primary">我的任务</button>
            </Link>
          </div>
        </div>
        <section className="stats">
          <Stat label="可领取任务" value={stats.available} />
          <Stat label="试标报价任务" value={stats.trial} />
          <Stat label="直接指定任务" value={stats.direct} />
          <Stat label="已提交报价" value={stats.quoted} />
        </section>
        <section className="task-market-grid">
          {hallTasks.length === 0 ? (
            <div className="empty">暂无可见任务</div>
          ) : (
            hallTasks.map((task) => {
              const quote = task.quotes.find((item) => item.annotatorId === currentUser.id);
              const priceLabel = quote
                ? money(quote.unitPrice)
                : task.quotedUnitPrice || task.manualUnitPrice
                  ? money(task.quotedUnitPrice ?? task.manualUnitPrice ?? 0)
                  : "待报价";
              const canTrial = task.entryMode === "trial_quote" && !task.selectedAnnotatorId && task.status !== "cancelled";
              const canClaimDirect = task.entryMode === "direct_formal" && task.assignedAnnotatorId === currentUser.id && !task.selectedAnnotatorId;
              return (
                <article className="market-task-card" key={task.id}>
                  <div className="market-card-media">
                    {task.formalItems[0]?.imageUrls[0] || task.trialItems[0]?.imageUrls[0] ? (
                      <img src={task.formalItems[0]?.imageUrls[0] ?? task.trialItems[0]?.imageUrls[0]} alt="" />
                    ) : null}
                    <span className="badge ok">{taskStatusLabels[task.status]}</span>
                  </div>
                  <div className="market-card-body">
                    <div className="row between">
                      <h2>{task.title}</h2>
                      <strong className="price">{priceLabel}</strong>
                    </div>
                    <p className="muted">{task.description}</p>
                    <TaskMeta task={task} />
                    {quote ? <span className="badge warn">我的报价 {money(quote.unitPrice)} · {quote.status}</span> : null}
                    <div className="market-card-footer">
                      <div className="mini-progress">
                        <span style={{ width: `${Math.min(100, Math.max(8, (task.trialItems.length / Math.max(1, task.trialItems.length + task.formalItems.length)) * 100))}%` }} />
                      </div>
                      <div className="row">
                        <Link href={`/annotator/tasks/${task.id}`}>
                          <button>查看详情</button>
                        </Link>
                        {canTrial ? (
                          <Link href={`/annotator/tasks/${task.id}/trial`}>
                            <button className="primary">{quote ? "继续试标" : "领取任务"}</button>
                          </Link>
                        ) : null}
                        {canClaimDirect ? (
                          <Link href={`/annotator/tasks/${task.id}/workspace`}>
                            <button className="primary">开始标注</button>
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
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
