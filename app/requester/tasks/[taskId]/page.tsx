"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { RequesterShell } from "@/components/RequesterShell";
import { RequesterTaskDetail } from "@/components/RequesterTaskDetail";
import { ensureDemoData, getCurrentUser, getTasks, getUsers, saveTasks } from "@/lib/storage";
import type { Task } from "@/lib/types";

export default function RequesterTaskDetailPage() {
  const params = useParams<{ taskId: string }>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    ensureDemoData();
    setTasks(getTasks());
    setLoaded(true);
  }, []);

  const currentUser = getCurrentUser();
  const users = getUsers();
  const task = tasks.find((item) => item.id === params.taskId && item.requesterId === currentUser.id);

  function persist(nextTask: Task) {
    const next = tasks.map((item) => (item.id === nextTask.id ? nextTask : item));
    setTasks(next);
    saveTasks(next);
  }

  return (
    <RequesterShell title="任务详情">
      <div className="page grid">
        <div className="row between">
          <div>
            <span className="side-kicker">任务总览</span>
            <h1>任务详情</h1>
            <p className="muted">查看任务配置、报价、任务包、抽检验收与中止处理。</p>
          </div>
          <Link href="/requester/dashboard">
            <button>返回任务管理</button>
          </Link>
        </div>

        {task ? (
          <RequesterTaskDetail task={task} users={users} operatorId={currentUser.id} onTaskChange={persist} showCreationInfo />
        ) : loaded ? (
          <div className="empty">未找到任务，或当前身份无权查看该任务。</div>
        ) : null}
      </div>
    </RequesterShell>
  );
}
