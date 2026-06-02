"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ensureDemoData,
  getCurrentUserId,
  getUsers,
  isIdentityConfirmed,
  setCurrentRole,
  setCurrentUserId,
  setIdentityConfirmed
} from "@/lib/storage";
import type { DemoUser, UserRole } from "@/lib/types";

export function AppHeader() {
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [userId, setUserId] = useState("");
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    ensureDemoData();
    setUsers(getUsers());
    setUserId(getCurrentUserId());
    setShowIdentityModal(!isIdentityConfirmed());
  }, []);

  const current = users.find((user) => user.id === userId);
  const isRequester = current?.role === "requester";
  const roleTitle = isRequester ? "需求方工作台" : "标注方工作台";

  function switchUser(nextId: string) {
    const next = users.find((user) => user.id === nextId);
    if (!next) return;
    setCurrentUserId(next.id);
    setCurrentRole(next.role);
    setIdentityConfirmed(true);
    setUserId(next.id);
    setShowIdentityModal(false);
    setShowUserMenu(false);
  }

  function roleHref(role: UserRole) {
    return role === "requester" ? "/requester/dashboard" : "/annotator/tasks";
  }

  const navItems = current?.role === "requester"
    ? [
        { href: "/requester/dashboard", label: "任务管理", icon: "▦" },
        { href: "/profile", label: "个人中心", icon: "◉" }
      ]
    : [
        { href: "/annotator/tasks", label: "任务大厅", icon: "▤" },
        { href: "/profile", label: "个人中心", icon: "◉" }
      ];

  return (
    <>
      <header className="topbar">
        <Link className="brand" href="/">
          <strong>AnnotatePro</strong>
          <span>{roleTitle} · {current?.name ?? "未选择用户"}</span>
        </Link>
        <div className="top-actions">
          <span className="search-box">
            <span>⌕</span>
            <input placeholder="Search across all task instances..." />
          </span>
          <nav className="top-nav">
            {navItems.map((item) => (
              <Link key={item.href} className={pathname === item.href ? "top-link active" : "top-link"} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          <button className="icon-button" title="通知">●</button>
          <div className="user-menu-wrap">
            <button className="user-trigger" onClick={() => setShowUserMenu(!showUserMenu)}>
              <span className="avatar">{current?.name.slice(-1) ?? "?"}</span>
              <span>{current?.name ?? "未选择用户"}</span>
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

      {showIdentityModal ? (
        <div className="identity-backdrop">
          <div className="identity-dialog">
            <span className="side-kicker">Choose Workspace</span>
            <h2>选择你的平台身份</h2>
            <p className="muted">进入后左侧目录只展示当前身份可操作的内容。后续可在个人中心切换身份。</p>
            <div className="grid two">
              {users.map((user) => (
                <button key={user.id} className="identity-option" onClick={() => switchUser(user.id)}>
                  <strong>{user.name}</strong>
                  <span>{user.role === "requester" ? "发布任务、报价选择、抽检验收" : "试标报价、正式标注、申诉处理"}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
