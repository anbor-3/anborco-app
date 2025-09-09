// safe-clean.mjs
// ビルド/キャッシュ/出力フォルダとOSゴミを安全に自動削除（ソースは触りません）
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DELETE_DIR_NAMES = new Set([
  "node_modules","dist","build",".next","coverage",".turbo",".cache",".vite",".parcel-cache"
]);
const DELETE_DIR_PATHS = [path.join(".vercel","output")]; // .vercel/output
const DELETE_FILE_PATTERNS = [/^\.DS_Store$/i, /^Thumbs\.db$/i, /\.swp$/i, /\.tmp$/i, /~$/];

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch {}
}

function walk(dir) {
  let out = [];
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) {
      out.push(full, ...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

(function main() {
  console.log(`🔎 scanning ${ROOT}`);
  const all = walk(ROOT);

  // 1) ディレクトリ削除
  const dirTargets = new Set();
  for (const p of all) {
    const rel = path.relative(ROOT, p);
    const parts = rel.split(path.sep);
    // 部分一致（node_modules 等）
    for (let i=0;i<parts.length;i++) {
      const seg = parts[i];
      if (DELETE_DIR_NAMES.has(seg)) {
        dirTargets.add(parts.slice(0, i + 1).join(path.sep));
      }
    }
    // .vercel/output
    const joined = parts.join("/");
    if (joined.includes(".vercel/output")) {
      const cut = joined.split(".vercel/output")[0] + ".vercel/output";
      dirTargets.add(cut.split("/").join(path.sep));
    }
  }

  // 2) ファイル削除（OS/エディタのゴミ）
  let fileDeleted = 0;
  for (const p of all) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      const base = path.basename(p);
      if (DELETE_FILE_PATTERNS.some((re) => re.test(base))) {
        try { fs.rmSync(p, { force: true }); fileDeleted++; } catch {}
      }
    }
  }

  // 実際の削除
  let dirDeleted = 0;
  for (const d of Array.from(dirTargets).sort((a,b)=>b.length-a.length)) {
    const abs = path.join(ROOT, d);
    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
      rmrf(abs);
      console.log("🗑️ dir:", d);
      dirDeleted++;
    }
  }

  console.log(`✅ done. removed dirs=\${dirDeleted}, files=\${fileDeleted}`);
})();
