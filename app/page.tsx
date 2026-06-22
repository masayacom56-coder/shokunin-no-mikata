import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-dvh bg-paper px-4 py-8 text-[20px]">
      <section className="mx-auto w-full max-w-[480px]">
        <header className="text-center">
          <p className="text-[26px] font-bold text-[#2f6b57]">職人の味方</p>
          <h1 className="mt-3 text-[36px] font-black leading-tight text-sumi">現場で見積</h1>
        </header>

        <div className="mt-10 grid gap-6">
          <Link
            href="/estimates/new"
            className="flex h-20 w-full items-center justify-center rounded-2xl bg-[#2f6b57] px-5 text-center text-2xl font-bold text-white no-underline shadow-soft"
          >
            すぐ見積を作る
          </Link>

          <Link
            href="/customers"
            className="flex h-20 w-full items-center justify-center rounded-2xl border-2 border-slate-300 bg-white px-5 text-center text-2xl font-bold text-sumi no-underline shadow-sm"
          >
            顧客管理
          </Link>

          <Link
            href="/dashboard"
            className="flex h-20 w-full items-center justify-center rounded-2xl border-2 border-slate-300 bg-white px-5 text-center text-2xl font-bold text-sumi no-underline shadow-sm"
          >
            管理画面を見る
          </Link>
        </div>
      </section>
    </main>
  );
}
