import { NextRequest, NextResponse } from "next/server";
// import { verifyIdTokenAndGetUser } from "@/lib/auth"; // 自前の認証検証

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  // const user = await verifyIdTokenAndGetUser(auth); // ← 必要に応じて実装
  const { searchParams } = new URL(req.url);
  const company = searchParams.get("company") || "";

  // TODO: DBから company スコープで位置情報を取得（最新のみ）
  const rows = [
    // ダミー
    {
      driverId: "demo",
      name: "デモドライバー",
      company,
      lat: 35.6809591,
      lng: 139.7673068,
      updatedAt: new Date().toISOString(),
    },
  ];

  return NextResponse.json(rows);
}
