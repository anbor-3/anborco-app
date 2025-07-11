
import React, { useState } from "react";

const DriverDocumentUpload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");

  const handleSubmit = () => {
    if (!file) {
      alert("ファイルを選択してください");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;

      const submissions = JSON.parse(localStorage.getItem("documentSubmissions") || "[]");
      submissions.push({
        id: Date.now(),
        driver: JSON.parse(localStorage.getItem("loggedInDriver") || "{}").name || "unknown",
        filename: file.name,
        data: base64,
        timestamp: new Date().toISOString(),
      });
      localStorage.setItem("documentSubmissions", JSON.stringify(submissions));

      // admin notification
      const notifications = JSON.parse(localStorage.getItem("notifications") || "[]");
      notifications.push({
        id: Date.now(),
        type: "document",
        category: "書類提出",
        message: `${file.name} が提出されました`,
        timestamp: new Date().toISOString(),
        read: false,
      });
      localStorage.setItem("notifications", JSON.stringify(notifications));

      setMessage("書類を送信しました！");
      setFile(null);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">📄 書類提出 <span className="text-sm text-gray-500">- Document Upload -</span></h1>
      <input type="file" accept="image/*,.pdf" onChange={(e)=>setFile(e.target.files?.[0]||null)} />
      <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded">送信</button>
      {message && <p className="text-green-600">{message}</p>}
    </div>
  )
};

export default DriverDocumentUpload;
