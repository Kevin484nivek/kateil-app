"use client";

import { useEffect, useState } from "react";

type FloatingNotice = {
  id: number;
  message: string;
  status: "error" | "success";
};

export function FloatingNoticeHost() {
  const [notices, setNotices] = useState<FloatingNotice[]>([]);

  useEffect(() => {
    function handleNotice(event: Event) {
      const customEvent = event as CustomEvent<{ message: string; status: "error" | "success" }>;
      const detail = customEvent.detail;

      if (!detail?.message) {
        return;
      }

      const id = Date.now() + Math.floor(Math.random() * 1000);
      setNotices((current) => [...current, { id, ...detail }]);

      window.setTimeout(() => {
        setNotices((current) => current.filter((notice) => notice.id !== id));
      }, 2800);
    }

    window.addEventListener("app-floating-notice", handleNotice as EventListener);

    return () => {
      window.removeEventListener("app-floating-notice", handleNotice as EventListener);
    };
  }, []);

  if (notices.length === 0) {
    return null;
  }

  return (
    <div className="floating-notice-stack" aria-live="polite">
      {notices.map((notice) => (
        <div
          key={notice.id}
          className={`floating-notice ${
            notice.status === "success" ? "floating-notice-success" : "floating-notice-error"
          }`}
          role="status"
        >
          {notice.message}
        </div>
      ))}
    </div>
  );
}
