// ShiftRegister.tsx
import React, { useState, useEffect } from 'react';
import projectList from "../data/ProjectList";
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { createPS } from "../utils/pdfUtils";
import "jspdf-autotable";

type ShiftItem = {
  project: string;
  /** 単価 (円/日) – ProjectList.unitPrice をコピーして保持 */
  unitPrice: number;
  /** 実績ステータス – 空＝通常 */
  status?: 'normal' | 'late' | 'early' | 'absent';
};

const StatusSelect: React.FC<{
  value?: ShiftItem['status'];
  onChange: (v: ShiftItem['status']) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => (
  <select
    /* ▼ クラス名をまとめて result-select に置き換え  */
    className="result-select ml-1"
    value={value ?? 'normal'}
    onChange={e => onChange(e.target.value as any)}
    disabled={disabled}
  >
    <option value="normal">ー</option>
    <option value="late">遅刻</option>
    <option value="early">早退</option>
    <option value="absent">欠勤</option>
  </select>
);

const AdminShiftRegister = () => {
  const today = new Date();
  const [hasLoaded, setHasLoaded] = useState(false); 
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [shifts, setShifts] = useState({});
  const [projects, setProjects] = useState(projectList);
  /** { 案件名 : 単価 } をメモ化 */
const projectPriceMap = React.useMemo(
  () =>
    Object.fromEntries(
      projects.map((p: any) => [p.name, Number(p.unitPrice) || 0])
    ) as Record<string, number>,
  [projects]
);
  const [driverList, setDriverList] = useState<{ id: string; name: string }[]>([]);
  const [abbreviations, setAbbreviations] = useState({});
  const [showAbbreviationModal, setShowAbbreviationModal] = useState(false);
  const [requiredPersonnel, setRequiredPersonnel] = useState<{ [date: string]: { [project: string]: number } }>({});
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [showRequiredModal, setShowRequiredModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isResultConfirmed, setIsResultConfirmed] = useState(false);

const ShiftCell: React.FC<{ driverId: string; dateStr: string }> = ({
  driverId,
  dateStr,
}) => {
  /** その日のバッジ一覧を配列化 */
  const items: ShiftItem[] = Array.isArray(shifts[driverId]?.[dateStr])
    ? shifts[driverId][dateStr]
    : shifts[driverId]?.[dateStr]
    ? [shifts[driverId][dateStr]]
    : [];

  const [adding, setAdding] = useState(false);

  /* -------------------- 確定後 -------------------- */
  if (isConfirmed) {
  return (
    <div className="flex flex-col gap-0.5">
      {items.map((it, idx) => {
        const p = projects.find(pr => pr.name === it.project);
        if (!p) return null;

        /* 表示用プロパティ */
        const badgeBg  = it.status === 'absent' ? '#9ca3af' : p.color;
        const badgeTxt = abbreviations[p.name] || p.name;

        return (
          <div key={idx} className="flex items-center">
            {/* 案件バッジ */}
            <div
              className="badge-cell rounded-md"
              style={{ backgroundColor: badgeBg, color: p.textColor }}
            >
              {badgeTxt}
            </div>

            {/* 実績ステータス */}
            {!isResultConfirmed ? (
              <StatusSelect
                value={it.status}
                disabled={false}
                onChange={v => {
                  setShifts(prev => {
                    const list = [...items];
                    list[idx]  = { ...list[idx], status: v };
                    return { ...prev, [driverId]: { ...prev[driverId], [dateStr]: list } };
                  });
                }}
              />
            ) : (
              <span
                /* before: className="badge-cell-status bg-gray-300" */
  className="badge-cell-status-big bg-gray-300"
  title={it.status}
              >
                {{
                  late:  '遅',
                  early: '早',
                  absent:'欠',
                  normal:''
                }[it.status ?? 'normal']}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

  return (
    <div className="flex flex-col gap-0.5">
      {items.map((it, i) => {
        const p = projects.find((pr) => pr.name === it.project);
        if (!p) return null;
        return (
          <div
            key={i}
            className="h-6 w-24 rounded-md text-xs font-bold flex justify-center items-center cursor-pointer"
            style={{ backgroundColor: p.color, color: p.textColor }}
            title="クリックで削除"
            onClick={() => handleChange(driverId, dateStr, null)}
          >
            {abbreviations[p.name] || p.name}
          </div>
        );
      })}

      {/* 新規追加プルダウン */}
      {adding ? (
        <select
          autoFocus
          onBlur={() => setAdding(false)}
          className="border text-xs rounded-md py-0.5 w-24"
          onChange={(e) => {
            if (e.target.value)
              handleChange(driverId, dateStr, e.target.value);
            setAdding(false);
          }}
        >
          <option value="">案件選択</option>
          {projects.map((p) => (
            <option key={p.id} value={p.name}>
              {abbreviations[p.name] || p.name}
            </option>
          ))}
        </select>
      ) : (
        <button
          type="button"
          className="h-6 w-24 border border-dashed text-xs text-gray-500 rounded"
          onClick={() => setAdding(true)}
        >
          ＋ 追加
        </button>
      )}
    </div>
  );
};

useEffect(() => {
  const savedAbbreviations = localStorage.getItem('projectAbbreviations');
  if (savedAbbreviations) {
    setAbbreviations(JSON.parse(savedAbbreviations));
  }
}, []);
useEffect(() => {
  const saved = localStorage.getItem(`confirmedShift_${year}_${month}`);
  if (saved === 'true') {
    setIsConfirmed(true);
  }
}, [year, month]);

useEffect(() => {
  const saved = localStorage.getItem(`confirmedResult_${year}_${month}`);
  if (saved === 'true') setIsResultConfirmed(true);
}, [year, month]);

useEffect(() => {
  const savedDrivers = localStorage.getItem("driverList");
  if (savedDrivers) {
    try {
      const parsed = JSON.parse(savedDrivers); // ← idとnameを両方保持
      setDriverList(parsed);
    } catch (e) {
      console.error("ドライバーリスト読み込み失敗", e);
    }
  }
}, []);
useEffect(() => {
  const savedProjects = localStorage.getItem("projectList");
  if (savedProjects) {
    const parsed = JSON.parse(savedProjects);
    const fixed = parsed.map(p => ({
      ...p,
      color: p.color || "#cccccc" // colorが無い場合にデフォルト補完
    }));
    setProjects(fixed);
    localStorage.setItem("projectList", JSON.stringify(fixed)); // 上書き保存
  } else {
    // 初回ロード時の初期保存
    localStorage.setItem("projectList", JSON.stringify(projectList));
  }
  setLoading(false);
}, []);
useEffect(() => {
  const key = `shifts_${year}_${month}`;
  const savedShifts = localStorage.getItem(key);
  if (savedShifts) {
    try {
      setShifts(JSON.parse(savedShifts));
    } catch (e) {
      console.error("シフト読み込みエラー", e);
    }
  }
  setHasLoaded(true); // ✅ ←これを追加（復元が完了した印）
}, [year, month]);
useEffect(() => {
  if (!hasLoaded) return;
  const key = `shifts_${year}_${month}`;
  try {
    localStorage.setItem(key, JSON.stringify(shifts));
  } catch (e) {
    console.error("自動保存失敗", e);
  }
}, [shifts, year, month, hasLoaded]);
useEffect(() => {
  const saved = localStorage.getItem("requiredPersonnel");
  if (saved) {
    setRequiredPersonnel(JSON.parse(saved));
  }
}, []);
const handleSaveAbbreviations = () => {
  localStorage.setItem('projectAbbreviations', JSON.stringify(abbreviations));
  setShowAbbreviationModal(false);
};
const handleConfirmShift = () => {
  // ① 確定フラグを保存
  localStorage.setItem(`confirmedShift_${year}_${month}`, "true");
  setIsConfirmed(true);

  // ② ドライバーごとの発注書 PDF を生成して localStorage に保存
  const drivers = JSON.parse(localStorage.getItem("driverList") || "[]");
  const pdfMonth = `${year}-${String(month).padStart(2, "0")}`;

  drivers.forEach((drv: any) => {
    // ドライバーの当月シフトだけ抽出
    const drvShifts: ShiftItem[] = Object.values(shifts?.[drv.id] || {})
      .flat()                              // 日付ごとの配列をまとめる
      .filter((s: any) => !!s);            // null チェック

    if (drvShifts.length === 0) return;    // シフトが無ければスキップ

    const doc = new jsPDF();

    /* ------ ヘッダ ------ */
    doc.setFontSize(14);
    doc.text("発注書", 105, 20, { align: "center" });

    doc.setFontSize(11);
    doc.text(`対象月：${pdfMonth}`,       20, 34);
    doc.text(`氏名　：${drv.name}`,        20, 42);
    doc.text(`住所　：${drv.address ?? "未登録"}`, 20, 50);
    doc.text(`電話　：${drv.phone   ?? "未登録"}`, 20, 58);

    /* ------ 明細テーブル ------ */
    doc.autoTable({
      head: [["案件名", "単価(円/日)"]],
      body: drvShifts.map(s => [s.project, s.unitPrice.toLocaleString()]),
      startY: 70,
      styles: { fontSize: 10 }
    });

    /* ------ 合計 ------ */
    const total = drvShifts.reduce((sum, s) => sum + s.unitPrice, 0);
    doc.text(`合計金額：${total.toLocaleString()} 円（税込）`,
             20, doc.lastAutoTable.finalY + 10);

    /* ------ 保存 ------ */
    const dataUrl = doc.output("dataurlstring");
    localStorage.setItem(
      `po_${year}_${String(month).padStart(2, "0")}_${drv.id}`,
      JSON.stringify({
        driverId:   drv.id,
        driverName: drv.name,
        fileName:   `PO_${year}${String(month).padStart(2,"0")}_${drv.id}.pdf`,
        date:       `${pdfMonth}-01`,
        dataUrl
      })
    );
  });
};

const handleUnconfirmShift = () => {
  const confirm = window.confirm("本当に未確定に戻しますか？再度編集が可能になります。");
  if (confirm) {
    setIsConfirmed(false);
    setIsResultConfirmed(false);
    localStorage.removeItem(`confirmedShift_${year}_${month}`);
    localStorage.removeItem(`confirmedResult_${year}_${month}`);
  }
};
const handleExportPDF = async () => {
  const table = document.querySelector('table');
  if (!table) return;

  /* ===== 1. キャプチャ用クラス付与（PDF サイズ用の CSS を当てる） ===== */
  table.classList.add('pdf-export');

  /* ===== 2. html2canvas で高解像度キャプチャ ===== */
  const canvas = await html2canvas(table, {
    scale:        3,                     // 解像度アップ
    scrollX:      0,
    scrollY:      0,
    windowWidth:  table.scrollWidth,
    windowHeight: table.scrollHeight,
  });

  table.classList.remove('pdf-export');  // 後始末

  /* ===== 3. jsPDF で自動ページ分割しながら貼り付け ===== */
  const imgData = canvas.toDataURL('image/png');
  const pdf     = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const pageW   = pdf.internal.pageSize.getWidth();
  const pageH   = pdf.internal.pageSize.getHeight();
  const ratio   = canvas.height / canvas.width;
  const imgH    = pageW * ratio;         // 画像を横幅ピッタリに縮小したときの高さ

  if (imgH <= pageH) {
    // 1 ページで収まる
    pdf.addImage(imgData, 'PNG', 0, 0, pageW, imgH);
  } else {
    // 複数ページに分割
    let offsetY   = 0;
    const sliceH  = canvas.width * (pageH / pageW);   // 1 ページ分の高さ (px)

    while (offsetY < canvas.height) {
      const partH = Math.min(sliceH, canvas.height - offsetY);

      // キャンバスをページ分だけ切り出し
      const slice = document.createElement('canvas');
      slice.width  = canvas.width;
      slice.height = partH;
      slice
        .getContext('2d')!
        .drawImage(
          canvas,
          0, offsetY, canvas.width, partH,
          0, 0,       canvas.width, partH
        );

      pdf.addImage(slice.toDataURL('image/png'), 'PNG', 0, 0, pageW, pageH);

      offsetY += partH;
      if (offsetY < canvas.height) pdf.addPage();
    }
  }

  pdf.save(`${year}年${month}月_シフト表.pdf`);
};

  const getDaysOfMonth = (year: number, month: number) => {
  const result = [];
  const date = new Date(year, month - 1, 1);
  while (date.getMonth() === month - 1) {
    const localDate = new Date(date); // 毎回コピー
    const yyyy = localDate.getFullYear();
    const mm = String(localDate.getMonth() + 1).padStart(2, '0');
    const dd = String(localDate.getDate()).padStart(2, '0');
    result.push({
      date: localDate,
      day: localDate.getDay(),
      dateStr: `${yyyy}-${mm}-${dd}` // UTCではなくローカルで構築
    });
    date.setDate(date.getDate() + 1);
  }
  return result;
};
const days = getDaysOfMonth(year, month);
 const handleChange = (
  driverId: string,
  dateStr: string,
  projectName: string | null   // null → 最後のバッジを削除
) => {
  setShifts(prev => {
    /* 既存を配列化 */
    const oldList: ShiftItem[] = Array.isArray(prev?.[driverId]?.[dateStr])
      ? [...prev[driverId][dateStr]]
      : prev?.[driverId]?.[dateStr]
      ? [prev[driverId][dateStr]]
      : [];

    /* 追加 or 削除 */
    const newList = projectName
      ? [
          ...oldList,
          {
            project: projectName,
            unitPrice: projectPriceMap[projectName] ?? 0, // 👈 単価をコピー
          },
        ]
      : oldList.slice(0, -1);

    const updated = {
      ...prev,
      [driverId]: { ...prev[driverId], [dateStr]: newList },
    };
    localStorage.setItem(`shifts_${year}_${month}`, JSON.stringify(updated));
    return updated;
  });
};

const getAssignedCount = (dateStr: string, projectName: string) =>
driverList.reduce((count, drv) => {
 const list = Array.isArray(shifts[drv.id]?.[dateStr])
   ? shifts[drv.id][dateStr]
   : shifts[drv.id]?.[dateStr]
   ? [shifts[drv.id][dateStr]]
   : [];
 return count + list.filter(it => it.project === projectName).length;
}, 0);

const calculateTotalMinutes = (driverId: string) =>
  days.reduce((total, d) => {
    const list = Array.isArray(shifts[driverId]?.[d.dateStr])
      ? shifts[driverId][d.dateStr]
      : shifts[driverId]?.[d.dateStr]
      ? [shifts[driverId][d.dateStr]]
      : [];

    const dayMinutes = list.reduce((sub, it) => {
      if (it.status === 'absent') return sub;
      const p = projects.find((pr) => pr.name === it.project);
      if (!p || !p.startTime || !p.endTime) return sub;

      const [sh, sm] = p.startTime.split(":").map(Number);
      const [eh, em] = p.endTime.split(":").map(Number);
      return sub + Math.max(eh * 60 + em - (sh * 60 + sm), 0);
    }, 0);

    return total + dayMinutes;
  }, 0);
  
  const years = [2024, 2025, 2026];
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  if (loading || driverList.length === 0 || projects.length === 0) {
  return <div>読み込み中...</div>;
}

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4 flex items-center">
        <span role="img" aria-label="shift" className="text-blue-600 text-3xl mr-2">📅</span>
        シフト登録<span className="ml-2 text-sm text-gray-500">-Shift Register-</span>
      </h2>
      <div className="flex items-center mb-4 gap-2">
        <select value={year} onChange={e => setYear(+e.target.value)} className="border px-2 py-1 rounded">
          {years.map(y => <option key={y} value={y}>{y}年</option>)}
        </select>
        <select value={month} onChange={e => setMonth(+e.target.value)} className="border px-2 py-1 rounded">
          {months.map(m => <option key={m} value={m}>{m}月</option>)}
        </select>
        <button onClick={() => setShowAbbreviationModal(true)} className="ml-2 px-3 py-1 bg-gray-600 text-white round hover:bg-blue-200 transition">案件カスタム設定</button>
     <button
  className="ml-4 px-3 py-1 bg-blue-600 text-white rounded hover:bg-green-700"
  onClick={() => setShowRequiredModal(true)}
>
  案件別人員設定
</button>

<button
  className="ml-2 px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
  onClick={() => {
    const key = `shifts_${year}_${month}`;
    localStorage.setItem(key, JSON.stringify(shifts));
    alert("一時保存しました");
  }}
>
  一時保存
</button>

{!isConfirmed && (
  <button
    onClick={handleConfirmShift}
    className="ml-2 px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
  >
    シフト確定
  </button>
)}
{isConfirmed && (
  <div className="ml-4 flex items-center gap-2">
    <span className="text-green-700 font-semibold">
      ✅ シフトは確定済みです
    </span>

    {/* --- 実績確定ボタン／表示 --- */}
    {!isResultConfirmed ? (
      <button
        onClick={() => {
          if (window.confirm('実績を確定しますか？ 確定後は編集できません。')) {
            setIsResultConfirmed(true);
            localStorage.setItem(`confirmedResult_${year}_${month}`, 'true');
            driverList.forEach(async (drv) => {
  const hours = calculateTotalMinutes(drv.id) / 60;
  const dataUrl = await createPS(drv.name, year, month, hours);
  localStorage.setItem(
    `ps_${year}_${String(month).padStart(2,"0")}_${drv.id}`,
    JSON.stringify({
      driverName: drv.name,
      fileName:   `PS_${year}${String(month).padStart(2,"0")}_${drv.id}.pdf`,
      date:       `${year}-${String(month).padStart(2,"0")}-01`,
      dataUrl,
    })
  );
});
          }
        }}
        className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
      >
        実績確定
      </button>
    ) : (
      <span className="text-indigo-700 font-semibold">✅ 実績確定済み</span>
    )}

    {/* --- PDF 出力 & 未確定戻し --- */}
    <button
      onClick={handleExportPDF}
      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
    >
      PDF出力
    </button>
    <button
      onClick={handleUnconfirmShift}
      className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
    >
      未確定に戻す
    </button>
  </div>
)}

      </div>
      {showAbbreviationModal && (
        <div className="border p-4 bg-white shadow-lg rounded mb-4">
          <h3 className="font-bold mb-2">案件の略称設定</h3>
         
  {/* —— 新しい略称設定テーブル —— */}
<div className="overflow-x-auto">
  <table className="w-full text-sm border-collapse">
    <thead>
      <tr className="bg-gray-100 text-gray-700">
        <th className="border px-2 py-1 text-left">案件名</th>
        <th className="border px-2 py-1 text-left">略称入力</th>
        <th className="border px-2 py-1 text-center">色選択</th>
        <th className="border px-2 py-1 text-center">文字色選択</th>
      </tr>
    </thead>

    <tbody>
      {projects.map((p) => (
        <tr key={p.id}>
          {/* 案件名 */}
          <td className="border px-2 py-1 whitespace-nowrap">{p.name}</td>

          {/* 略称入力（枠線付き） */}
          <td className="border px-2 py-1">
            <input
              type="text"
              className="w-full border rounded px-2 py-1"
              value={abbreviations[p.name] || ""}
              onChange={(e) =>
                setAbbreviations({
                  ...abbreviations,
                  [p.name]: e.target.value,
                })
              }
              placeholder="例）A社"
            />
          </td>

          {/* 背景色 */}
          <td className="border px-2 py-1 text-center">
            <input
              type="color"
              value={p.color || "#cccccc"}
              onChange={(e) => {
                const updated = projects.map((prj) =>
                  prj.name === p.name
                    ? { ...prj, color: e.target.value }
                    : prj
                );
                setProjects(updated);
                localStorage.setItem(
                  "projectList",
                  JSON.stringify(updated)
                );
              }}
              title="セル背景色"
            />
          </td>

          {/* 文字色 */}
          <td className="border px-2 py-1 text-center">
            <select
              value={p.textColor || "#000000"}
              onChange={(e) => {
                const updated = projects.map((prj) =>
                  prj.name === p.name
                    ? { ...prj, textColor: e.target.value }
                    : prj
                );
                setProjects(updated);
                localStorage.setItem(
                  "projectList",
                  JSON.stringify(updated)
                );
              }}
              className="border rounded px-1 py-0.5"
            >
              <option value="#000000">黒文字</option>
              <option value="#ffffff">白文字</option>
            </select>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

          <button
  className="mt-2 px-4 py-1 bg-blue-500 text-white rounded"
  onClick={handleSaveAbbreviations}
>
  保存
</button>
        </div>
      )}
     {showRequiredModal && (
  <div className="border p-4 bg-white shadow-lg rounded mb-4">
    <h3 className="font-bold mb-2">案件ごとの必要人数設定（日付別）</h3>

    {projects.map(project => (
      <div key={project.id} className="mb-4">
        <div className="flex items-center mb-2 gap-2">
          <strong className="w-32">{project.name}</strong>
          <input
            type="number"
            min={0}
            placeholder="この月の全日に反映"
            className="border px-2 py-1 w-32"
            onChange={e => {
              const value = parseInt(e.target.value, 10) || 0;
              const newRequired = { ...requiredPersonnel };
              days.forEach(d => {
                const key = `${project.name}_${d.dateStr}`;
                newRequired[key] = value;
              });
              setRequiredPersonnel(newRequired);
            }}
          />
          <span className="text-sm text-gray-500">※上記は一括入力欄</span>
        </div>

        <div className="grid grid-cols-5 gap-2 text-sm">
          {days.map(d => {
            const key = `${project.name}_${d.dateStr}`;
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="w-20">{d.dateStr.split('-')[2]}日</span>
                <input
                  type="number"
                  min={0}
                  value={requiredPersonnel[key] || ''}
                  className="border px-2 py-1 w-16"
                  onChange={e =>
                    setRequiredPersonnel(prev => ({
                      ...prev,
                      [key]: parseInt(e.target.value, 10) || 0
                    }))
                  }
                />
              </div>
            );
          })}
        </div>
      </div>
    ))}

    <button
      className="mt-4 px-4 py-1 bg-yellow-500 text-white rounded"
      onClick={() => {
        localStorage.setItem("requiredPersonnel", JSON.stringify(requiredPersonnel));
        setShowRequiredModal(false);
      }}
    >
      保存
    </button>
  </div>
)}
      <table className="w-full border border-collapse shadow text-sm">
        <thead>
  {/* 日付 + 曜日行 */}
  <tr className="bg-blue-100 text-gray-800 sticky top-0 z-30">
    <th className="border px-1 py-1">氏名</th>
    {days.map(d => (
      <th key={d.dateStr} className={`border px-1 py-1 text-center ${d.day === 0 ? 'bg-red-100' : d.day === 6 ? 'bg-blue-50' : 'bg-white'}`}>
        {d.dateStr.split('-')[2]}<br />
        {['日', '月', '火', '水', '木', '金', '土'][d.day]}
      </th>
    ))}
    <th className="sticky top-0 z-10 bg-blue-100 border px-1 py-1">合計時間</th>
     </tr>

  {/* 人員過不足表示行 */}
  </thead>
        <tbody>
          {/* 人員過不足表示（縦に案件ごと） */}
{projects.map((p, index) => (
  <tr key={`shortage-${p.name}`} className="bg-yellow-50 text-xs text-center sticky top-[48px] z-20">
    <td className="border px-1 py-1 font-semibold text-gray-700 whitespace-nowrap">
      {abbreviations[p.name] || p.name}
    </td>
    {days.map(d => {
      const key = `${p.name}_${d.dateStr}`;
      const required = requiredPersonnel[key] || 0;
      const assigned = getAssignedCount(d.dateStr, p.name);
      const diff = assigned - required;

      let color = 'text-black';
      if (diff > 0) color = 'text-blue-600';
      if (diff < 0) color = 'text-red-600';

      return (
        <td key={`${key}-short`} className={`border px-1 py-1 text-xs ${color}`}>
  {diff === 0 ? '0' : diff > 0 ? `+${diff}` : `${diff}`}
</td>
      );
    })}
   <th className="sticky top-[42px] z-10 bg-yellow-50 border px-1 py-1">-</th>
  </tr>
))}
          {driverList.map((driver, i) => (
            <tr key={driver.id} className={i % 2 === 0 ? 'bg-white' : 'bg-purple-100'}>
              <td className="border px-1 py-1 text-center whitespace-nowrap">{driver.name}</td>
              {days.map(d => (
                <td key={d.dateStr} className="border px-1 py-1">
                  <div className="flex items-center gap-1">
  <ShiftCell driverId={driver.id} dateStr={d.dateStr} />
</div>
    </td>
              ))}
              <td className="border px-1 py-1 text-right">
                {(calculateTotalMinutes(driver.id) / 60).toFixed(1)}h
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div> 
  ); 
};

export default AdminShiftRegister;

