import { NextRequest } from "next/server";
import { getAuth } from "firebase-admin/auth";
import "@/lib/firebaseAdmin"; // 初期化用の副作用読み込み

export async function requireUser(req: NextRequest) {
  const authz = req.headers.get("authorization") || "";
  const m = authz.match(/^Bearer\s+(.+)$/i);
  if (!m) throw new Error("Missing Bearer token");
  const idToken = m[1];
  const decoded = await getAuth().verifyIdToken(idToken);
  return decoded; // { uid, email, ... }
}
