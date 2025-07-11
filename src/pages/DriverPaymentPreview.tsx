
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

type PsMeta = {
  driverName: string;
  driverId:   string;
  year:       number;
  month:      number;
  confirmed:  boolean;
  dataUrl:    string;
  fileName:   string;
};

export default function DriverPaymentPreview() {
  const { year, month } = useParams();        // /payment/2025/06 というルートを想定
  const navigate        = useNavigate();
  const driverId        = localStorage.getItem('driverLoginId'); // ログイン時に保存している前提
  const [meta, setMeta] = useState<PsMeta | null>(null);

  useEffect(() => {
    if (!driverId) return;
    const key = `ps_${year}_${month}_${driverId}`;
    const raw = localStorage.getItem(key);
    if (raw) setMeta(JSON.parse(raw));
  }, [year, month, driverId]);

  if (!meta) return <div className="p-4">明細書が見つかりません。</div>;

  return (
    <div className="p-4 flex flex-col items-center">
      <h1 className="text-xl font-bold mb-4">支払明細書確認</h1>

      <iframe
        src={meta.dataUrl}
        title="payment-preview"
        className="w-full max-w-3xl h-[80vh] border"
      />

      {!meta.confirmed ? (
        <button
          className="mt-6 px-6 py-2 bg-green-600 text-white rounded"
          onClick={() => {
            const key = `ps_${year}_${month}_${driverId}`;
            localStorage.setItem(
              key,
              JSON.stringify({ ...meta, confirmed: true }),
            );
            alert('確認を送信しました。請求書作成へ進んでください。');
            navigate('/driver/invoice'); // ← 次ステップの請求書画面へ
          }}
        >
          この内容で確認する
        </button>
      ) : (
        <p className="mt-6 text-green-700 font-semibold">
          ✅ 既に確認済みです
        </p>
      )}
    </div>
  );
}
