"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ImageViewer } from "@/components/ImageViewer";
import { isComplete, LabelForm } from "@/components/LabelForm";
import { SourceDataMeta } from "@/components/SourceDataMeta";
import { getCurrentUser, getTasks, saveTasks } from "@/lib/storage";
import { submitQuote } from "@/lib/task-actions";
import type { AnnotationValue, Task } from "@/lib/types";

export default function TrialPage() {
  const params = useParams<{ taskId: string }>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [values, setValues] = useState<Record<string, AnnotationValue[]>>({});
  const [unitPrice, setUnitPrice] = useState(1);
  const [quoteNote, setQuoteNote] = useState("可以按要求完成，预计 2 天交付。");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setTasks(getTasks());
  }, []);

  const task = tasks.find((item) => item.id === params.taskId);
  const currentUser = getCurrentUser();

  if (!task) {
    return (
      <main className="shell annotation-shell">
        <div className="page empty">任务不存在</div>
      </main>
    );
  }

  const allComplete = task.trialItems.every((item) => isComplete(values[item.id] ?? item.annotationValues ?? [], task.labelConfigs));

  function saveCurrent(itemId: string, nextValues: AnnotationValue[]) {
    setValues({ ...values, [itemId]: nextValues });
  }

  function submit() {
    if (!task) return;
    if (!allComplete) {
      setMessage("请完成所有试标数据的问题组");
      return;
    }
    if (unitPrice <= 0) {
      setMessage("请填写报价单价");
      return;
    }
    const nextTask = submitQuote(task, currentUser.id, unitPrice, quoteNote, values);
    const next = tasks.map((item) => (item.id === task.id ? nextTask : item));
    saveTasks(next);
    setTasks(next);
    window.location.href = "/annotator/tasks";
  }

  return (
    <main className="shell annotation-shell">
      <div className="annotation-workspace-nav">
        <div>
          <h1>试标工作台</h1>
          <p className="muted">{task.title}</p>
        </div>
        <div className="market-task-actions">
          <Link href="/annotator/tasks">
            <button>返回任务大厅</button>
          </Link>
        </div>
      </div>
      <div className="page page-wide grid annotation-workspace has-workspace-nav trial-workspace">
        {message ? <div className="panel annotation-message">{message}</div> : null}
        {task.trialItems.length ? (
          <section className="annotation-item-stream trial-item-stream">
            {task.trialItems.map((item, index) => (
              <article className="panel annotation-item-card" key={item.id}>
                <div className="row between annotation-item-head">
                  <div>
                    <span className="market-task-id">试标编号 TR-{String(index + 1).padStart(3, "0")}</span>
                    <h2>试标数据 {index + 1} / {task.trialItems.length}</h2>
                  </div>
                  <span className="badge">{isComplete(values[item.id] ?? item.annotationValues ?? [], task.labelConfigs) ? "已完成" : "待填写"}</span>
                </div>
                <div className="annotation-item-content">
                  <div className="grid annotation-item-media">
                    <ImageViewer imageUrls={item.imageUrls} displayConfig={task.displayConfig} />
                    <SourceDataMeta item={item} />
                  </div>
                  <div className="grid annotation-item-form">
                    <LabelForm labelConfigs={task.labelConfigs} values={values[item.id] ?? item.annotationValues ?? []} onChange={(nextValues) => saveCurrent(item.id, nextValues)} />
                  </div>
                </div>
              </article>
            ))}
            <div className="panel grid trial-quote-panel">
              <h2>提交报价</h2>
              <div className="field">
                <label>每条数据单价</label>
                <input type="number" min="0" step="0.01" value={unitPrice} onChange={(event) => setUnitPrice(Number(event.target.value))} />
              </div>
              <div className="field">
                <label>报价说明</label>
                <textarea value={quoteNote} onChange={(event) => setQuoteNote(event.target.value)} />
              </div>
              <button className="primary" disabled={!allComplete} onClick={submit}>
                提交试标和报价
              </button>
            </div>
          </section>
        ) : (
          <div className="empty">没有试标数据</div>
        )}
      </div>
    </main>
  );
}
