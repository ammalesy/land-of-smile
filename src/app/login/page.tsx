"use client";

import { useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "เกิดข้อผิดพลาด");
        setPassword("");
        inputRef.current?.focus();
        return;
      }

      const from = searchParams.get("from") ?? "/";
      router.replace(from);
      router.refresh();
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="password" className="sr-only">
          รหัสผ่าน
        </label>
        <input
          ref={inputRef}
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="รหัสผ่าน"
          aria-label="รหัสผ่าน"
          aria-invalid={!!error}
          aria-describedby={error ? "login-error" : undefined}
          autoComplete="current-password"
          autoFocus
          required
          className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
        />
      </div>

      {/* Error message */}
      {error && (
        <p
          id="login-error"
          role="alert"
          className="flex items-center gap-2 rounded-lg bg-red-900/30 border border-red-500/30 px-4 py-3 text-sm text-red-400"
        >
          <span aria-hidden>⚠️</span> {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !password}
        className="w-full rounded-2xl bg-indigo-600 py-4 text-base font-semibold text-white hover:bg-indigo-500 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 p-6">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">Land of Smile</h1>
          <p className="text-sm text-gray-400">กรุณาใส่รหัสผ่านเพื่อเข้าใช้งาน</p>
        </div>

        {/* Wrap with Suspense for useSearchParams */}
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
