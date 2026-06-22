# 職人の味方

現場で採寸後、その場で見積作成、PDF生成、顧客送付まで完結する職人向けPWAです。

## MVPで入っているもの

- Next.js App Router + TypeScript + Tailwind CSS構成
- スマホファーストの60秒見積画面
- 顧客、案件、職種、工事項目、数量入力、自動計算
- 円引き、パーセント値引き
- ブラウザ印刷による日本語PDF生成
- メール送付導線
- PWA manifest + service worker
- IndexedDBによるオフライン保存
- Supabase Authコールバック
- Supabase PostgreSQLスキーマ、RLS、初期職種
- Stripe Checkout/Webhook API骨格
- API設計、UI設計、Stripe設計ドキュメント

## セットアップ

```bash
npm install
cp .env.example .env.local
npm run dev
```

Supabase SQL Editorで`supabase/schema.sql`を実行し、Storageに以下のバケットを作成します。

- `company-logos`
- `project-photos`
- `estimate-pdfs`

## 主要ファイル

- `app/estimates/new/page.tsx`: MVPの中心となる見積作成画面
- `lib/calc.ts`: 見積計算
- `lib/pdf.ts`: PDF生成
- `lib/offline-store.ts`: オフライン保存
- `supabase/schema.sql`: DB設計とRLS
- `docs/architecture.md`: 全体設計
- `docs/api-design.md`: API設計
- `docs/stripe-billing.md`: 課金設計
- `docs/ui-flow.md`: 画面設計
