"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ImageViewer } from "@/components/ImageViewer";
import { isComplete, LabelForm } from "@/components/LabelForm";
import { PackageBadge } from "@/components/TaskMeta";
import { issueTypeLabels } from "@/lib/labels";
import { getCurrentUser, getTasks, saveTasks } from "@/lib/storage";
import { appealItem, ensurePackages, submitPackage, updateFormalItem } from "@/lib/task-actions";
import type { AnnotationValue, Task } from "@/lib/types";

export default function WorkspacePage() {
  const params = useParams<{ taskId: string }>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [packageSize, setPackageSize] = useState(3);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [activeItemId, setActiveItemId] = useState("");
  const [appealReason, setAppealReason] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setTasks(getTasks());
  }, []);

  const task = tasks.find((item) => item.id === params.taskId);
  const currentUser = getCurrentUser();

  const packageItem = useMemo(() => task?.packages.find((pkg) => pkg.id === selectedPackageId) ?? task?.packages[0], [task, selectedPackageId]);
  const packageItems = task && packageItem ? task.formalItems.filter((item) => packageItem.itemIds.includes(item.id)) : [];
  const activeItem = packageItems.find((item) => item.id === activeItemId) ?? packageItems[0];

  if (!task) {
    return (
      <main className="shell">
        <AppHeader />
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
    setSelectedPackageId(nextTask.packages[0]?.id ?? "");
  }

  function saveValues(values: AnnotationValue[]) {
    if (!task || !activeItem) return;
    persist(updateFormalItem(task, activeItem.id, values));
  }

  function submitCurrentPackage() {
    if (!task || !packageItem) return;
    const complete = packageItems.every((item) => isComplete(item.annotationValues ?? [], task.labelConfigs));
    if (!complete) {
      setMessage("请完成该包内所有数据和所有问题组");
      return;
    }
    persist(submitPackage(task, packageItem.id));
    setMessage("子任务包已提交，等待需求方抽检验收");
  }

  function appeal(itemId: string) {
    if (!task || !appealReason.trim()) return;
    persist(appealItem(task, itemId, appealReason));
    setAppealReason("");
  }

  return (
    <main className="shell">
      <AppHeader />
      <div className="page grid">
        <div className="row between">
          <div>
            <h1>正式标注工作台</h1>
            <p className="muted">{task.title}</p>
          </div>
          <Link href="/annotator/tasks">
            <button>返回任务大厅</button>
          </Link>
        </div>
        {message ? <div className="panel">{message}</div> : null}
        {task.status === "cancelled" ? <div className="panel">任务已中止，只能查看历史结果。</div> : null}

        <section className="panel">
          <div className="row between">
            <div>
              <h2>子任务包</h2>
              <p className="muted">首次进入时设置每包数据条数；修改只影响未提交、未验收的后续包。</p>
            </div>
            <div className="row">
              <input style={{ width: 120 }} type="number" min="1" value={packageSize} onChange={(event) => setPackageSize(Number(event.target.value))} />
              <button className="primary" disabled={task.status === "cancelled"} onClick={generatePackages}>
                生成/调整包
              </button>
            </div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            {task.packages.map((pkg) => (
              <button key={pkg.id} className={pkg.id === packageItem?.id ? "primary" : ""} onClick={() => setSelectedPackageId(pkg.id)}>
                {pkg.id.slice(-6)} · {pkg.itemIds.length} 条 · <PackageBadge pkg={pkg} />
              </button>
            ))}
          </div>
        </section>

        {packageItem && activeItem ? (
          <section className="dashboard">
            <div className="panel">
              <h2>包内数据</h2>
              <div className="list">
                {packageItems.map((item, index) => (
                  <button key={item.id} className={item.id === activeItem.id ? "item active" : "item"} onClick={() => setActiveItemId(item.id)}>
                    <div className="row between">
                      <strong>数据 {index + 1}</strong>
                      <span className="badge">{item.reviewStatus}</span>
                    </div>
                    {item.rejectionReason ? (
                      <div className="muted">
                        {item.rejectionIssueType ? issueTypeLabels[item.rejectionIssueType] : "驳回"}：{item.rejectionReason}
                      </div>
                    ) : null}
                  </button>
                ))}
              </div>
              <button style={{ marginTop: 12 }} className="primary" disabled={task.status === "cancelled"} onClick={submitCurrentPackage}>
                提交当前子任务包
              </button>
            </div>

            <div className="grid">
              <div className="panel grid">
                <div className="row between">
                  <h2>{activeItem.id}</h2>
                  <span className="badge">{activeItem.reviewStatus}</span>
                </div>
                <ImageViewer imageUrls={activeItem.imageUrls} displayConfig={task.displayConfig} />
              </div>
              <LabelForm labelConfigs={task.labelConfigs} values={activeItem.annotationValues ?? []} onChange={saveValues} />
              {activeItem.rejectionReason ? (
                <div className="panel grid">
                  <h2>驳回与申诉</h2>
                  <p>
                    {activeItem.rejectionIssueType ? issueTypeLabels[activeItem.rejectionIssueType] : "驳回"}：{activeItem.rejectionReason}
                  </p>
                  <textarea disabled={activeItem.hasAppealed} placeholder="申诉/质疑原因" value={appealReason} onChange={(event) => setAppealReason(event.target.value)} />
                  <button disabled={Boolean(activeItem.hasAppealed)} onClick={() => appeal(activeItem.id)}>
                    {activeItem.hasAppealed ? "已申诉" : "提交一次申诉"}
                  </button>
                </div>
              ) : null}
            </div>
          </section>
        ) : (
          <div className="empty">请先生成子任务包</div>
        )}
      </div>
    </main>
  );
}
