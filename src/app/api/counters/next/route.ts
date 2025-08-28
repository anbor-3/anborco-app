// src/app/api/counters/next/route.ts
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neon";
import { verifyBearer, requireSameCompanyOrAdmin } from "@/lib/authServer";

export const runtime = "nodejs"; // Neonを使うならnode推奨

export async function GET(req: NextRequest) {
  try {
    const u = await verifyBearer(req); // Firebase IDトークン検証
    const { searchParams } = req.nextUrl; // ← ここを nextUrl に
    const company = searchParams.get("company") || "";
    const type = searchParams.get("type") || "po";
    if (!company) {
      return NextResponse.json({ error: "missing company" }, { status: 400 });
    }

    // 同一会社の admin/master だけ許可
    await requireSameCompanyOrAdmin(u, company);

    const rows = await sql<{ value: number }[]>`
      INSERT INTO counters (company, counter_type, value)
      VALUES (${company}, ${type}, 1)
      ON CONFLICT (company, counter_type)
      DO UPDATE SET value = counters.value + 1
      RETURNING value;
    `;
    return NextResponse.json({ next: rows[0].value });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "bad request" }, { status: 400 });
  }
}
