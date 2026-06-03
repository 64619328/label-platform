"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ensureDemoData,
  getCurrentUserId,
  getUsers,
  setCurrentRole,
  setCurrentUserId
} from "@/lib/storage";
import type { DemoUser, UserRole } from "@/lib/types";

export function AppHeader() {
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [userId, setUserId] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const router = useRouter();

  useEffect(() => {
    ensureDemoData();
    setUsers(getUsers());
    setUserId(getCurrentUserId());
  }, []);

  const current = users.find((user) => user.id === userId);
  const displayName = current?.role === "requester" ? "需求方" : current?.role === "annotator" ? "标注方" : "未选择用户";

  function switchUser(nextId: string) {
    const next = users.find((user) => user.id === nextId);
    if (!next) return;
    setCurrentUserId(next.id);
    setCurrentRole(next.role);
    setUserId(next.id);
    setShowUserMenu(false);
    router.push(roleHref(next.role));
  }

  function roleHref(role: UserRole) {
    return role === "requester" ? "/requester/dashboard" : "/annotator/tasks";
  }

  return (
    <>
      <header className="topbar">
        <Link className="brand" href={current ? roleHref(current.role) : "/requester/dashboard"}>
          <strong>图标台</strong>
          <span>Annota</span>
        </Link>
        <div className="top-actions">
          <span className="search-box">
            <span>⌕</span>
            <input placeholder="Search tasks" />
          </span>
          <button className="icon-button" title="通知">●</button>
          <div className="user-menu-wrap">
            <button className="user-trigger" onClick={() => setShowUserMenu(!showUserMenu)}>
              <span className="avatar">{displayName.slice(0, 1)}</span>
              <span>{displayName}</span>
            </button>
            {showUserMenu ? (
              <div className="user-menu">
                <div className="muted">切换身份</div>
                {users.map((user) => (
                  <button key={user.id} className={user.id === userId ? "user-option active" : "user-option"} onClick={() => switchUser(user.id)}>
                    <strong>{user.name}</strong>
                    <span>{user.role === "requester" ? "需求方" : "标注方"}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </header>
    </>
  );
}
