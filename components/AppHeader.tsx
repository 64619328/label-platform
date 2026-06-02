"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ensureDemoData, getCurrentUserId, getUsers, setCurrentRole, setCurrentUserId } from "@/lib/storage";
import type { DemoUser, UserRole } from "@/lib/types";

export function AppHeader() {
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [userId, setUserId] = useState("");

  useEffect(() => {
    ensureDemoData();
    setUsers(getUsers());
    setUserId(getCurrentUserId());
  }, []);

  const current = users.find((user) => user.id === userId);

  function switchUser(nextId: string) {
    const next = users.find((user) => user.id === nextId);
    if (!next) return;
    setCurrentUserId(next.id);
    setCurrentRole(next.role);
    setUserId(next.id);
  }

  function roleHref(role: UserRole) {
    return role === "requester" ? "/requester/dashboard" : "/annotator/tasks";
  }

  return (
    <header className="topbar">
      <Link className="brand" href="/">
        <strong>图像标注平台 MVP</strong>
        <span>localStorage Demo · {current?.name ?? "未选择用户"}</span>
      </Link>
      <nav className="nav">
        <Link href="/requester/dashboard">
          <button>需求方工作台</button>
        </Link>
        <Link href="/requester/tasks/new">
          <button>发布任务</button>
        </Link>
        <Link href="/annotator/tasks">
          <button>标注方任务</button>
        </Link>
        <select value={userId} onChange={(event) => switchUser(event.target.value)} style={{ width: 180 }}>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
        {current ? (
          <Link href={roleHref(current.role)}>
            <button className="primary">进入当前身份</button>
          </Link>
        ) : null}
      </nav>
    </header>
  );
}
