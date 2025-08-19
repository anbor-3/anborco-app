// server.mjs (ESM) — dev-only API for Vite
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// In-memory notifications (replace with DB in real app)
let items = [
  {
    id: "1",
    type: "report",
    category: "日報",
    message: "山田太郎さんの日報未提出",
    target: null,
    createdAt: new Date().toISOString(),
    read: false,
  },
];

// GET /api/notifications
app.get("/api/notifications", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(items);
});

// POST /api/notifications/:id/read
app.post("/api/notifications/:id/read", (req, res) => {
  const i = items.findIndex((n) => n.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: "Not found" });
  items[i].read = true;
  res.json({ ok: true });
});

// DELETE /api/notifications/:id
app.delete("/api/notifications/:id", (req, res) => {
  const before = items.length;
  items = items.filter((n) => n.id !== req.params.id);
  if (items.length === before) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
