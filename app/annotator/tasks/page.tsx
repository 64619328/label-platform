"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { statusBadgeClass, taskStatusLabels } from "@/lib/labels";
import { getCurrentUser, getTasks } from "@/lib/storage";
import type { Task } from "@/lib/types";
import { formatDate, money } from "@/lib/utils";

const quoteStatusLabels = {
  draft: "草稿",
  submitted: "已提交",
  selected: "已选择",
  not_selected: "未选择"
} as const;

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
      <div className="page page-wide grid">
        <div>
          <div className="row between">
            <div>
              <span className="side-kicker">Task Marketplace</span>
              <h1>任务大厅</h1>
              <p className="muted">这里展示可以领取或试标的任务。当前身份不能发布任务。</p>
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
        <section className="task-market-list">
          {hallTasks.length === 0 ? (
            <div className="empty">暂无可见任务</div>
          ) : (
            hallTasks.map((task, index) => {
              const quote = task.quotes.find((item) => item.annotatorId === currentUser.id);
              const priceLabel = quote
                ? money(quote.unitPrice)
                : task.quotedUnitPrice || task.manualUnitPrice
                  ? money(task.quotedUnitPrice ?? task.manualUnitPrice ?? 0)
                  : "待报价";
              const canTrial = task.entryMode === "trial_quote" && !task.selectedAnnotatorId && task.status !== "cancelled";
              const canClaimDirect = task.entryMode === "direct_formal" && task.assignedAnnotatorId === currentUser.id && !task.selectedAnnotatorId;
              const imageUrl = task.formalItems[0]?.imageUrls[0] ?? task.trialItems[0]?.imageUrls[0];
              return (
                <article className="market-task-row" key={task.id}>
                  <div className="market-task-thumb">
                    {imageUrl ? (
                      <img src={imageUrl} alt="" />
                    ) : null}
                  </div>
                  <div className="market-task-main">
                    <div className="market-task-title">
                      <div>
                        <span className="market-task-id">任务编号 T-{String(index + 1).padStart(3, "0")}</span>
                        <h2>{task.title}</h2>
                      </div>
                      <span className={statusBadgeClass(task.status)}>{taskStatusLabels[task.status]}</span>
                    </div>
                    <p className="muted">{task.description}</p>
                    <div className="market-task-meta">
                      <span className="badge">截止 {formatDate(task.deadline)}</span>
                      <span className="badge">试标 {task.trialItems.length} 条</span>
                      <span className="badge">正式数据 {task.formalItems.length} 条</span>
                      <span className="badge">单价 {priceLabel}</span>
                      {quote ? <span className="badge warn">我的报价 {money(quote.unitPrice)} · {quoteStatusLabels[quote.status]}</span> : null}
                    </div>
                  </div>
                  <div className="market-task-actions">
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
