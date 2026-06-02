"use client";

import { createDemoTasks, demoUsers } from "./demo-data";
import type { DemoUser, Task, UserRole } from "./types";

export const STORAGE_KEYS = {
  CURRENT_ROLE: "label_platform_current_role",
  CURRENT_USER_ID: "label_platform_current_user_id",
  IDENTITY_CONFIRMED: "label_platform_identity_confirmed",
  DEMO_USERS: "label_platform_demo_users",
  TASKS: "label_platform_tasks",
  CURRENT_REQUESTER_TASK_ID: "label_platform_current_requester_task_id"
} as const;

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function readText(key: string, fallback: string) {
  if (!canUseStorage()) return fallback;
  return window.localStorage.getItem(key) ?? fallback;
}

export function ensureDemoData() {
  if (!canUseStorage()) return;
  if (!window.localStorage.getItem(STORAGE_KEYS.DEMO_USERS)) {
    writeJson(STORAGE_KEYS.DEMO_USERS, demoUsers);
  }
  if (!window.localStorage.getItem(STORAGE_KEYS.TASKS)) {
    writeJson(STORAGE_KEYS.TASKS, createDemoTasks());
  }
  if (!window.localStorage.getItem(STORAGE_KEYS.CURRENT_ROLE)) {
    window.localStorage.setItem(STORAGE_KEYS.CURRENT_ROLE, "requester");
  }
  if (!window.localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID)) {
    window.localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, "requester_1");
  }
}

export function resetWithDemoData() {
  writeJson(STORAGE_KEYS.DEMO_USERS, demoUsers);
  writeJson(STORAGE_KEYS.TASKS, createDemoTasks());
  window.localStorage.setItem(STORAGE_KEYS.CURRENT_ROLE, "requester");
  window.localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, "requester_1");
  window.localStorage.setItem(STORAGE_KEYS.IDENTITY_CONFIRMED, "false");
}

export function getUsers() {
  return readJson<DemoUser[]>(STORAGE_KEYS.DEMO_USERS, demoUsers);
}

export function getTasks() {
  return readJson<Task[]>(STORAGE_KEYS.TASKS, []);
}

export function saveTasks(tasks: Task[]) {
  writeJson(STORAGE_KEYS.TASKS, tasks);
}

export function getCurrentRole(): UserRole {
  return readText(STORAGE_KEYS.CURRENT_ROLE, "requester") as UserRole;
}

export function setCurrentRole(role: UserRole) {
  window.localStorage.setItem(STORAGE_KEYS.CURRENT_ROLE, role);
}

export function getCurrentUserId() {
  return readText(STORAGE_KEYS.CURRENT_USER_ID, "requester_1");
}

export function setCurrentUserId(id: string) {
  window.localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, id);
}

export function isIdentityConfirmed() {
  return readText(STORAGE_KEYS.IDENTITY_CONFIRMED, "false") === "true";
}

export function setIdentityConfirmed(value: boolean) {
  window.localStorage.setItem(STORAGE_KEYS.IDENTITY_CONFIRMED, value ? "true" : "false");
}

export function getCurrentUser() {
  const users = getUsers();
  return users.find((user) => user.id === getCurrentUserId()) ?? users[0];
}

export function setCurrentRequesterTaskId(id: string) {
  window.localStorage.setItem(STORAGE_KEYS.CURRENT_REQUESTER_TASK_ID, id);
}

export function getCurrentRequesterTaskId() {
  return canUseStorage() ? window.localStorage.getItem(STORAGE_KEYS.CURRENT_REQUESTER_TASK_ID) ?? undefined : undefined;
}
