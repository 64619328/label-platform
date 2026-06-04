"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnnotatorShell } from "@/components/AnnotatorShell";
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

export default function AnnotatorTrialTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    setTasks(getTasks());
  }, []);

  const currentUser = getCurrentUser();
  const trialTasks = tasks.filter((task) => {
    if (task.entryMode !== "trial_quote") return false;
    if (task.status === "draft" || task.status === "completed" || task.status === "cancelled") return false;
    if (task.assignedAnnotatorId && task.assignedAnnotatorId !== currentUser.id) return false;
    if (task.selectedAnnotatorId) return false;
    return true;
  });

  const submittedCount = trialTasks.filter((task) => task.quotes.some((quote) => quote.annotatorId === currentUser.id)).length;
  const pendingSelectionCount = trialTasks.filter((task) => task.status === "pending_quote_selection").length;

  return (
    <AnnotatorShell title="试标任务">
      <div className="page page-wide grid">
        <section className="stats three">
          <Stat label="可试标任务" value={trialTasks.length} />
          <Stat label="已提交报价" value={submittedCount} />
          <Stat label="等待需求方选择" value={pendingSelectionCount} />
        </section>

        <section className="panel my-task-list">
          <div className="monitor-head">
            <h2>试标列表</h2>
            <span className="muted">{trialTasks.length} 个任务</span>
          </div>
          {trialTasks.length === 0 ? (
            <div className="empty">暂无试标任务</div>
          ) : (
            <div className="my-task-rows">
              {trialTasks.map((task, index) => {
                const quote = task.quotes.find((item) => item.annotatorId === currentUser.id);
                const imageUrl = task.trialItems[0]?.imageUrls[0] ?? task.formalItems[0]?.imageUrls[0];
                const priceLabel = quote
                  ? money(quote.unitPrice)
                  : task.quotedUnitPrice || task.manualUnitPrice
                    ? money(task.quotedUnitPrice ?? task.manualUnitPrice ?? 0)
                    : "待报价";

                return (
                  <article className="my-task-row" key={task.id}>
                    <div className="my-task-thumb">
                      {imageUrl ? <img src={imageUrl} alt="" /> : null}
                    </div>
                    <div className="my-task-main">
                      <div className="market-task-title">
                        <div>
                          <span className="market-task-id">试标编号 Q-{String(index + 1).padStart(3, "0")}</span>
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
                    <div className="my-task-side">
                      <span className="muted">试标进度</span>
                      <strong>{quote ? "已提交" : "待提交"}</strong>
                      <div className="market-task-actions">
                        <Link href={`/annotator/tasks/${task.id}`}>
                          <button>查看详情</button>
                        </Link>
                        <Link href={`/annotator/tasks/${task.id}/trial`}>
                          <button className="primary">{quote ? "查看试标" : "开始试标"}</button>
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AnnotatorShell>
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
