"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ensureDemoData, setCurrentRole, setCurrentUserId } from "@/lib/storage";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    ensureDemoData();
    setCurrentRole("requester");
    setCurrentUserId("requester_1");
    router.replace("/requester/dashboard");
  }, [router]);

  return (
    <main className="shell">
      <div className="page">
        <section className="panel">
          <h1>正在进入需求方工作空间</h1>
          <p className="muted">身份可在右上角头像处切换。</p>
        </section>
      </div>
    </main>
  );
}
