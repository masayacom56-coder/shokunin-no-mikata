const requiredPackages = [
  "@supabase/auth-helpers-nextjs",
  "@supabase/supabase-js",
  "date-fns",
  "lucide-react",
  "next",
  "react",
  "react-dom",
  "stripe",
  "zod"
];

const missing = [];

for (const packageName of requiredPackages) {
  try {
    require.resolve(packageName);
  } catch {
    missing.push(packageName);
  }
}

if (missing.length > 0) {
  console.error("");
  console.error("依存関係エラー");
  console.error(`不足パッケージ: ${missing.join(", ")}`);
  console.error("npm install を実行してから再起動してください。");
  console.error("");
  process.exit(1);
}

console.log("dependency check passed");
