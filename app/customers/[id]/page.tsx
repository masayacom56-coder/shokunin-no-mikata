import Link from "next/link";

export default function CustomerDetailPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-4">
      <section className="w-full max-w-md rounded bg-white p-5 text-center shadow-sm">
        <h1 className="text-2xl font-black">顧客管理へ戻ってください</h1>
        <p className="mt-3 text-sm font-bold text-slate-600">顧客詳細は顧客管理画面内で表示します。</p>
        <Link href="/customers" className="mt-5 flex h-14 items-center justify-center rounded bg-moss font-black text-white">
          顧客管理へ戻る
        </Link>
      </section>
    </main>
  );
}
