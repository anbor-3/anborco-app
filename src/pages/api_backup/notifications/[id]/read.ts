import type { NextApiRequest, NextApiResponse } from "next";
import type { Notification } from "../index";

const g = globalThis as any;
if (!g.__mem_notifs) g.__mem_notifs = { items: [] as Notification[] };
const mem: { items: Notification[] } = g.__mem_notifs;

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const { id } = req.query as { id: string };
  const idx = mem.items.findIndex((n) => n.id === id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  mem.items[idx].read = true;
  return res.status(200).json({ ok: true });
}
