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
  { label: "任务大厅", href: "/annotator/tasks", icon: "▦" },
  { label: "试标任务", href: "/annotator/tasks/trial", icon: "◉" },
  { label: "正式任务", href: "/annotator/tasks/my", icon: "◆" }
];

export function AnnotatorShell({ title, children }: Props) {
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
    if (href === "/annotator/tasks/trial") return pathname === href || pathname.endsWith("/trial");
    if (href === "/annotator/tasks/my") return pathname === href || pathname.endsWith("/workspace");
    return pathname === href;
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
        <Link className="requester-brand" href="/annotator/tasks">
          <span className="requester-brand-mark">◆</span>
          <span>
            <strong>图标台</strong>
            <small>Annota Ops</small>
          </span>
        </Link>
        <nav className="requester-nav" aria-label="标注方导航">
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
            <h1>{title}</h1>
          </div>
          <div className="requester-toolbar">
            <span className="search-box requester-search">
              <span>⌕</span>
              <input placeholder="搜索任务" />
            </span>
            <button>重置</button>
          </div>
        </header>
        <div className="requester-content">{children}</div>
      </section>
    </main>
  );
}
