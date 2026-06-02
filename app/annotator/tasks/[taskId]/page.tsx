"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { TaskMeta } from "@/components/TaskMeta";
import { getCurrentUser, getTasks } from "@/lib/storage";
import type { Task } from "@/lib/types";

export default function AnnotatorTaskDetailPage() {
  const params = useParams<{ taskId: string }>();
  const [task, setTask] = useState<Task | undefined>();

  useEffect(() => {
    setTask(getTasks().find((item) => item.id === params.taskId));
  }, [params.taskId]);

  const currentUser = getCurrentUser();
  if (!task) {
    return (
      <main className="shell">
        <AppHeader />
        <div className="page empty">任务不存在</div>
      </main>
    );
  }

  const canTrial = task.entryMode === "trial_quote" && !task.selectedAnnotatorId && task.status !== "cancelled";
  const canWork = task.selectedAnnotatorId === currentUser.id && task.status !== "cancelled";

  return (
    <main className="shell">
      <AppHeader />
      <div className="page grid">
        <div className="row between">
          <div>
            <h1>{task.title}</h1>
            <TaskMeta task={task} />
          </div>
          <Link href="/annotator/tasks">
            <button>返回任务大厅</button>
          </Link>
        </div>
        <section className="grid two">
          <div className="panel">
            <h2>任务说明</h2>
            <p>{task.description}</p>
            <h3>培训说明</h3>
            <p className="muted">{task.trainingContent}</p>
            <h3>标注规则</h3>
            <p className="muted">{task.rules}</p>
          </div>
          <div className="panel">
            <h2>配置</h2>
            <p>图片：{task.displayConfig.imageDataMode === "single_image" ? "单张" : "多张"}</p>
            <p>展示：{task.displayConfig.multiImageDisplayMode === "carousel" ? "左右切换" : "并列展示"}</p>
            <p>双击放大：{task.displayConfig.enableDoubleClickZoom ? "支持" : "不支持"}</p>
            <p>试标数据：{task.trialItems.length} 条</p>
            <p>正式数据：{task.formalItems.length} 条</p>
          </div>
        </section>
        <section className="panel">
          <h2>标签问题组</h2>
          <div className="grid">
            {task.labelConfigs.map((config) => (
              <div className="item" key={config.id}>
                <strong>{config.title}</strong>
                <p className="muted">{config.selectionMode === "single" ? "单选" : "多选"}</p>
                <div className="row">
                  {config.options.map((option) => (
                    <span className="badge" key={option.id}>
                      {option.label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
        <div className="row">
          {canTrial ? (
            <Link href={`/annotator/tasks/${task.id}/trial`}>
              <button className="primary">进入试标工作台</button>
            </Link>
          ) : null}
          {canWork ? (
            <Link href={`/annotator/tasks/${task.id}/workspace`}>
              <button className="primary">进入正式标注工作台</button>
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}
