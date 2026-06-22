"use client";

import Link from "next/link";
import { Camera, FileText, Save } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { BackButton } from "@/components/back-button";
import { createProject, loadState, updateProject } from "@/lib/app-store";
import { createId, normalizeProject, safeArray } from "@/lib/safety";
import type { AppState, Project, ProjectStatus } from "@/lib/types";

const statusLabels: Record<ProjectStatus, string> = {
  estimating: "見積中",
  submitted: "提出済",
  won: "受注",
  lost: "失注"
};

export default function ProjectsPage() {
  const [state, setState] = useState<AppState | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("estimating");
  const [memo, setMemo] = useState("");

  useEffect(() => {
    const loaded = loadState();
    setState(loaded);
    setCustomerId(safeArray(loaded.customers)[0]?.id ?? "");
  }, []);

  function refresh() {
    setState(loadState());
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customerId || !title.trim()) return;
    createProject({ customerId, title: title.trim(), status, memo: memo.trim() });
    setTitle("");
    setStatus("estimating");
    setMemo("");
    refresh();
  }

  async function addPhoto(project: Project, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    let dataUrl = "";
    try {
      dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    } catch (error) {
      console.error("[Projects] photo_read_failed", error);
      return;
    }
    updateProject({
      ...project,
      photoComments: [
        {
          id: createId(),
          projectId: project.id,
          dataUrl,
          comment: "",
          createdAt: new Date().toISOString()
        },
        ...safeArray(project.photoComments)
      ]
    });
    refresh();
  }

  function updatePhotoComment(project: Project, photoId: string, comment: string) {
    const safePhotos = safeArray(project.photoComments);
    updateProject({
      ...project,
      photoComments: safePhotos.map((photo) => (photo.id === photoId ? { ...photo, comment } : photo))
    });
    refresh();
  }

  return (
    <main className="min-h-dvh bg-paper pb-8">
      <BackButton />
      <section className="mx-auto max-w-md px-4 py-5">
        <header className="flex items-center gap-3">
          <h1 className="text-2xl font-black">案件管理</h1>
        </header>

        <form className="mt-5 rounded bg-white p-4 shadow-sm" onSubmit={submit}>
          <p className="font-black">案件を追加</p>
          {state && safeArray(state.customers).length === 0 ? (
            <Link href="/customers" className="mt-3 block rounded border border-moss p-4 text-center font-bold text-moss">
              先に顧客を登録
            </Link>
          ) : (
            <div className="mt-3 space-y-3">
              <select className="h-14 w-full rounded border border-slate-300 bg-white px-3 font-bold" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                {safeArray(state?.customers).map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.companyName || customer.name}
                  </option>
                ))}
              </select>
              <input className="h-14 w-full rounded border border-slate-300 px-3" placeholder="案件名" value={title} onChange={(event) => setTitle(event.target.value)} />
              <select className="h-14 w-full rounded border border-slate-300 bg-white px-3 font-bold" value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus)}>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <textarea className="min-h-20 w-full rounded border border-slate-300 p-3" placeholder="現場メモ" value={memo} onChange={(event) => setMemo(event.target.value)} />
              <button className="flex h-14 w-full items-center justify-center gap-2 rounded bg-moss font-black text-white">
                <Save size={20} />
                保存
              </button>
            </div>
          )}
        </form>

        <div className="mt-5 space-y-3">
          {safeArray(state?.projects).length === 0 ? (
            <div className="rounded border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">
              まだ案件がありません
            </div>
          ) : (
            safeArray(state?.projects).map((project) => {
              const safeProject = normalizeProject(project);
              const customer = safeArray(state?.customers).find((item) => item.id === safeProject.customerId);
              return (
                <article key={safeProject.id} className="rounded bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{safeProject.title}</p>
                      <p className="mt-1 text-sm text-slate-500">{customer?.companyName || customer?.name}</p>
                    </div>
                    <span className="rounded bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                      {statusLabels[safeProject.status]}
                    </span>
                  </div>
                  {safeProject.memo ? <p className="mt-3 rounded bg-slate-50 p-3 text-sm text-slate-600">{safeProject.memo}</p> : null}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded border border-slate-300 font-bold">
                      <Camera size={18} />
                      写真追加
                      <input className="hidden" type="file" accept="image/*" capture="environment" onChange={(event) => addPhoto(safeProject, event)} />
                    </label>
                    <Link href="/estimates/new" className="flex h-12 items-center justify-center gap-2 rounded bg-moss font-bold text-white">
                      <FileText size={18} />
                      見積
                    </Link>
                  </div>
                  {safeArray(safeProject.photoComments).length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {safeArray(safeProject.photoComments).map((photo) => (
                        <div key={photo.id} className="rounded border border-slate-200 p-2">
                          <img src={photo.dataUrl} alt="現場写真" className="aspect-video w-full rounded object-cover" />
                          <input
                            className="mt-2 h-12 w-full rounded border border-slate-300 px-3"
                            placeholder="写真コメント"
                            value={photo.comment}
                            onChange={(event) => updatePhotoComment(safeProject, photo.id, event.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
