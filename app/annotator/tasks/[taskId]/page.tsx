"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AnnotatorShell } from "@/components/AnnotatorShell";
import { statusBadgeClass, taskStatusLabels } from "@/lib/labels";
import { getCurrentUser, getTasks } from "@/lib/storage";
import type { Task } from "@/lib/types";
import { formatDate, money } from "@/lib/utils";

export default function AnnotatorTaskDetailPage() {
  const params = useParams<{ taskId: string }>();
  const [task, setTask] = useState<Task | undefined>();

  useEffect(() => {
    setTask(getTasks().find((item) => item.id === params.taskId));
  }, [params.taskId]);

  const currentUser = getCurrentUser();
  if (!task) {
    return (
      <AnnotatorShell title="任务详情">
        <div className="page empty">任务不存在</div>
      </AnnotatorShell>
    );
  }

  const canTrial = task.entryMode === "trial_quote" && !task.selectedAnnotatorId && task.status !== "cancelled";
  const canWork = task.selectedAnnotatorId === currentUser.id && task.status !== "cancelled";

  return (
    <AnnotatorShell title="任务详情">
      <div className="page page-wide grid">
        <div className="detail-hero">
          <div>
            <span className="market-task-id">任务编号 {task.id}</span>
            <h1>{task.title}</h1>
            <div className="market-task-meta">
              <span className={statusBadgeClass(task.status)}>{taskStatusLabels[task.status]}</span>
              <span className="badge">截止 {formatDate(task.deadline)}</span>
              <span className="badge">试标 {task.trialItems.length} 条</span>
              <span className="badge">正式数据 {task.formalItems.length} 条</span>
              <span className="badge">单价 {money(task.quotedUnitPrice ?? task.manualUnitPrice ?? 0)}</span>
            </div>
          </div>
          <div className="market-task-actions">
            {canTrial ? (
              <Link href={`/annotator/tasks/${task.id}/trial`}>
                <button className="primary">进入试标</button>
              </Link>
            ) : null}
            {canWork ? (
              <Link href={`/annotator/tasks/${task.id}/workspace`}>
                <button className="primary">进入标注</button>
              </Link>
            ) : null}
          </div>
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
            <p>展示布局：{task.displayConfig.layoutMode === "custom" ? `自定义画布（${task.displayConfig.frames?.length ?? 0} 个框）` : "基础图片展示"}</p>
            <p>图片：{task.displayConfig.imageDataMode === "single_image" ? "单张" : "多张"}</p>
            <p>展示：{task.displayConfig.layoutMode === "custom" ? "按任务创建时的画布展示" : task.displayConfig.multiImageDisplayMode === "carousel" ? "左右切换" : "并列展示"}</p>
            <p>细节查看：{task.displayConfig.layoutMode === "custom" ? "点击图片/视频全屏查看并左右切换" : task.displayConfig.enableDoubleClickZoom ? "支持双击放大" : "不支持"}</p>
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
      </div>
    </AnnotatorShell>
  );
}
