import React, { useEffect, useState } from 'react';
import { db } from '@/firebaseClient'; // adjust import path
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import DriverPSCard from '@/components/DriverPSCard';
import { useAuth } from '@/hooks/useAuth'; // adjust

interface PsDoc {
  id: string;
  pdfUrl: string;
  driverConfirmed: boolean;
}

export default function PaymentPage() {
  const { user } = useAuth();
  const [list, setList] = useState<PsDoc[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'payment_statements'),
      where('driverId', '==', user.uid)
    );
    return onSnapshot(q, (snap) =>
      setList(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as PsDoc))
      )
    );
  }, [user]);

  return (
    <div className="p-4 space-y-4">
      {list.map((ps) => (
        <DriverPSCard key={ps.id} ps={ps} />
      ))}
    </div>
  );
}
