export async function createCustomerWithAuth(company: string, contactPerson: string): Promise<{ email: string, password: string }> {
  // 自動でメール風IDを生成
  const timestamp = Date.now();
  const email = `${company.replace(/\s/g, '').toLowerCase()}_${timestamp}@anborco.jp`;

  // ランダムなパスワード生成（英数字8文字）
  const password = Math.random().toString(36).slice(-8);

  // 本来は Firebase Auth にユーザー登録する処理が入る（今は仮）
  console.log("✅ Firebase Auth にユーザー登録（仮）:", { email, password });

  return { email, password };
}