"use client";

import { Mail, Chrome } from "lucide-react";
import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  function getSupabase() {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setMessage("Supabaseの環境変数が未設定です。");
      return null;
    }
    return createBrowserSupabase();
  }

  async function signInWithGoogle() {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` }
    });
  }

  async function signInWithEmail() {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` }
    });
    setMessage(error ? "送信できませんでした。メールアドレスを確認してください。" : "ログイン用メールを送信しました。");
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-5">
      <section className="w-full max-w-md rounded bg-white p-5 shadow-soft">
        <p className="text-sm font-bold text-moss">職人の味方</p>
        <h1 className="mt-1 text-2xl font-black">ログイン</h1>
        <div className="mt-6 space-y-3">
          <button
            className="flex h-14 w-full items-center justify-center gap-2 rounded bg-moss font-black text-white"
            onClick={signInWithGoogle}
          >
            <Chrome size={20} />
            Googleでログイン
          </button>
          <div className="rounded border border-slate-300 p-3">
            <label className="text-xs font-bold text-slate-500">メール</label>
            <div className="mt-1 flex items-center gap-2">
              <Mail size={20} className="text-slate-400" />
              <input
                className="h-11 w-full outline-none"
                inputMode="email"
                placeholder="you@example.jp"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          </div>
          <button className="h-14 w-full rounded border border-moss bg-white font-black text-moss" onClick={signInWithEmail}>
            メールリンクを送る
          </button>
          {message ? <p className="text-sm font-bold text-moss">{message}</p> : null}
        </div>
      </section>
    </main>
  );
}
