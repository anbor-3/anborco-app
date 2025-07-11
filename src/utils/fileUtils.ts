
import JSZip from "jszip";

export interface DailyReportMeta {
  driverId: string;
  driverName: string;
  date: string;
  fileName: string;
  dataUrl: string;
}

export const saveDailyReport = (meta: DailyReportMeta) => {
  const key = `daily_${meta.date}_${meta.driverId}`;
  localStorage.setItem(key, JSON.stringify(meta));
};

export const runArchiveIfNeeded = async () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm   = today.getMonth() + 1;
  const dd   = today.getDate();

  if (dd === 1) {
    await zipPreviousMonth(yyyy, mm);
  }

  if (mm === 1 && dd === 1) {
    await zipPreviousYear(yyyy);
    deleteOldYearZip(yyyy - 2);
  }
};

/* ---------------- 前月 1日〜月末だけ ZIP 化 ------------------ */
const zipPreviousMonth = async (yyyy: number, mm: number) => {
  // mm は「今月」なので 1 を引いて前月へ
  const prevMonthDate = new Date(yyyy, mm - 2, 1); // 前月 1 日
  const year  = prevMonthDate.getFullYear();
  const month = String(prevMonthDate.getMonth() + 1).padStart(2, "0");

  const zipPerDriver: Record<string, JSZip> = {};

  // 前月 1日〜月末を算出
  const start = `${year}-${month}-01`;
  const endDay = new Date(year, parseInt(month), 0).getDate(); // 月末日
  const end   = `${year}-${month}-${String(endDay).padStart(2, "0")}`;

  for (const key in localStorage) {
    if (!key.startsWith("daily_")) continue;
    const meta: DailyReportMeta = JSON.parse(localStorage.getItem(key)!);

    // 期間チェック
    if (meta.date >= start && meta.date <= end) {
      if (!zipPerDriver[meta.driverId]) zipPerDriver[meta.driverId] = new JSZip();
      zipPerDriver[meta.driverId].file(
        meta.fileName,
        meta.dataUrl.split(",")[1],
        { base64: true }
      );
      localStorage.removeItem(key);          // ZIP 化済み PDF は削除
    }
  }

  // ZIP を driver ごとに保存
  await Promise.all(
    Object.entries(zipPerDriver).map(async ([driverId, zip]) => {
      const zipKey = `monthlyZip_${year}-${month}_${driverId}`;
      const blob = await zip.generateAsync({ type: "blob" });
      const reader = new FileReader();
      reader.onload = () => {
        localStorage.setItem(zipKey, reader.result as string);
      };
      reader.readAsDataURL(blob);
    })
  );
};

const zipPreviousYear = async (yyyy: number) => {
  const prevYear = yyyy - 1;
  const zipPerDriver: Record<string, JSZip> = {};

  for (const key in localStorage) {
    if (!key.startsWith("monthlyZip_")) continue;
    if (!key.includes(`${prevYear}-`)) continue;

    const [ , tag, driverId ] = key.split("_");
    if (!zipPerDriver[driverId]) zipPerDriver[driverId] = new JSZip();
    const dataUrl = localStorage.getItem(key)!;
    const monthZipName = `${tag}.zip`;
    zipPerDriver[driverId].file(monthZipName, dataUrl.split(",")[1], { base64: true });
    localStorage.removeItem(key);
  }

  await Promise.all(
    Object.entries(zipPerDriver).map(async ([driverId, zip]) => {
      const blob = await zip.generateAsync({ type: "blob" });
      const reader = new FileReader();
      reader.onload = () => {
        const zipKey = `yearZip_${prevYear}_${driverId}`;
        localStorage.setItem(zipKey, reader.result as string);
      };
      reader.readAsDataURL(blob);
    })
  );
};

const deleteOldYearZip = (oldYear: number) => {
  for (const key in localStorage) {
    if (key.startsWith(`yearZip_${oldYear}_`)) {
      localStorage.removeItem(key);
    }
  }
};
