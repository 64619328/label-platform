"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ImageViewer } from "@/components/ImageViewer";
import { isComplete, LabelForm } from "@/components/LabelForm";
import { SourceDataMeta } from "@/components/SourceDataMeta";
import { annotationReviewStatusLabels, issueTypeLabels, statusBadgeClass } from "@/lib/labels";
import { getCurrentUser, getTasks, saveTasks } from "@/lib/storage";
import { appealItem, ensurePackages, submitPackage, updateFormalItem } from "@/lib/task-actions";
import type { AnnotationValue, Task } from "@/lib/types";

export default function WorkspacePage() {
  const params = useParams<{ taskId: string }>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [packageSize, setPackageSize] = useState(3);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [activeItemId, setActiveItemId] = useState("");
  const [packageDrawerOpen, setPackageDrawerOpen] = useState(false);
  const [appealReasons, setAppealReasons] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    setTasks(getTasks());
  }, []);

  const task = tasks.find((item) => item.id === params.taskId);
  const currentUser = getCurrentUser();

  const myPackages = useMemo(() => task?.packages.filter((pkg) => pkg.annotatorId === currentUser.id) ?? [], [task, currentUser.id]);
  const claimableCount = task?.packages.filter((pkg) => !pkg.annotatorId && pkg.status === "not_started").length ?? 0;
  const activeOwnedPackage = myPackages.find((pkg) => pkg.status === "not_started" || pkg.status === "in_progress");
  const packageItem = useMemo(() => myPackages.find((pkg) => pkg.id === selectedPackageId) ?? activeOwnedPackage ?? myPackages[0], [myPackages, selectedPackageId, activeOwnedPackage]);
  const packageItems = task && packageItem ? task.formalItems.filter((item) => packageItem.itemIds.includes(item.id)) : [];
  const activeItemIndex = packageItems.findIndex((item) => item.id === activeItemId);
  const activeItem = activeItemIndex >= 0 ? packageItems[activeItemIndex] : packageItems[0];
  const packageComplete = task ? packageItems.length > 0 && packageItems.every((item) => isComplete(item.annotationValues ?? [], task.labelConfigs)) : false;
  const packageCompletedCount = task ? packageItems.filter((item) => isComplete(item.annotationValues ?? [], task.labelConfigs)).length : 0;

  useEffect(() => {
    if (!packageItems.length) {
      setActiveItemId("");
      return;
    }
    if (!packageItems.some((item) => item.id === activeItemId)) {
      setActiveItemId(packageItems[0].id);
    }
  }, [activeItemId, packageItems]);

  if (!task) {
    return (
      <main className="shell annotation-shell">
        <div className="page empty">任务不存在</div>
      </main>
    );
  }

  function persist(nextTask: Task) {
    const next = tasks.map((item) => (item.id === nextTask.id ? nextTask : item));
    setTasks(next);
    saveTasks(next);
  }

  function generatePackages() {
    if (!task) return;
    const nextTask = ensurePackages(task, currentUser.id, packageSize);
    persist(nextTask);
    const nextPackage = nextTask.packages.find((pkg) => pkg.annotatorId === currentUser.id && (pkg.status === "not_started" || pkg.status === "in_progress"));
    setSelectedPackageId(nextPackage?.id ?? selectedPackageId);
    setMessage(nextPackage ? "已领取一个子任务包" : "暂无可领取的子任务包");
  }

  function saveValues(itemId: string, values: AnnotationValue[]) {
    if (!task) return;
    persist(updateFormalItem(task, itemId, values));
  }

  function jumpToItem(itemId: string) {
    setActiveItemId(itemId);
    setPackageDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goNext(requireComplete = false) {
    if (!task || !activeItem) return;
    const complete = isComplete(activeItem.annotationValues ?? [], task.labelConfigs);
    if (requireComplete && !complete) {
      setMessage("当前数据还没有完成所有问题组；如需暂时略过，请点击「跳过」。");
      return;
    }
    const nextItem = packageItems[Math.min(packageItems.length - 1, activeItemIndex + 1)];
    if (nextItem) {
      setActiveItemId(nextItem.id);
      setMessage("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function skipCurrent() {
    const nextItem = packageItems[Math.min(packageItems.length - 1, activeItemIndex + 1)];
    if (nextItem) {
      setActiveItemId(nextItem.id);
      setMessage("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function submitCurrentPackage() {
    if (!task || !packageItem) return;
    if (!packageComplete) {
      setMessage("请完成该包内所有数据和所有问题组");
      return;
    }
    const submittedTask = submitPackage(task, packageItem.id);
    const claimableAfterSubmit = submittedTask.packages.filter((pkg) => !pkg.annotatorId && pkg.status === "not_started").length;
    if (claimableAfterSubmit > 0 && window.confirm("当前子任务包已提交。是否继续领取下一个子任务包？")) {
      const nextTask = ensurePackages(submittedTask, currentUser.id, packageSize);
      const nextPackage = nextTask.packages.find((pkg) => pkg.annotatorId === currentUser.id && (pkg.status === "not_started" || pkg.status === "in_progress"));
      const firstItemId = nextPackage ? nextTask.formalItems.find((item) => nextPackage.itemIds.includes(item.id))?.id : "";
      persist(nextTask);
      setSelectedPackageId(nextPackage?.id ?? "");
      setActiveItemId(firstItemId ?? "");
      setMessage(nextPackage ? "已提交当前子任务包，并领取下一个子任务包。" : "当前子任务包已提交，暂无可领取的子任务包。");
      return;
    }
    persist(submittedTask);
    setSelectedPackageId("");
    setActiveItemId("");
    setMessage(claimableAfterSubmit > 0 ? "子任务包已提交，等待需求方抽检验收。可继续手动领取新的子任务包。" : "当前任务已完成，无任务包可领取");
  }

  function appeal(itemId: string) {
    const reason = appealReasons[itemId]?.trim();
    if (!task || !reason) return;
    persist(appealItem(task, itemId, reason));
    setAppealReasons((current) => ({ ...current, [itemId]: "" }));
  }

  return (
    <main className="shell annotation-shell">
      <div className="annotation-workspace-nav">
        <div>
          <h1>正式标注工作台</h1>
          <p className="muted">{task.title}</p>
        </div>
        <div className="market-task-actions">
          <Link href="/annotator/tasks">
            <button>返回任务大厅</button>
          </Link>
        </div>
      </div>
      <div className="page page-wide grid annotation-workspace has-workspace-nav">
        {message ? <div className="panel annotation-message">{message}</div> : null}
        {task.status === "cancelled" ? <div className="panel annotation-message">任务已中止，只能查看历史结果。</div> : null}

        {!packageItem || !packageItems.length ? (
          <section className="panel annotation-package-panel annotation-claim-panel">
            <div>
              <h2>领取子任务包</h2>
              <p className="muted">开始标注前，先领取一个子任务包；进入标注后页面会切换为纯净标注视图。</p>
            </div>
            <div className="row">
              <input style={{ width: 120 }} type="number" min="1" value={packageSize} onChange={(event) => setPackageSize(Number(event.target.value))} />
              <button
                className="primary"
                disabled={task.status === "cancelled" || task.status === "completed" || Boolean(activeOwnedPackage) || (task.packages.length > 0 && claimableCount === 0)}
                onClick={generatePackages}
              >
                {task.packages.length === 0 ? "生成并领取子任务包" : "领取下一个子任务包"}
              </button>
            </div>
            <div className="row">
              <span className="badge">我的任务包 {myPackages.length}</span>
              <span className="badge">待领取 {claimableCount}</span>
            </div>
          </section>
        ) : null}

        {packageItem && packageItems.length ? (
          <section className="dashboard annotation-dashboard pure-annotation-dashboard">
            <button className="package-floating-trigger" onClick={() => setPackageDrawerOpen((open) => !open)} aria-expanded={packageDrawerOpen}>
              <span>包内数据</span>
              <strong>{packageCompletedCount}/{packageItems.length}</strong>
            </button>
            {packageDrawerOpen ? (
              <div className="package-floating-drawer">
                <div className="row between">
                  <div>
                    <h2>包内数据</h2>
                    <p className="muted">当前包进度 {packageCompletedCount} / {packageItems.length}</p>
                  </div>
                  <button className="icon-button" onClick={() => setPackageDrawerOpen(false)}>×</button>
                </div>
                <div className="list">
                  {packageItems.map((item, index) => {
                    const complete = isComplete(item.annotationValues ?? [], task.labelConfigs);
                    return (
                      <button key={item.id} className={item.id === activeItemId ? "item active" : "item"} onClick={() => jumpToItem(item.id)}>
                        <div className="row between">
                          <strong>数据 A-{String(index + 1).padStart(3, "0")}</strong>
                          <span className={complete ? "badge ok" : statusBadgeClass(item.reviewStatus)}>
                            {complete ? "已填写" : annotationReviewStatusLabels[item.reviewStatus]}
                          </span>
                        </div>
                        {item.rejectionReason ? (
                          <div className="muted">
                            {item.rejectionIssueType ? issueTypeLabels[item.rejectionIssueType] : "驳回"}：{item.rejectionReason}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="annotation-item-stream">
              {activeItem ? (
                <article className="panel annotation-item-card" id={`formal-item-${activeItem.id}`} key={activeItem.id}>
                  <div className="row between annotation-item-head">
                    <div>
                      <span className="market-task-id">数据编号 {activeItem.id}</span>
                      <h2>数据 A-{String((activeItemIndex >= 0 ? activeItemIndex : 0) + 1).padStart(3, "0")} / {packageItems.length}</h2>
                    </div>
                    <span className={statusBadgeClass(activeItem.reviewStatus)}>{annotationReviewStatusLabels[activeItem.reviewStatus]}</span>
                  </div>
                  <div className="annotation-item-content">
                    <div className="grid annotation-item-media">
                      <ImageViewer imageUrls={activeItem.imageUrls} sourceData={activeItem.sourceData} displayConfig={task.displayConfig} />
                      <SourceDataMeta item={activeItem} />
                    </div>
                    <div className="grid annotation-item-form">
                      <LabelForm labelConfigs={task.labelConfigs} values={activeItem.annotationValues ?? []} onChange={(values) => saveValues(activeItem.id, values)} />
                      {activeItem.rejectionReason ? (
                        <div className="panel grid">
                          <h2>驳回与申诉</h2>
                          <p>
                            {activeItem.rejectionIssueType ? issueTypeLabels[activeItem.rejectionIssueType] : "驳回"}：{activeItem.rejectionReason}
                          </p>
                          <textarea
                            disabled={activeItem.hasAppealed}
                            placeholder="申诉/质疑原因"
                            value={appealReasons[activeItem.id] ?? ""}
                            onChange={(event) => setAppealReasons((current) => ({ ...current, [activeItem.id]: event.target.value }))}
                          />
                          <button disabled={Boolean(activeItem.hasAppealed)} onClick={() => appeal(activeItem.id)}>
                            {activeItem.hasAppealed ? "已申诉" : "提交一次申诉"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="annotation-page-actions">
                    <button disabled={activeItemIndex >= packageItems.length - 1} onClick={() => goNext(false)}>下一页</button>
                    <button className="primary" disabled={activeItemIndex >= packageItems.length - 1} onClick={() => goNext(true)}>保存并下一页</button>
                    <button disabled={activeItemIndex >= packageItems.length - 1} onClick={skipCurrent}>跳过</button>
                    {packageComplete ? (
                      <button className="primary submit-package-action" disabled={task.status === "cancelled"} onClick={submitCurrentPackage}>
                        提交当前子任务包
                      </button>
                    ) : null}
                  </div>
                </article>
              ) : null}
            </div>
          </section>
        ) : (
          <div className="empty">请先领取子任务包</div>
        )}
      </div>
    </main>
  );
}
