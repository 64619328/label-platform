"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
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
  const [active, setActive] = useState(0);
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
      <main className="shell">
        <AppHeader />
        <div className="page empty">任务不存在</div>
      </main>
    );
  }

  const current = task.trialItems[active];
  const allComplete = task.trialItems.every((item) => isComplete(values[item.id] ?? item.annotationValues ?? [], task.labelConfigs));
  const isLastTrialItem = active >= task.trialItems.length - 1;

  function saveCurrent(nextValues: AnnotationValue[]) {
    setValues({ ...values, [current.id]: nextValues });
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
    <main className="shell">
      <AppHeader />
      <div className="page page-wide grid">
        <div className="detail-hero">
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
        {message ? <div className="panel">{message}</div> : null}
        {current ? (
          <section className="grid two">
            <div className="panel grid">
              <div className="row between">
                <div>
                  <span className="market-task-id">试标编号 TR-{String(active + 1).padStart(3, "0")}</span>
                  <h2>
                    试标数据 {active + 1} / {task.trialItems.length}
                  </h2>
                </div>
                <span className="badge">{isComplete(values[current.id] ?? current.annotationValues ?? [], task.labelConfigs) ? "已完成" : "待填写"}</span>
              </div>
              <ImageViewer imageUrls={current.imageUrls} displayConfig={task.displayConfig} />
              <SourceDataMeta item={current} />
              <div className="row between">
                <button disabled={active === 0} onClick={() => setActive(active - 1)}>
                  上一条
                </button>
                <button disabled={active >= task.trialItems.length - 1} onClick={() => setActive(active + 1)}>
                  下一条
                </button>
              </div>
            </div>
            <div className="grid">
              <LabelForm labelConfigs={task.labelConfigs} values={values[current.id] ?? current.annotationValues ?? []} onChange={saveCurrent} />
              {isLastTrialItem ? (
                <div className="panel grid">
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
              ) : (
                <div className="panel">
                  <span className="muted">完成全部试标数据后，最后一条会出现报价提交入口。</span>
                </div>
              )}
            </div>
          </section>
        ) : (
          <div className="empty">没有试标数据</div>
        )}
      </div>
    </main>
  );
}
