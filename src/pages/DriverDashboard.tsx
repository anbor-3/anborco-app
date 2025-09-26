import React, { useEffect, useMemo, useRef, useState } from "react";
import html2pdf from "html2pdf.js";
import { uploadDailyReport } from "../utils/reportUploader";

export default function DriverDashboard() {
  // ===== ユーザー・基本 =====
  const currentUser = useMemo(
    () => JSON.parse(localStorage.getItem("currentUser") || "{}"),
    []
  );
  const company: string = currentUser?.company || "default";
  const driverName: string = currentUser?.name || "名無し";
  const driverId: string = currentUser?.uid || currentUser?.id || "driver001";

  // ===== 日付・時計 =====
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [clock, setClock] = useState<string>("");

  // ===== 入力（PDFに載る） =====
  const [tempCheck, setTempCheck] = useState<"OK" | "NG">("OK");
  const [alcoholCheck, setAlcoholCheck] = useState<"OK" | "NG">("OK");
  const [reason, setReason] = useState("");
  const [startDistance, setStartDistance] = useState<string>("");
  const [endDistance, setEndDistance] = useState<string>("");

  const [tempImg, setTempImg] = useState<string>("");         // 追加：検温写真
  const [alcoholImg, setAlcoholImg] = useState<string>("");   // 追加：アルコール写真
  const [odomStartImg, setOdomStartImg] = useState<string>("");
  const [odomEndImg, setOdomEndImg] = useState<string>("");

  const [timestamps, setTimestamps] = useState<{ [k: string]: string }>({
    start: "",
    breakStart: "",
    breakEnd: "",
    end: "",
  });

  // ===== プレビュー =====
  const printRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<{
    open: boolean;
    dataUrl: string;
    fileName: string;
  }>({ open: false, dataUrl: "", fileName: "" });

  // ===== 時計描画 =====
  useEffect(() => {
    const t = setInterval(() => {
      setClock(
        new Date().toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo" })
      );
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // ===== 便利関数 =====
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

  // すべての入力が完了しているかの判定（OK/OK かつ主要必須項目が入力済み）
  const isComplete =
    tempCheck === "OK" &&
    alcoholCheck === "OK" &&
    !!startDistance &&
    !!endDistance &&
    kmDiff !== null &&
    !!timestamps.start &&
    !!timestamps.end;

  // ===== ファイル → dataURL =====
  function fileToDataUrl(file: File, setter: (v: string) => void) {
    const r = new FileReader();
    r.onload = () => setter(String(r.result || ""));
    r.readAsDataURL(file);
  }

  // ===== PDF生成→プレビュー =====
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

  // ===== 送信 =====
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

  // ===== 最近7日 =====
  const recent7 = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });

  // ===== レイアウト：入力を上、反映(プレビュー対象)を下 =====
  return (
    <div className="space-y-8 text-gray-900">
      {/* ヘッダー */}
      <header className="flex items-end justify-between">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
          🚚 日報提出
          <span className="ml-2 text-base md:text-lg font-medium text-white">
            — Driver Dashboard —
          </span>
        </h1>
        <div className="text-right text-sm md:text-base text-gray-800">
          日本時間：<span className="font-mono font-semibold">{clock}</span>
        </div>
      </header>

      {/* ===== 入力UI（上） ===== */}
      <section className="bg-white rounded-2xl shadow-lg p-6 md:p-7">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-1.5 h-6 bg-gray-900 rounded" />
          <h2 className="text-xl md:text-2xl font-extrabold text-gray-900">入力</h2>
        </div>

        {/* 日付 */}
        <div className="mb-5">
          <label className="block text-sm md:text-base text-gray-900 mb-2">日付選択</label>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full md:w-80 border-2 rounded-xl px-3 py-3 text-lg font-semibold text-black placeholder:text-gray-600 focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-500"
          >
            {recent7.map((d) => (
              <option key={d} value={d}>
                {new Date(d).toLocaleDateString("ja-JP")}
              </option>
            ))}
          </select>
        </div>

        {/* 健康・点呼（検温/アルコール + 写真貼付） */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-base">
          {/* 検温 */}
          <div className="space-y-2 border-2 rounded-xl px-3 py-3">
            <label className="flex items-center justify-between gap-3">
              <span className="text-gray-700 font-semibold">検温</span>
              <select
                className="border-2 rounded-lg px-3 py-2 text-lg font-semibold text-black focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-500"
                value={tempCheck}
                onChange={(e) => setTempCheck(e.target.value as "OK" | "NG")}
              >
                <option>OK</option>
                <option>NG</option>
              </select>
            </label>
            <div>
              <div className="text-xs text-gray-700 mb-1 font-semibold">検温写真（任意）</div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) fileToDataUrl(f, setTempImg);
                }}
                className="block w-full text-sm"
              />
              {tempImg && (
                <div className="mt-2 w-40 h-24 border rounded overflow-hidden">
                  <img src={tempImg} alt="検温写真" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </div>

          {/* アルコール */}
          <div className="space-y-2 border-2 rounded-xl px-3 py-3">
            <label className="flex items-center justify-between gap-3">
              <span className="text-gray-700 font-semibold">アルコール</span>
              <select
                className="border-2 rounded-lg px-3 py-2 text-lg font-semibold focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-500"
                value={alcoholCheck}
                onChange={(e) => setAlcoholCheck(e.target.value as "OK" | "NG")}
              >
                <option>OK</option>
                <option>NG</option>
              </select>
            </label>
            <div>
              <div className="text-xs text-gray-700 mb-1 font-semibold">アルコール検知器写真（任意）</div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) fileToDataUrl(f, setAlcoholImg);
                }}
                className="block w-full text-sm"
              />
              {alcoholImg && (
                <div className="mt-2 w-40 h-24 border rounded overflow-hidden">
                  <img src={alcoholImg} alt="アルコール写真" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* NG理由（必要時のみ） */}
        {(tempCheck === "NG" || alcoholCheck === "NG") && (
          <div className="mt-3">
            <input
              className={`border-2 rounded-xl px-4 py-3 w-full text-lg focus:outline-none focus:ring-4 focus:ring-rose-200 ${
                !reason.trim() ? "border-rose-400 bg-rose-50" : "border-gray-300"
              }`}
              placeholder="NG理由を入力"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        )}

        {/* 走行距離 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-base mt-5">
          <input
            className="border-2 rounded-xl px-4 py-3 text-lg text-black placeholder:text-gray-600 focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-500"
            type="number"
            inputMode="decimal"
            placeholder="開始距離 (km)"
            value={startDistance}
            onChange={(e) => setStartDistance(e.target.value)}
          />
          <input
            className="border-2 rounded-xl px-4 py-3 text-lg text-black placeholder:text-gray-600 focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-500"
            type="number"
            inputMode="decimal"
            placeholder="終了距離 (km)"
            value={endDistance}
            onChange={(e) => setEndDistance(e.target.value)}
          />
        </div>

        {/* メーター写真（任意） */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-base mt-5">
          <div className="border-2 rounded-xl p-4">
            <div className="text-sm text-gray-700 mb-2 font-semibold">開始メーター写真（任意）</div>
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
          <div className="border-2 rounded-xl p-4">
            <div className="text-sm text-gray-700 mb-2 font-semibold">終了メーター写真（任意）</div>
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
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            className="px-4 py-3 text-base md:text-lg bg-orange-600 text-white rounded-xl font-bold shadow-sm active:scale-[0.98]"
            onClick={() => stamp("start")}
          >
            稼働開始
          </button>
          <button
            className="px-4 py-3 text-base md:text-lg bg-orange-600 text-white rounded-xl font-bold shadow-sm active:scale-[0.98]"
            onClick={() => stamp("breakStart")}
          >
            休憩開始
          </button>
          <button
            className="px-4 py-3 text-base md:text-lg bg-orange-600 text-white rounded-xl font-bold shadow-sm active:scale-[0.98]"
            onClick={() => stamp("breakEnd")}
          >
            休憩終了
          </button>
          <button
            className="px-4 py-3 text-base md:text-lg bg-orange-600 text-white rounded-xl font-bold shadow-sm active:scale-[0.98]"
            onClick={() => stamp("end")}
          >
            稼働終了
          </button>

          <button className="px-3 py-2 text-sm md:text-base border-2 rounded-xl ml-0 md:ml-3" onClick={() => cancel("start")}>
            開始取消
          </button>
          <button className="px-3 py-2 text-sm md:text-base border-2 rounded-xl" onClick={() => cancel("breakStart")}>
            休憩開始取消
          </button>
          <button className="px-3 py-2 text-sm md:text-base border-2 rounded-xl" onClick={() => cancel("breakEnd")}>
            休憩終了取消
          </button>
          <button className="px-3 py-2 text-sm md:text-base border-2 rounded-xl" onClick={() => cancel("end")}>
            終了取消
          </button>
        </div>

        {/* プレビュー生成 */}
        <div className="mt-8">
          <button
            onClick={handlePreview}
            className="px-6 py-4 text-lg bg-blue-700 text-white rounded-2xl font-extrabold shadow-md w-full md:w-auto"
          >
            PDFを作ってプレビュー
          </button>
        </div>
      </section>

      {/* ===== 反映ページ（下・PDF化される領域） ===== */}
      <div ref={printRef} className="bg-white rounded-2xl shadow-lg p-6 md:p-8 print:p-6 text-black">
        {/* ヘッダー */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="text-2xl md:text-3xl font-black tracking-wide">{company}</div>
            <div className="text-sm md:text-base text-gray-800">ドライバー日報（A4）</div>
          </div>
          <div className="text-right">
            <div className="mt-1">
              <label className="text-sm text-gray-800 mr-2">日付：</label>
              <span className="px-2 py-1 rounded border font-semibold text-base">
                {new Date(selectedDate).toLocaleDateString("ja-JP")}
              </span>
            </div>
            <div className="text-xs text-gray-800 mt-1">ドライバー：{driverName}</div>
          </div>
        </div>

        {/* 情報ブロック */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-base">
          {/* 体調・点呼 */}
          <section className="rounded-xl border-2 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-1.5 h-6 bg-blue-600 rounded" />
              <h3 className="text-lg md:text-xl font-bold">体調・点呼</h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-900">検温</span>
                <span
                  className={`px-3 py-1 rounded-lg text-sm md:text-base font-extrabold tracking-wide ${
                    tempCheck === "OK" ? "bg-emerald-200 text-emerald-900" : "bg-rose-200 text-rose-900"
                  }`}
                >
                  {tempCheck}
                </span>
              </div>
              {tempImg && (
                <div className="w-40 h-24 border rounded overflow-hidden">
                  <img src={tempImg} alt="検温写真" className="w-full h-full object-cover" />
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-gray-900">アルコール</span>
                <span
                  className={`px-3 py-1 rounded-lg text-sm md:text-base font-extrabold tracking-wide ${
                    alcoholCheck === "OK" ? "bg-emerald-200 text-emerald-900" : "bg-rose-200 text-rose-900"
                  }`}
                >
                  {alcoholCheck}
                </span>
              </div>
              {alcoholImg && (
                <div className="w-40 h-24 border rounded overflow-hidden">
                  <img src={alcoholImg} alt="アルコール写真" className="w-full h-full object-cover" />
                </div>
              )}

              {(tempCheck === "NG" || alcoholCheck === "NG") && (
                <div className="mt-2">
                  <div className="text-xs md:text-sm text-gray-600 mb-1">NG理由</div>
                  <div className={`border-2 rounded-lg p-3 min-h-[48px] ${!reason.trim() ? "border-rose-400 bg-rose-50" : "border-gray-200"}`}>
                    {reason || <span className="text-gray-400">（未入力）</span>}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 走行距離 */}
          <section className="rounded-xl border-2 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-1.5 h-6 bg-indigo-600 rounded" />
              <h3 className="text-lg md:text-xl font-bold">走行距離</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="border-2 rounded-lg p-3">
                <div className="text-xs md:text-sm text-gray-800">開始距離</div>
                <div className="text-xl md:text-2xl font-extrabold">
                  {startDistance ? `${startDistance} km` : "-"}
                </div>
              </div>
              <div className="border-2 rounded-lg p-3">
                <div className="text-xs md:text-sm text-gray-600">終了距離</div>
                <div className="text-xl md:text-2xl font-extrabold">
                  {endDistance ? `${endDistance} km` : "-"}
                </div>
              </div>
              <div className="col-span-2 border-2 rounded-lg p-3">
                <div className="text-xs md:text-sm text-gray-600">走行距離（自動計算）</div>
                <div className={`text-3xl md:text-4xl font-black tracking-wide ${kmDiff === null ? "text-gray-400" : "text-blue-700"}`}>
                  {kmDiff === null ? "-" : `${kmDiff} km`}
                </div>
              </div>
            </div>

            {(odomStartImg || odomEndImg) && (
              <div className="mt-4">
                <div className="text-xs md:text-sm text-gray-600 mb-2">メーター写真</div>
                <div className="flex gap-4">
                  {odomStartImg && (
                    <div className="w-36 h-24 border rounded-lg overflow-hidden">
                      <img src={odomStartImg} alt="開始メーター" className="w-full h-full object-cover" />
                    </div>
                  )}
                  {odomEndImg && (
                    <div className="w-36 h-24 border rounded-lg overflow-hidden">
                      <img src={odomEndImg} alt="終了メーター" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* タイムライン */}
        <section className="rounded-xl border-2 p-4 mt-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-1.5 h-6 bg-amber-600 rounded" />
            <h3 className="text-lg md:text-xl font-bold">勤務タイムライン</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-base">
            <div className="border-2 rounded-lg p-3">
              <div className="text-xs md:text-sm text-gray-600">稼働開始</div>
              <div className="font-mono text-lg md:text-xl">{timestamps.start || "-"}</div>
            </div>
            <div className="border-2 rounded-lg p-3">
              <div className="text-xs md:text-sm text-gray-600">休憩開始</div>
              <div className="font-mono text-lg md:text-xl">{timestamps.breakStart || "-"}</div>
            </div>
            <div className="border-2 rounded-lg p-3">
              <div className="text-xs md:text-sm text-gray-600">休憩終了</div>
              <div className="font-mono text-lg md:text-xl">{timestamps.breakEnd || "-"}</div>
            </div>
            <div className="border-2 rounded-lg p-3">
              <div className="text-xs md:text-sm text-gray-600">稼働終了</div>
              <div className="font-mono text-lg md:text-xl">{timestamps.end || "-"}</div>
            </div>
          </div>
        </section>

        {/* ===== ステータスバナー（最下部・ALL CLEARのみ表示） ===== */}
        {isComplete && (
          <div className="rounded-xl px-5 py-4 mt-6 border-2 bg-emerald-50 border-emerald-300 text-emerald-900">
            <div className="text-lg md:text-xl font-extrabold tracking-wide">
              ✅ 問題なし（ALL CLEAR）
            </div>
          </div>
        )}
      </div>

      {/* ===== プレビューモーダル ===== */}
      {preview.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center z-50 p-3">
          <div className="bg-white w-full max-w-5xl h-[82vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-lg md:text-xl">📄 プレビュー：{preview.fileName}</h3>
              <button
                className="text-red-600 font-semibold hover:underline"
                onClick={() => setPreview({ open: false, dataUrl: "", fileName: "" })}
              >
                閉じる
              </button>
            </div>
            <iframe src={preview.dataUrl} className="flex-1 w-full" title="日報プレビュー" />
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                className="px-4 py-2 border-2 rounded-xl"
                onClick={() => setPreview({ open: false, dataUrl: "", fileName: "" })}
              >
                やり直す
              </button>
              <button className="px-5 py-3 bg-green-600 text-white rounded-xl font-bold" onClick={handleSend}>
                この内容で送信
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
