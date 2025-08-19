使い方（Vite + 開発用API）
--------------------------
1) この ZIP をプロジェクトのルート（package.json がある場所）で展開
   → server.mjs が直下に置かれます。

2) package.json の scripts を以下のように（すでに concurrently は devDeps にあります）
   {
     "scripts": {
       "api": "node server.mjs",
       "dev": "concurrently \"npm:api\" \"vite\"",
       "build": "vite build",
       "preview": "vite preview"
     }
   }

3) vite.config.ts にプロキシを追加
   server: {
     proxy: {
       "/api": { target: "http://localhost:4000", changeOrigin: true }
     }
   }

4) 起動 → npm run dev
   - http://localhost:5173/api/notifications で JSON が出ることを確認
   - その後 http://localhost:5173/admin/notifications を表示
