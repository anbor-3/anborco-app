import React, { useState } from "react";

export default function SecurityContract() {
  const [activeTab, setActiveTab] = useState<"security" | "contract">("security");

  return (
    <div className="p-6 font-sans">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">セキュリティ・契約</h2>
      <div className="flex gap-4 mb-4">
        <button
          className={`px-4 py-2 rounded ${
            activeTab === "security" ? "bg-green-700 text-white" : "bg-gray-200 text-gray-800"
          }`}
          onClick={() => setActiveTab("security")}
        >
          セキュリティ設定
        </button>
        <button
          className={`px-4 py-2 rounded ${
            activeTab === "contract" ? "bg-green-700 text-white" : "bg-gray-200 text-gray-800"
          }`}
          onClick={() => setActiveTab("contract")}
        >
          特約管理
        </button>
      </div>

      {activeTab === "security" ? <SecurityTab /> : <ContractTab />}
    </div>
  );
}

function SecurityTab() {
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [ipRestrictions, setIpRestrictions] = useState([""]);
  const logs = [
    { time: "2025-07-10 09:12", ip: "192.168.0.2", action: "ログイン成功" },
    { time: "2025-07-10 12:33", ip: "192.168.0.3", action: "パスワード変更" },
  ];

  return (
    <div className="space-y-6">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={is2FAEnabled}
          onChange={(e) => setIs2FAEnabled(e.target.checked)}
        />
        <span>2段階認証を有効にする</span>
      </label>

      <div>
        <h3 className="text-lg font-semibold mb-2">アクセスログ</h3>
        <table className="table-auto border border-gray-300 w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-1">日時</th>
              <th className="border px-2 py-1">IPアドレス</th>
              <th className="border px-2 py-1">操作</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, idx) => (
              <tr key={idx}>
                <td className="border px-2 py-1">{log.time}</td>
                <td className="border px-2 py-1">{log.ip}</td>
                <td className="border px-2 py-1">{log.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">許可IPアドレス</h3>
        {ipRestrictions.map((ip, index) => (
          <input
            key={index}
            value={ip}
            onChange={(e) => {
              const newIPs = [...ipRestrictions];
              newIPs[index] = e.target.value;
              setIpRestrictions(newIPs);
            }}
            placeholder="例: 192.168.1.1"
            className="border px-2 py-1 mb-1 w-full"
          />
        ))}
        <button
          className="mt-1 text-blue-600 text-sm"
          onClick={() => setIpRestrictions([...ipRestrictions, ""])}
        >
          + IPを追加
        </button>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">パスワードポリシー</h3>
        <ul className="list-disc ml-6 text-sm text-gray-700">
          <li>8文字以上</li>
          <li>英大文字を含む</li>
          <li>記号を含む</li>
        </ul>
      </div>
    </div>
  );
}

function ContractTab() {
  const STORAGE_KEY = "securityContracts";

  const [agreements, setAgreements] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved
      ? JSON.parse(saved)
      : [
          {
            name: "基本契約書",
            partner: "A社",
            date: "2025-04-01",
            file: "",
            fileName: "",
            editing: false,
          },
          {
            name: "委託契約書",
            partner: "B社",
            date: "2025-06-15",
            file: "",
            fileName: "",
            editing: false,
          },
        ];
  });

  const [ndaChecked, setNdaChecked] = useState(false);
  const [slaChecked, setSlaChecked] = useState(false);

  // 保存関数
  const saveToStorage = (data: typeof agreements) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  };

  const handleUpdate = (i: number, field: string, value: string | boolean) => {
    const newList = [...agreements];
    (newList[i] as any)[field] = value;
    setAgreements(newList);
    saveToStorage(newList);
  };

  const handleDelete = (i: number) => {
    if (!window.confirm("本当に削除してよろしいですか？")) return;
    const newList = [...agreements];
    newList.splice(i, 1);
    setAgreements(newList);
    saveToStorage(newList);
  };

  const handleFileChange = (i: number, file: File) => {
    const url = URL.createObjectURL(file);
    const newList = [...agreements];
    newList[i].file = url;
    newList[i].fileName = file.name;
    setAgreements(newList);
    saveToStorage(newList);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">契約一覧</h3>
      <table className="table-auto border border-gray-300 w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-2 py-1">契約名</th>
            <th className="border px-2 py-1">契約先</th>
            <th className="border px-2 py-1">契約日</th>
            <th className="border px-2 py-1">添付</th>
            <th className="border px-2 py-1">操作</th>
          </tr>
        </thead>
        <tbody>
          {agreements.map((a, i) => (
            <tr key={i}>
              <td className="border px-2 py-1">
                {a.editing ? (
                  <input
                    value={a.name}
                    onChange={(e) => handleUpdate(i, "name", e.target.value)}
                    className="border w-full px-1"
                  />
                ) : (
                  a.name
                )}
              </td>
              <td className="border px-2 py-1">
                {a.editing ? (
                  <input
                    value={a.partner}
                    onChange={(e) => handleUpdate(i, "partner", e.target.value)}
                    className="border w-full px-1"
                  />
                ) : (
                  a.partner
                )}
              </td>
              <td className="border px-2 py-1">
                {a.editing ? (
                  <input
                    type="date"
                    value={a.date}
                    onChange={(e) => handleUpdate(i, "date", e.target.value)}
                    className="border px-1"
                  />
                ) : (
                  a.date
                )}
              </td>
              <td className="border px-2 py-1">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileChange(i, file);
                  }}
                />
                {a.file && (
                  <div className="mt-1 flex gap-2 items-center">
                    <a
                      href={a.file}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      {a.fileName || "添付を表示"}
                    </a>
                    <button
                      onClick={() => handleUpdate(i, "file", "")}
                      className="text-xs text-red-500 hover:underline"
                    >
                      削除
                    </button>
                  </div>
                )}
              </td>
              <td className="border px-2 py-1">
                {a.editing ? (
                  <button
                    className="text-green-600 text-sm mr-2"
                    onClick={() => handleUpdate(i, "editing", false)}
                  >
                    保存
                  </button>
                ) : (
                  <button
                    className="text-blue-600 text-sm mr-2"
                    onClick={() => handleUpdate(i, "editing", true)}
                  >
                    編集
                  </button>
                )}
                <button
                  className="text-red-600 text-sm"
                  onClick={() => handleDelete(i)}
                >
                  削除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={ndaChecked}
            onChange={(e) => setNdaChecked(e.target.checked)}
          />
          NDA提出済み
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={slaChecked}
            onChange={(e) => setSlaChecked(e.target.checked)}
          />
          SLA提出済み
        </label>
      </div>
    </div>
  );
}
