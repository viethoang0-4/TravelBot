"use client";

import { signIn } from "next-auth/react";
import { Compass } from "lucide-react";
import { useState } from "react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    await signIn("google", { callbackUrl: "/chat" });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 rounded-xl bg-[#146ef5] flex items-center justify-center shadow-lg mb-4">
            <Compass className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Compa<span className="text-[#146ef5]">sso</span>
          </h1>
          <p className="text-sm text-foreground/60 mt-1.5">Trợ lý du lịch AI cá nhân của bạn</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-lg p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-1">Đăng nhập</h2>
          <p className="text-sm text-foreground/60 mb-6">
            Đăng nhập để lưu lịch trình và nhận cảnh báo thời tiết.
          </p>

          <button
            onClick={handleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-md border border-border bg-background text-foreground font-medium text-sm transition-all hover:bg-muted hover:shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {/* Google logo SVG */}
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.909-2.258c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
            </svg>
            {loading ? "Đang chuyển hướng..." : "Tiếp tục với Google"}
          </button>
        </div>

        <p className="text-center text-xs text-foreground/40 mt-6">
          Bằng cách đăng nhập, bạn đồng ý với Điều khoản dịch vụ của Compasso.
        </p>
      </div>
    </div>
  );
}
