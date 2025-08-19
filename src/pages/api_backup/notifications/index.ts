import type { NextApiRequest, NextApiResponse } from "next";

export type Notification = {
  id: string;
  type: "warning" | "report" | "shift";
  category: string;
  message: string;
  target: string | null;
  createdAt: string; // ISO
  read: boolean;
};

const g = globalThis as any;
if (!g.__mem_notifs) {
  g.__mem_notifs = {
    items: [
      {
        id: "1",
        type: "report",
        category: "日報",
        message: "山田太郎さんの日報未提出",
        target: null,
        createdAt: new Date().toISOString(),
        read: false,
      },
      {
        id: "2",
        type: "warning",
        category: "車両",
        message: "品川300 あ 12-34 のオイル交換時期です",
        target: "品川300あ12-34",
        createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        read: false,
      },
    ] as Notification[],
  };
}
const mem: { items: Notification[] } = g.__mem_notifs;

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(mem.items);
  }
  return res.status(405).json({ error: "Method Not Allowed" });
}
