"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  const pathname = usePathname();

  useEffect(() => {
    ensureDemoData();
    setUsers(getUsers());
    setUserId(getCurrentUserId());
  }, []);

  const current = users.find((user) => user.id === userId);
  const displayName = current?.role === "requester" ? "需求方" : current?.role === "annotator" ? "标注方" : "未选择用户";
  const currentRole = current?.role ?? "requester";
  const productTabs =
    currentRole === "requester"
      ? [
          { label: "发布", href: "/requester/tasks/new", isNew: true },
          { label: "任务", href: "/requester/dashboard", isNew: false },
          { label: "验收", href: "/requester/review", isNew: false }
        ]
      : [
          { label: "大厅", href: "/annotator/tasks", isNew: false },
          { label: "试标", href: "/annotator/tasks/trial", isNew: true },
          { label: "我的", href: "/annotator/tasks/my", isNew: false }
        ];

  function isActiveTab(href: string) {
    if (href === "/requester/tasks/new") return pathname.startsWith(href);
    return pathname === href;
  }

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
        <nav className="product-tabs" aria-label="主导航">
          {productTabs.map((tab, index) => (
            <Link key={tab.label} className={isActiveTab(tab.href) ? "product-tab active" : "product-tab"} href={tab.href}>
              <span className="product-icon" aria-hidden="true">{index === 0 ? "⌂" : index === 1 ? "◉" : "◇"}</span>
              <span>{tab.label}</span>
              {tab.isNew ? <span className="new-tag">NEW</span> : null}
            </Link>
          ))}
        </nav>
        <div className="top-actions">
          <span className="search-box">
            <span>⌕</span>
            <input placeholder="搜索任务" />
          </span>
          <button className="icon-button" title="通知">!</button>
          <div className="user-menu-wrap">
            <button className="user-trigger" onClick={() => setShowUserMenu(!showUserMenu)}>
              <span className="avatar">{displayName.slice(0, 1)}</span>
              <span className="role-name">{displayName}</span>
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
