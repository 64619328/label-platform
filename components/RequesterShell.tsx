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
import type { DemoUser } from "@/lib/types";
import type { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
};

const navItems = [
  { label: "任务管理", href: "/requester/dashboard", icon: "▦" },
  { label: "发布任务", href: "/requester/tasks/new", icon: "＋" },
  { label: "验收中心", href: "/requester/review", icon: "◈" }
];

export function RequesterShell({ title, children }: Props) {
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [userId, setUserId] = useState("");
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    ensureDemoData();
    setUsers(getUsers());
    setUserId(getCurrentUserId());
  }, []);

  const requesterUsers = users.filter((user) => user.role === "requester");
  const annotatorUsers = users.filter((user) => user.role === "annotator");

  function isActive(href: string) {
    if (href === "/requester/tasks/new") return pathname.startsWith(href);
    if (href === "/requester/dashboard") {
      return pathname === href || (pathname.startsWith("/requester/tasks/") && !pathname.startsWith("/requester/tasks/new"));
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function switchUser(nextId: string) {
    const next = users.find((user) => user.id === nextId);
    if (!next) return;
    setCurrentUserId(next.id);
    setCurrentRole(next.role);
    setUserId(next.id);
    router.push(next.role === "requester" ? "/requester/dashboard" : "/annotator/tasks");
  }

  return (
    <main className="requester-shell">
      <aside className="requester-sidebar">
        <Link className="requester-brand" href="/requester/dashboard">
          <span className="requester-brand-mark">◆</span>
          <span>
            <strong>图标台</strong>
            <small>Annota Ops</small>
          </span>
        </Link>
        <nav className="requester-nav" aria-label="需求方导航">
          {navItems.map((item) => (
            <Link key={item.href} className={isActive(item.href) ? "requester-nav-item active" : "requester-nav-item"} href={item.href}>
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="requester-sidebar-footer">
          <div className="field">
            <label>切换身份</label>
            <select value={userId} onChange={(event) => switchUser(event.target.value)}>
              {requesterUsers.length ? <optgroup label="需求方">
                {requesterUsers.map((user) => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </optgroup> : null}
              {annotatorUsers.length ? <optgroup label="标注方">
                {annotatorUsers.map((user) => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </optgroup> : null}
            </select>
          </div>
        </div>
      </aside>

      <section className="requester-main">
        <header className="requester-topbar">
          <div>
            <span className="side-kicker">Requester Workspace</span>
            <h1>{title}</h1>
          </div>
          <div className="requester-toolbar">
            <span className="search-box requester-search">
              <span>⌕</span>
              <input placeholder="搜索任务" />
            </span>
            <div className="date-range-control">
              <span>年 / 月 / 日</span>
              <span>至</span>
              <span>年 / 月 / 日</span>
              <button className="primary">确定</button>
            </div>
            <button>重置</button>
          </div>
        </header>
        <div className="requester-content">{children}</div>
      </section>
    </main>
  );
}
