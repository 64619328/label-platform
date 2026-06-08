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
  const [activeIndex, setActiveIndex] = useState(0);

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
  const trialItemCount = task.trialItems.length;
  const activeItem = task.trialItems[activeIndex];
  const activeValues = activeItem ? values[activeItem.id] ?? activeItem.annotationValues ?? [] : [];
  const activeComplete = activeItem ? isComplete(activeValues, task.labelConfigs) : false;

  function saveCurrent(itemId: string, nextValues: AnnotationValue[]) {
    setValues({ ...values, [itemId]: nextValues });
  }

  function goNext(requireComplete = false) {
    if (!activeItem) return;
    if (requireComplete && !activeComplete) {
      setMessage("当前数据还没有完成所有问题组；如需暂时略过，请点击「跳过」。");
      return;
    }
    setMessage("");
    setActiveIndex((index) => Math.min(trialItemCount, index + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function skipCurrent() {
    setMessage("");
    setActiveIndex((index) => Math.min(trialItemCount, index + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
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
            {activeItem ? (
              <article className="panel annotation-item-card" key={activeItem.id}>
                <div className="row between annotation-item-head">
                  <div>
                    <span className="market-task-id">试标编号 TR-{String(activeIndex + 1).padStart(3, "0")}</span>
                    <h2>试标数据 {activeIndex + 1} / {task.trialItems.length}</h2>
                  </div>
                  <span className="badge">{activeComplete ? "已完成" : "待填写"}</span>
                </div>
                <div className="annotation-item-content">
                  <div className="grid annotation-item-media">
                    <ImageViewer imageUrls={activeItem.imageUrls} sourceData={activeItem.sourceData} displayConfig={task.displayConfig} />
                    <SourceDataMeta item={activeItem} />
                  </div>
                  <div className="grid annotation-item-form">
                    <LabelForm labelConfigs={task.labelConfigs} values={activeValues} onChange={(nextValues) => saveCurrent(activeItem.id, nextValues)} />
                  </div>
                </div>
                <div className="annotation-page-actions">
                  <button disabled={activeIndex >= task.trialItems.length - 1} onClick={() => goNext(false)}>下一页</button>
                  <button className="primary" onClick={() => goNext(true)}>
                    {activeIndex >= task.trialItems.length - 1 ? "保存并进入报价" : "保存并下一页"}
                  </button>
                  <button disabled={activeIndex >= task.trialItems.length - 1} onClick={skipCurrent}>跳过</button>
                </div>
              </article>
            ) : null}
            {!activeItem ? (
              <div className="panel grid trial-quote-panel">
              <h2>提交报价</h2>
              <p className="muted">已到达试标数据末尾。提交报价前，需要完成所有试标数据的问题组。</p>
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
              <button onClick={() => setActiveIndex(Math.max(0, task.trialItems.length - 1))}>返回上一条数据</button>
            </div>
            ) : null}
          </section>
        ) : (
          <div className="empty">没有试标数据</div>
        )}
      </div>
    </main>
  );
}
