import type { NextApiRequest, NextApiResponse } from "next";
import type { Notification } from "./index";

const g = globalThis as any;
if (!g.__mem_notifs) g.__mem_notifs = { items: [] as Notification[] };
const mem: { items: Notification[] } = g.__mem_notifs;

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };
  if (req.method === "DELETE") {
    const before = mem.items.length;
    mem.items = mem.items.filter((n) => n.id !== id);
    if (mem.items.length === before) {
      return res.status(404).json({ error: "Not found" });
    }
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: "Method Not Allowed" });
}
