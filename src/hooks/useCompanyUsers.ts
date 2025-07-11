// hooks/useCompanyUsers.ts
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseClient";

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

    const q = query(collection(db, "users"), where("company", "==", company));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
      })) as User[];

      setUsers(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [company]);

  return { users, loading };
}
