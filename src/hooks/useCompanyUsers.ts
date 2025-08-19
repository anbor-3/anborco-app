// hooks/useCompanyUsers.ts
import { useEffect, useState } from "react";

type User = {
  uid: string;
  name: string;
  role: "admin" | "driver";
  company: string;
};

export default function useCompanyUsers(company: string) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!company) return;

    const fetchUsers = async () => {
      try {
        const res = await fetch(`/api/users?company=${company}`);
        if (!res.ok) throw new Error("Failed to fetch users");
        const data = await res.json();
        setUsers(data);
      } catch (error) {
        console.error("❌ ユーザー取得エラー:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [company]);

  return { users, loading };
}
