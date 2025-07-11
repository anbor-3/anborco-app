import React from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  fileName: string;
  pdfBlob: Blob;
  to: { uid: string; name: string };
  onSent: () => void;
};

export default function ConfirmSendModal({
  open,
  onClose,
  fileName,
  pdfBlob,
  to,
  onSent,
}: Props) {
  if (!open) return null;

  const handleSend = () => {
    // 📦 ここに Firebase 連携などを今後追加する予定
    console.log(`送信先: ${to.name} に ${fileName} を送信（仮動作）`);
    onSent();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow w-96">
        <h2 className="text-lg font-bold mb-4">📤 確認</h2>
        <p className="mb-4">
          <strong>{to.name}</strong> さんに<br />
          <strong>{fileName}</strong> を送信しますか？
        </p>
        <div className="text-right space-x-4">
          <button onClick={onClose} className="px-4 py-1 text-gray-600">キャンセル</button>
          <button onClick={handleSend} className="bg-blue-600 text-white px-4 py-1 rounded">送信</button>
        </div>
      </div>
    </div>
  );
}
