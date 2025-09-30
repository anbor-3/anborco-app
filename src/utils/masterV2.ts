import { getAuth } from "firebase/auth";

const API =
  (typeof window !== "undefined" && window.location.hostname.includes("app.anbor.co.jp"))
    ? "https://app.anbor.co.jp"
    : "http://localhost:4321";

async function authHeader() {
  const idToken = await getAuth().currentUser?.getIdToken();
  if (!idToken) throw new Error("not_authenticated");
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${idToken}`,
  };
}

export async function provisionCustomer(company: string, loginId: string): Promise<{ ok: boolean; uid: string; email: string; password: string; }> {
  const r = await fetch(`${API}/api/master/v2/customers/provision`, {
    method: "POST",
    headers: await authHeader(),
    body: JSON.stringify({ company, loginId }),
  });
  if (!r.ok) throw new Error(`provision_failed: ${r.status}`);
  return r.json();
}

export async function deleteCustomerByEmail(email: string): Promise<{ ok: boolean; uid: string; deleted: boolean; }> {
  const r = await fetch(`${API}/api/master/v2/customers/delete`, {
    method: "POST",
    headers: await authHeader(),
    body: JSON.stringify({ email }),
  });
  if (!r.ok) throw new Error(`delete_failed: ${r.status}`);
  return r.json();
}

export async function fixClaims(email: string, company: string, role = "admin"): Promise<{ ok: boolean; uid: string; email: string; claims: any; }> {
  const r = await fetch(`${API}/api/master/v2/customers/fix-claims`, {
    method: "POST",
    headers: await authHeader(),
    body: JSON.stringify({ email, company, role }),
  });
  if (!r.ok) throw new Error(`fix_claims_failed: ${r.status}`);
  return r.json();
}
