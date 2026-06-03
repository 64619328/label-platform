"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ensureDemoData, getCurrentRole } from "@/lib/storage";

export default function ProfilePage() {
  const router = useRouter();

  useEffect(() => {
    ensureDemoData();
    router.replace(getCurrentRole() === "requester" ? "/requester/dashboard" : "/annotator/tasks");
  }, [router]);

  return (
    <main className="shell">
      <div className="page">
        <section className="panel">
          <h1>正在返回工作空间</h1>
          <p className="muted">身份可在右上角头像处切换。</p>
        </section>
      </div>
    </main>
  );
}
