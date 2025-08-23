import React, { useEffect, useMemo, useRef, useState } from "react";
import html2pdf from "html2pdf.js";
import { uploadDailyReport } from "../utils/reportUploader";

export default function DriverDashboard() {
  /* ===== ユーザー・基本 ===== */
  const currentUser = useMemo(
    () => JSON.parse(localStorage.getItem("currentUser") || "{}"),
    []
  );
  const company: string = currentUser?.company || "default";
  const driverName: string = currentUser?.name || "名無し";
  const driverId: string = currentUser?.uid || currentUser?.id || "driver001";

  /* ===== 日付・時計 ===== */
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [clock, setClock] = useState<string>("");

  /* ===== 入力（PDFに載る） ===== */
  const [tempCheck, setTempCheck] = useState<"OK" | "NG">("OK");
  const [alcoholCheck, setAlcoholCheck] = useState<"OK" | "NG">("OK");
  const [reason, setReason] = useState("");
  const [startDistance, setStartDistance] = useState<string>("");
  const [endDistance, setEndDistance] = useState<string>("");

  const [odomStartImg, setOdomStartImg] = useState<string>("");
  const [odomEndImg, setOdomEndImg] = useState<string>("");

  const [timestamps, setTimestamps] = useState<{ [k: string]: string }>({
    start: "",
    breakStart: "",
    breakEnd: "",
    end: "",
  });

  /* ===== プレビュー ===== */
  const printRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<{
    open: boolean;
    dataUrl: string;
    fileName: string;
  }>({ open: false, dataUrl: "", fileName: "" });

  /* ===== 時計描画 ===== */
  useEffect(() => {
    const t = setInterval(() => {
      setClock(
        new Date().toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo" })
      );
    }, 1000);
    return () => clearInterval(t);
  }, []);

  /* ===== 便利関数 ===== */
  function stamp(key: "start" | "breakStart" | "breakEnd" | "end") {
    setTimestamps((s) => ({
      ...s,
      [key]: new Date().toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo" }),
    }));
  }
  function cancel(key: "start" | "breakStart" | "breakEnd" | "end") {
    setTimestamps((s) => ({ ...s, [key]: "" }));
  }

  const kmStart = Number(startDistance || "");
  const kmEnd = Number(endDistance || "");
  const kmDiff =
    Number.isFinite(kmStart) && Number.isFinite(kmEnd) && kmEnd >= kmStart
      ? kmEnd - kmStart
      : null;

  const issues = useMemo(() => {
    const arr: string[] = [];
    if (tempCheck === "NG") arr.push("検温チェック：NG");
    if (alcoholCheck === "NG") arr.push("アルコールチェック：NG");
    // 必須のときに理由が未入力
    if ((tempCheck === "NG" || alcoholCheck === "NG") && !reason.trim()) {
      arr.push("NG理由の未入力");
    }
    return arr;
  }, [tempCheck, alcoholCheck, reason]);

  const allClear = issues.length === 0;

  /* ===== ファイル → dataURL ===== */
  function fileToDataUrl(file: File, setter: (v: string) => void) {
    const r = new FileReader();
    r.onload = () => setter(String(r.result || ""));
    r.readAsDataURL(file);
  }

  /* ===== PDF生成→プレビュー ===== */
  async function handlePreview() {
    const jp = new Date(selectedDate).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const fileName = `${jp}_${driverName}_日報.pdf`;
    if (!printRef.current) return;

    const opt = {
      margin: 0.35,
      filename: fileName,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
    } as any;

    const blob: Blob = await (html2pdf() as any)
      .set(opt)
      .from(printRef.current)
      .outputPdf("blob");

    const dataUrl = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.readAsDataURL(blob);
    });
    setPreview({ open: true, dataUrl, fileName });
  }

  /* ===== 送信 ===== */
  async function handleSend() {
    try {
      await uploadDailyReport({
        company,
        driverId,
        driverName,
        date: selectedDate,
        dataUrl: preview.dataUrl,
      });
      setPreview({ open: false, dataUrl: "", fileName: "" });
      alert("✅ 日報を送信しました（ファイル管理に反映）");
    } catch (e) {
      console.error(e);
      alert("送信に失敗しました。通信状況/権限をご確認ください。");
    }
  }

  /* ===== 最近7日 ===== */
  const recent7 = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });

  /* ===== PDF化される領域 ===== */
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">
        🚚 日報提出 <span className="text-sm text-gray-500">- Driver Dashboard -</span>
      </h1>

      {/* ===================== PDF本体（printRef） ===================== */}
      <div ref={printRef} className="bg-white rounded-xl shadow p-6 print:p-6">
        {/* ヘッダー */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xl font-extrabold tracking-wide">
              {company}
            </div>
            <div className="text-sm text-gray-500">ドライバー日報（A4）</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">
              日本時間：<span className="font-mono">{clock}</span>
            </div>
            <div className="mt-1">
              <label className="text-sm text-gray-600 mr-2">日付：</label>
              <span className="px-2 py-1 rounded border font-medium">
                {new Date(selectedDate).toLocaleDateString("ja-JP")}
              </span>
            </div>
          </div>
        </div>

        {/* ステータスバナー */}
        <div
          className={`rounded-lg px-4 py-3 mb-4 border ${
            allClear
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="font-semibold">
              {allClear ? "✅ 問題なし（ALL CLEAR）" : "⚠️ 要対応（ISSUES FOUND）"}
            </div>
            <div className="text-xs opacity-80">
              ドライバー：{driverName}
            </div>
          </div>
          {!allClear && (
            <ul className="list-disc pl-5 text-sm mt-1">
              {issues.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
          )}
        </div>

        {/* 情報ブロック */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {/* 体調・点呼 */}
          <section className="rounded-lg border p-3">
            <h3 className="font-semibold mb-2">体調・点呼</h3>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span>検温</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold ${
                    tempCheck === "OK" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {tempCheck}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>アルコール</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold ${
                    alcoholCheck === "OK" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {alcoholCheck}
                </span>
              </div>
              {(tempCheck === "NG" || alcoholCheck === "NG") && (
                <div className="mt-2">
                  <div className="text-xs text-gray-500 mb-1">NG理由</div>
                  <div className="border rounded p-2 min-h-[40px]">
                    {reason || <span className="text-gray-400">（未入力）</span>}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 走行距離 */}
          <section className="rounded-lg border p-3">
            <h3 className="font-semibold mb-2">走行距離</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="border rounded p-2">
                <div className="text-xs text-gray-500">開始距離</div>
                <div className="text-lg font-semibold">
                  {startDistance ? `${startDistance} km` : "-"}
                </div>
              </div>
              <div className="border rounded p-2">
                <div className="text-xs text-gray-500">終了距離</div>
                <div className="text-lg font-semibold">
                  {endDistance ? `${endDistance} km` : "-"}
                </div>
              </div>
              <div className="col-span-2 border rounded p-2">
                <div className="text-xs text-gray-500">走行距離（自動計算）</div>
                <div
                  className={`text-2xl font-extrabold ${
                    kmDiff === null ? "text-gray-400" : "text-blue-700"
                  }`}
                >
                  {kmDiff === null ? "-" : `${kmDiff} km`}
                </div>
              </div>
            </div>

            {(odomStartImg || odomEndImg) && (
              <div className="mt-3">
                <div className="text-xs text-gray-500 mb-1">メーター写真</div>
                <div className="flex gap-3">
                  {odomStartImg && (
                    <div className="w-32 h-20 border rounded overflow-hidden">
                      <img src={odomStartImg} alt="開始メーター" className="w-full h-full object-cover" />
                    </div>
                  )}
                  {odomEndImg && (
                    <div className="w-32 h-20 border rounded overflow-hidden">
                      <img src={odomEndImg} alt="終了メーター" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* タイムライン */}
        <section className="rounded-lg border p-3 mt-4">
          <h3 className="font-semibold mb-2">勤務タイムライン</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div className="border rounded p-2">
              <div className="text-xs text-gray-500">稼働開始</div>
              <div className="font-mono">{timestamps.start || "-"}</div>
            </div>
            <div className="border rounded p-2">
              <div className="text-xs text-gray-500">休憩開始</div>
              <div className="font-mono">{timestamps.breakStart || "-"}</div>
            </div>
            <div className="border rounded p-2">
              <div className="text-xs text-gray-500">休憩終了</div>
              <div className="font-mono">{timestamps.breakEnd || "-"}</div>
            </div>
            <div className="border rounded p-2">
              <div className="text-xs text-gray-500">稼働終了</div>
              <div className="font-mono">{timestamps.end || "-"}</div>
            </div>
          </div>
        </section>
      </div>

      {/* ===================== 入力UI（PDF外） ===================== */}
      <section className="bg-white rounded-xl shadow p-5">
        <h2 className="font-semibold mb-3">入力</h2>

        {/* 日付 */}
        <div className="mb-3">
          <label className="text-sm text-gray-600 mr-2">日付選択：</label>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border rounded px-2 py-1"
          >
            {recent7.map((d) => (
              <option key={d} value={d}>
                {new Date(d).toLocaleDateString("ja-JP")}
              </option>
            ))}
          </select>
        </div>

        {/* 健康・点呼 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <label className="flex items-center gap-2">
            検温：
            <select
              className="border rounded p-1"
              value={tempCheck}
              onChange={(e) => setTempCheck(e.target.value as "OK" | "NG")}
            >
              <option>OK</option>
              <option>NG</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            アルコール：
            <select
              className="border rounded p-1"
              value={alcoholCheck}
              onChange={(e) => setAlcoholCheck(e.target.value as "OK" | "NG")}
            >
              <option>OK</option>
              <option>NG</option>
            </select>
          </label>
        </div>
        {(tempCheck === "NG" || alcoholCheck === "NG") && (
          <input
            className="border rounded p-2 w-full mt-2 text-sm"
            placeholder="NG理由を入力"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        )}

        {/* 走行距離 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mt-3">
          <input
            className="border rounded p-2"
            type="number"
            placeholder="開始距離 (km)"
            value={startDistance}
            onChange={(e) => setStartDistance(e.target.value)}
          />
          <input
            className="border rounded p-2"
            type="number"
            placeholder="終了距離 (km)"
            value={endDistance}
            onChange={(e) => setEndDistance(e.target.value)}
          />
        </div>

        {/* メーター写真（任意） */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mt-3">
          <div>
            <div className="text-xs text-gray-600 mb-1">開始メーター写真（任意）</div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) fileToDataUrl(f, setOdomStartImg);
              }}
              className="block w-full text-sm"
            />
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">終了メーター写真（任意）</div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) fileToDataUrl(f, setOdomEndImg);
              }}
              className="block w-full text-sm"
            />
          </div>
        </div>

        {/* タイムスタンプ */}
        <div className="mt-4 space-x-2">
          <button
            className="px-3 py-1.5 bg-orange-600 text-white rounded"
            onClick={() => stamp("start")}
          >
            稼働開始
          </button>
          <button
            className="px-3 py-1.5 bg-orange-600 text-white rounded"
            onClick={() => stamp("breakStart")}
          >
            休憩開始
          </button>
          <button
            className="px-3 py-1.5 bg-orange-600 text-white rounded"
            onClick={() => stamp("breakEnd")}
          >
            休憩終了
          </button>
          <button
            className="px-3 py-1.5 bg-orange-600 text-white rounded"
            onClick={() => stamp("end")}
          >
            稼働終了
          </button>

          <button className="px-2 py-1 border rounded ml-3" onClick={() => cancel("start")}>
            開始取消
          </button>
          <button className="px-2 py-1 border rounded" onClick={() => cancel("breakStart")}>
            休憩開始取消
          </button>
          <button className="px-2 py-1 border rounded" onClick={() => cancel("breakEnd")}>
            休憩終了取消
          </button>
          <button className="px-2 py-1 border rounded" onClick={() => cancel("end")}>
            終了取消
          </button>
        </div>

        {/* プレビュー */}
        <div className="mt-5">
          <button
            onClick={handlePreview}
            className="px-4 py-2 bg-blue-700 text-white rounded shadow"
          >
            PDFを作ってプレビュー
          </button>
        </div>
      </section>

      {/* ===================== プレビューモーダル ===================== */}
      {preview.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-4xl h-[80vh] rounded shadow flex flex-col">
            <div className="p-3 border-b flex items-center justify-between">
              <h3 className="font-semibold">📄 プレビュー：{preview.fileName}</h3>
              <button
                className="text-red-600"
                onClick={() => setPreview({ open: false, dataUrl: "", fileName: "" })}
              >
                閉じる
              </button>
            </div>
            <iframe src={preview.dataUrl} className="flex-1 w-full" title="日報プレビュー" />
            <div className="p-3 border-t flex justify-end gap-2">
              <button
                className="px-4 py-2 border rounded"
                onClick={() => setPreview({ open: false, dataUrl: "", fileName: "" })}
              >
                やり直す
              </button>
              <button className="px-4 py-2 bg-green-600 text-white rounded" onClick={handleSend}>
                この内容で送信
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
