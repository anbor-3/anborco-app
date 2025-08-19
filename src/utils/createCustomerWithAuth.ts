import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { app } from "../firebaseClient"; // Firebase初期化済みのappをインポート

export async function createCustomerWithAuth(
  company: string,
  contactPerson: string
): Promise<{ email: string; password: string }> {
  // 自動でメール風IDを生成
  const timestamp = Date.now();
  const email = `${company.replace(/\s/g, "").toLowerCase()}_${timestamp}@anborco.jp`;

  // ランダムなパスワード生成（英数字8文字）
  const password = Math.random().toString(36).slice(-8);

  // Firebase Auth にユーザー登録
  const auth = getAuth(app);
  await createUserWithEmailAndPassword(auth, email, password);

  console.log("✅ Firebase Auth にユーザー登録:", { email, password });

  return { email, password };
}
