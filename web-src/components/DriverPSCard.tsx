import React from 'react';
import { functions } from '@/firebaseClient'; // adjust import path
import { httpsCallable } from 'firebase/functions';

interface PsDoc {
  id: string;
  pdfUrl: string;
  driverConfirmed: boolean;
}

export default function DriverPSCard({ ps }: { ps: PsDoc }) {
  const handleConfirm = async () => {
    if (!window.confirm('支払明細書を確認しましたか？')) return;
    await httpsCallable(functions, 'driverConfirmPS')({ psId: ps.id });
    alert('確認を送信しました');
  };

  return (
    <div className="border p-4 rounded shadow flex items-center justify-between">
      <a
        href={ps.pdfUrl}
        target="_blank"
        rel="noreferrer"
        className="text-blue-600 underline"
      >
        Payment Statement
      </a>
      {ps.driverConfirmed ? (
        <span className="text-green-600 font-semibold">Confirmed</span>
      ) : (
        <button onClick={handleConfirm} className="btn btn-primary">
          内容確認済み
        </button>
      )}
    </div>
  );
}
