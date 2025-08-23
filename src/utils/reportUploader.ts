// パスはあなたの構成に合わせて調整（例: "../firebaseClient"）
import { db, storage } from "../firebaseClient";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

type UploadArgs = {
  company: string;
  driverId: string;
  driverName: string;
  date: string;      // "YYYY-MM-DD"
  dataUrl: string;   // "data:application/pdf;base64,...."
};

export async function uploadDailyReport({
  company, driverId, driverName, date, dataUrl,
}: UploadArgs) {
  const y = date.slice(0, 4);
  const m = date.slice(5, 7);
  const d = date.slice(8, 10);

  const fileName = `${y}年${m}月${d}日_${driverName}_日報.pdf`;
  const storagePath = `companies/${company}/drivers/${driverId}/daily/${y}/${m}/${fileName}`;

  // 1) Storage に PDF を保存
  const sref = ref(storage, storagePath);
  await uploadString(sref, dataUrl, "data_url", { contentType: "application/pdf" });
  const url = await getDownloadURL(sref);

  const now = serverTimestamp();

  // 2) Driver のファイル一覧（kind: daily）
  await setDoc(
    doc(db, "companies", company, "drivers", driverId, "files", `daily:${date}`),
    {
      kind: "daily",
      date,
      fileName,
      path: storagePath,
      url,
      year: y,
      month: m,
      day: d,
      createdAt: now,
    },
    { merge: true }
  );

  // 3) 月/年フォルダの“マーカー”を作成
  await setDoc(
    doc(db, "companies", company, "drivers", driverId, "files", `folder:${y}-${m}`),
    { kind: "monthlyFolder", label: `${y}年${m}月`, year: y, month: m, createdAt: now },
    { merge: true }
  );
  await setDoc(
    doc(db, "companies", company, "drivers", driverId, "files", `folder:${y}`),
    { kind: "yearlyFolder", label: `${y}年`, year: y, createdAt: now },
    { merge: true }
  );

  // 4) 会社集計コレクション（管理画面用）
  await setDoc(
    doc(db, "companies", company, "dailyReports", `${driverId}:${date}`),
    {
      driverId, driverName, company, date,
      fileName, path: storagePath, url,
      year: y, month: m, day: d,
      createdAt: now,
    },
    { merge: true }
  );

  // 5) 通知（任意：管理者一覧で使う）
  await setDoc(
    doc(db, "companies", company, "notifications", `report:${driverId}:${date}`),
    {
      type: "report",
      category: "日報提出",
      message: `${driverName} が ${y}年${m}月${d}日に日報を提出しました。`,
      target: driverId,
      read: false,
      createdAt: now,
    },
    { merge: true }
  );

  return { url, fileName, storagePath };
}
