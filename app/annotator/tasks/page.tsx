"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnnotatorShell } from "@/components/AnnotatorShell";
import { statusBadgeClass, taskStatusLabels } from "@/lib/labels";
import { getCurrentUser, getTasks } from "@/lib/storage";
import { taskCoverImage } from "@/lib/task-cover";
import type { Task } from "@/lib/types";
import { formatDate, money } from "@/lib/utils";

const quoteStatusLabels = {
  draft: "草稿",
  submitted: "已提交",
  selected: "已选择",
  not_selected: "未选择"
} as const;

type HallFilter = "all" | "trial" | "direct" | "quoted" | "assigned";

export default function AnnotatorTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<HallFilter>("all");

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
  const normalizedQuery = query.trim().toLowerCase();
  const visibleTasks = hallTasks.filter((task) => {
    const quote = task.quotes.find((item) => item.annotatorId === currentUser.id);
    const canTrial = task.entryMode === "trial_quote" && !task.selectedAnnotatorId && task.status !== "cancelled";
    const canClaimDirect = task.entryMode === "direct_formal" && task.assignedAnnotatorId === currentUser.id && !task.selectedAnnotatorId;

    if (filter === "trial" && !canTrial) return false;
    if (filter === "direct" && !canClaimDirect) return false;
    if (filter === "quoted" && !quote) return false;
    if (filter === "assigned" && task.assignedAnnotatorId !== currentUser.id) return false;

    if (!normalizedQuery) return true;
    return [task.id, task.title, task.description, task.requesterId]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery));
  });
  const filterItems: Array<{ label: string; value: HallFilter; count: number }> = [
    { label: "全部", value: "all", count: hallTasks.length },
    { label: "可试标", value: "trial", count: hallTasks.filter((task) => task.entryMode === "trial_quote" && !task.selectedAnnotatorId && task.status !== "cancelled").length },
    { label: "正式领取", value: "direct", count: hallTasks.filter((task) => task.entryMode === "direct_formal" && task.assignedAnnotatorId === currentUser.id && !task.selectedAnnotatorId).length },
    { label: "已报价", value: "quoted", count: hallTasks.filter((task) => task.quotes.some((item) => item.annotatorId === currentUser.id)).length },
    { label: "指定给我", value: "assigned", count: hallTasks.filter((task) => task.assignedAnnotatorId === currentUser.id).length }
  ];
  const emptyMessage = hallTasks.length === 0
    ? "暂无可见任务。当前身份下没有可领取、可试标或指定给你的任务。"
    : "当前搜索或筛选下没有任务，可以清空搜索或切换筛选条件。";

  return (
    <AnnotatorShell title="任务大厅">
      <div className="page page-wide grid">
        <div className="task-market-head">
          <div>
            <h2>可领取任务</h2>
            <p className="muted">按任务状态和进入方式选择试标或正式标注。</p>
          </div>
          <span className="badge">{visibleTasks.length} / {hallTasks.length} 个任务</span>
        </div>
        <div className="task-market-controls">
          <label className="search-box task-market-search">
            <span>⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索任务名称、编号或描述" />
          </label>
          <div className="filter-tabs task-market-filters">
            {filterItems.map((item) => (
              <button key={item.value} className={filter === item.value ? "filter-tab active" : "filter-tab"} onClick={() => setFilter(item.value)}>
                {item.label}
                <span>{item.count}</span>
              </button>
            ))}
          </div>
        </div>
        <section className="task-market-list">
          {visibleTasks.length === 0 ? (
            <div className="empty">{emptyMessage}</div>
          ) : (
            visibleTasks.map((task, index) => {
              const quote = task.quotes.find((item) => item.annotatorId === currentUser.id);
              const priceLabel = quote
                ? money(quote.unitPrice)
                : task.quotedUnitPrice || task.manualUnitPrice
                  ? money(task.quotedUnitPrice ?? task.manualUnitPrice ?? 0)
                  : "待报价";
              const canTrial = task.entryMode === "trial_quote" && !task.selectedAnnotatorId && task.status !== "cancelled";
              const canClaimDirect = task.entryMode === "direct_formal" && task.assignedAnnotatorId === currentUser.id && !task.selectedAnnotatorId;
              const imageUrl = taskCoverImage(task, task.entryMode === "trial_quote" ? "trial" : "formal");
              const primaryActionLabel = quote ? "继续试标" : "开始试标";
              const entryLabel = task.entryMode === "trial_quote" ? "试标任务" : "正式领取";
              return (
                <article className="market-task-row" key={task.id}>
                  <div className="market-task-thumb">
                    {imageUrl ? (
                      <img src={imageUrl} alt="" />
                    ) : <span>暂无封面</span>}
                  </div>
                  <div className="market-task-main">
                    <div className="market-task-title">
                      <div>
                        <span className="market-task-id">任务编号 T-{String(index + 1).padStart(3, "0")}</span>
                        <h2>{task.title}</h2>
                      </div>
                      <div className="task-card-statuses">
                        <span className="badge task-entry-badge">{entryLabel}</span>
                        <span className={statusBadgeClass(task.status)}>{taskStatusLabels[task.status]}</span>
                      </div>
                    </div>
                    <p className="muted">{task.description}</p>
                    <div className="market-task-meta">
                      <span className="badge">截止 {formatDate(task.deadline)}</span>
                      <span className="badge">试标 {task.trialItems.length} 条</span>
                      <span className="badge">正式数据 {task.formalItems.length} 条</span>
                      <span className="badge price-badge">单价 {priceLabel}</span>
                      {quote ? <span className="badge warn">我的报价 {money(quote.unitPrice)} · {quoteStatusLabels[quote.status]}</span> : null}
                    </div>
                  </div>
                  <div className="market-task-actions">
                    <Link href={`/annotator/tasks/${task.id}`}>
                      <button>查看详情</button>
                    </Link>
                    {canTrial ? (
                      <Link href={`/annotator/tasks/${task.id}/trial`}>
                        <button className="primary">{primaryActionLabel}</button>
                      </Link>
                    ) : null}
                    {canClaimDirect ? (
                      <Link href={`/annotator/tasks/${task.id}/workspace`}>
                        <button className="primary">领取任务</button>
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>
    </AnnotatorShell>
  );
}
