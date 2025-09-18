"use client";
import React, { useEffect, useMemo, useState, useCallback } from "react";

/* ========================= Types ========================= */

type DriverRow = { id: string; name: string };

type ShiftItem = {
  project: string;
  /** 単価 (円/日) */
  unitPrice: number;
  /** 実績ステータス – 空＝通常 */
  status?: "normal" | "late" | "early" | "absent";
};

// 1セルに複数案件を置けるので DayEntries は配列 or 単体 or undefined
type DayEntries = ShiftItem[] | ShiftItem | undefined;
type ShiftsState = Record<string, Record<string, DayEntries>>; // driverId → dateStr → entries

/* ========================= Utils ========================= */

// 案件名の混在配列から「ドライバーだけ」を抽出して正規化
const pickDrivers = (arr: any[], projectNames: Set<string>): DriverRow[] =>
  (Array.isArray(arr) ? arr : [])
    .filter((x) => {
      if (!x) return false;

      const name = x.name ?? x.fullName ?? x.displayName ?? x.driverName ?? "";

      // 案件名と一致 → 除外
      if (projectNames.has(String(name))) return false;

      // 案件っぽいキーを持つ → 除外
      if ("unitPrice" in x || "startTime" in x || "endTime" in x || "color" in x || "textColor" in x) return false;

      const id = x.id ?? x.uid ?? x.loginId ?? x.driverId ?? "";
      return Boolean(id && name);
    })
    .map((x) => ({
      id: x.id ?? x.uid ?? x.loginId ?? x.driverId ?? "",
      name: x.name ?? x.fullName ?? x.displayName ?? x.driverName ?? "",
    }));

const getDaysOfMonth = (year: number, month: number) => {
  const result: { date: Date; day: number; dateStr: string }[] = [];
  const date = new Date(year, month - 1, 1);
  while (date.getMonth() === month - 1) {
    const localDate = new Date(date); // 毎回コピー（UTCずれ回避）
    const yyyy = localDate.getFullYear();
    const mm = String(localDate.getMonth() + 1).padStart(2, "0");
    const dd = String(localDate.getDate()).padStart(2, "0");
    result.push({
      date: localDate,
      day: localDate.getDay(),
      dateStr: `${yyyy}-${mm}-${dd}`,
    });
    date.setDate(date.getDate() + 1);
  }
  return result;
};

/* ========================= API helpers（本番仕様） =========================
   .env で API ベース URL を切り替え
   - Vite:           VITE_API_BASE_URL=https://api.example.com
   - Next.js (App):  NEXT_PUBLIC_API_BASE=https://api.example.com
   未設定なら空文字で同一オリジンの相対パスを叩く
========================================================================== */

const API_BASE: string =
  // Next.js
  (((typeof process !== "undefined" ? (process as any) : undefined)?.env?.NEXT_PUBLIC_API_BASE) as string) ||
  // Vite
  (((typeof import.meta !== "undefined" ? (import.meta as any) : undefined)?.env?.VITE_API_BASE_URL) as string) ||
  "";

/** base と path を安全に結合（スラッシュ重複/欠落を吸収） */
const joinURL = (base: string, path: string) => {
  if (!base) return path; // base 未設定なら相対パスのまま
  const b = base.replace(/\/+$/, "");
  const p = path.replace(/^\/+/, "");
  return `${b}/${p}`;
};

/** ヘッダーを常にプレーン連想配列に統一 */
type PlainHeaders = Record<string, string>;

/** JSON フェッチ（415: 非JSON応答検出） */
async function apiJSON<T>(
  path: string,
  init?: Omit<RequestInit, "headers"> & { headers?: PlainHeaders }
): Promise<T> {
  const url = joinURL(API_BASE, path);

  // ← Headers / string[][] を禁止して、必ずプレーン連想配列にする
  const headers: PlainHeaders = {
    Accept: "application/json",
    ...(init?.headers || {}),
  };

  const res = await fetch(url, {
    credentials: "include",
    ...init, // 先に展開
    headers, // 最後に上書き（型は常に PlainHeaders）
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err: any = new Error(`HTTP ${res.status} at ${url}\n${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    const err: any = new Error(`Expected JSON but got "${ct || "unknown"}" from ${url}\n${text.slice(0, 200)}`);
    err.status = 415;
    throw err;
  }

  return res.json();
}

// Firebase ID トークンを Authorization に付与
async function authHeader(): Promise<PlainHeaders> {
  try {
    const { getAuth } = await import("firebase/auth");
    const idToken = await getAuth().currentUser?.getIdToken?.();
    return idToken ? { Authorization: `Bearer ${idToken}` } : {};
  } catch {
    return {};
  }
}

const DriversAPI = {
  list: async (company: string) =>
    apiJSON<DriverRow[]>(`/api/drivers?company=${encodeURIComponent(company)}`, {
      headers: await authHeader(),
    }),
} as const;

type ShiftsGetRes = { shifts: ShiftsState; confirmed: boolean; resultConfirmed: boolean };
type ShiftsPutReq = { company: string; year: number; month: number; shifts: ShiftsState };

const ShiftsAPI = {
  get: async (company: string, year: number, month: number) =>
    apiJSON<ShiftsGetRes>(
      `/api/shifts?company=${encodeURIComponent(company)}&year=${year}&month=${month}`,
      { headers: await authHeader() }
    ),

  put: async (payload: ShiftsPutReq) =>
    apiJSON<{ ok: true }>(`/api/shifts`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify(payload),
    }),

  setConfirmed: async (company: string, year: number, month: number, value: boolean) =>
    apiJSON<{ ok: true }>(`/api/shifts/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ company, year, month, value }),
    }),

  setResultConfirmed: async (company: string, year: number, month: number, value: boolean) =>
    apiJSON<{ ok: true }>(`/api/shifts/result-confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ company, year, month, value }),
    }),
} as const;

const SettingsAPI = {
  getAbbr: async (company: string) =>
    apiJSON<Record<string, string>>(`/api/settings/abbr?company=${encodeURIComponent(company)}`, {
      headers: await authHeader(),
    }),

  putAbbr: async (company: string, map: Record<string, string>) =>
    apiJSON<{ ok: true }>(`/api/settings/abbr`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ company, abbr: map }),
    }),

  getRequired: async (company: string, year: number, month: number) =>
    apiJSON<Record<string, number>>(
      `/api/settings/required?company=${encodeURIComponent(company)}&year=${year}&month=${month}`,
      { headers: await authHeader() }
    ),

  putRequired: async (company: string, year: number, month: number, data: Record<string, number>) =>
    apiJSON<{ ok: true }>(`/api/settings/required`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ company, year, month, required: data }),
    }),

  /** 任意：サーバがあれば色/文字色も共有保存（無ければ使われません） */
  putProjectStyles: async (
    company: string,
    styles: Array<{ name: string; color: string; textColor: string }>
  ) =>
    apiJSON<{ ok: true }>(`/api/settings/project-styles`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ company, styles }),
    }),
} as const;

/* ========================= UI bits ========================= */

type StatusSelectProps = {
  value?: ShiftItem["status"];
  onChange: (v: ShiftItem["status"]) => void;
  disabled?: boolean;
};
const StatusSelect: React.FC<StatusSelectProps> = ({ value, onChange, disabled }: StatusSelectProps) => (
  <select
    className="ml-1 border rounded px-1 py-0.5 text-xs bg-white text-slate-900
               focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
    value={value ?? "normal"}
    onChange={(e) => onChange(e.target.value as ShiftItem["status"])}
    disabled={disabled}
  >
    <option value="normal">ー</option>
    <option value="late">遅刻</option>
    <option value="early">早退</option>
    <option value="absent">欠勤</option>
  </select>
);

/* ========================= Component ========================= */

const AdminShiftRegister: React.FC = () => {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);

  const [company, setCompany] = useState<string>("");

  const makeKey = useCallback((base: string) => `${base}_${company}_${year}_${month}`, [company, year, month]);

  // 初期は空配列：未登録案件を出さない
  const [projects, setProjects] = useState<any[]>([]);
  const projectNameSet = useMemo(() => new Set(projects.map((p: any) => String(p.name))), [projects]);
  const projectPriceMap = useMemo(
    () => Object.fromEntries(projects.map((p: any) => [p.name, Number(p.unitPrice) || 0])) as Record<string, number>,
    [projects]
  );

  const [driverList, setDriverList] = useState<DriverRow[]>([]);
  const [shifts, setShifts] = useState<ShiftsState>({});
  const [abbreviations, setAbbreviations] = useState<Record<string, string>>({});
  const [requiredPersonnel, setRequiredPersonnel] = useState<Record<string, number>>({});

  const [showAbbreviationModal, setShowAbbreviationModal] = useState(false);
  const [showRequiredModal, setShowRequiredModal] = useState(false);

  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isResultConfirmed, setIsResultConfirmed] = useState(false);

  const [loading, setLoading] = useState(true);

  const days = useMemo(() => getDaysOfMonth(year, month), [year, month]);

  /* --------- 会社解決 --------- */
  useEffect(() => {
    // ログイン仕様に合わせて複数ソースから解決
    try {
      const cur = JSON.parse(localStorage.getItem("currentUser") || "{}");
      const c1 = localStorage.getItem("company") || "";
      const c2 = cur?.company || "";
      const comp = c1 || c2 || "";
      setCompany(comp);
    } catch {
      setCompany("");
    }
  }, []);

  // 追加：localStorage で取れない時のフォールバック（本番向け）
  useEffect(() => {
    if (company) return;
    (async () => {
      try {
        const { getAuth } = await import("firebase/auth");
        const result = await getAuth().currentUser?.getIdTokenResult?.();
        const claim = (result?.claims as any)?.company;
        if (claim) {
          setCompany(String(claim));
          localStorage.setItem("company", String(claim));
          return;
        }
      } catch {}
      try {
        const me = await apiJSON<{ company?: string }>("/api/me");
        if (me?.company) {
          setCompany(String(me.company));
          localStorage.setItem("company", String(me.company));
        }
      } catch {}
    })();
  }, [company]);

  /* --------- ドライバー一覧（共有） --------- */
  useEffect(() => {
    if (!company) {
      setDriverList([]);
      return;
    }
    let canceled = false;
    const load = async () => {
      try {
        const list = await DriversAPI.list(company);
        if (!canceled) setDriverList(pickDrivers(list as any, projectNameSet));
      } catch (e: any) {
        console.warn("drivers fetch failed", e?.status || e);
        if (!canceled) setDriverList([]);
      }
    };
    load();

    const onChanged = () => load();
    window.addEventListener("drivers:changed", onChanged);
    return () => {
      canceled = true;
      window.removeEventListener("drivers:changed", onChanged);
    };
  }, [company, projectNameSet]);

  /* --------- 案件一覧（ローカル保持。必要ならAPI化を） --------- */
  useEffect(() => {
    const savedProjects = localStorage.getItem("projectList");
    if (savedProjects) {
      const parsed = JSON.parse(savedProjects);
      const fixed = (parsed as any[]).map((p: any) => ({ ...p, color: p.color || "#cccccc" }));
      setProjects(fixed);
      localStorage.setItem("projectList", JSON.stringify(fixed));
    } else {
      // 未登録なら表示ゼロ
      setProjects([]);
    }
  }, []);

  /* --------- シフト + 確定フラグ（共有） --------- */
  useEffect(() => {
    if (!company) return;
    let aborted = false;

    (async () => {
      setLoading(true);
      try {
        const res = await ShiftsAPI.get(company, year, month);
        if (aborted) return;
        setShifts(res?.shifts ?? {});
        setIsConfirmed(!!res?.confirmed);
        setIsResultConfirmed(!!res?.resultConfirmed);
      } catch (e: any) {
        // 読み取りのみローカルにフォールバック
        const key = makeKey("shifts");
        const saved = localStorage.getItem(key);
        if (saved) setShifts(JSON.parse(saved));
        setIsConfirmed(localStorage.getItem(makeKey("confirmedShift")) === "true");
        setIsResultConfirmed(localStorage.getItem(makeKey("confirmedResult")) === "true");
      } finally {
        if (!aborted) {
          setLoading(false);
          setHasLoadedInitial(true);
        }
      }
    })();

    return () => {
      aborted = true;
    };
  }, [company, year, month, makeKey]);

  /* --------- 略称（共有） --------- */
  useEffect(() => {
    if (!company) return;
    let aborted = false;
    (async () => {
      try {
        const abbr = await SettingsAPI.getAbbr(company);
        if (!aborted) setAbbreviations(abbr || {});
      } catch {
        // 読み取りのみローカルにフォールバック
        const saved = localStorage.getItem("projectAbbreviations");
        if (!aborted && saved) setAbbreviations(JSON.parse(saved));
      }
    })();
    return () => {
      aborted = true;
    };
  }, [company]);

  /* --------- 必要人数（共有） --------- */
  useEffect(() => {
    if (!company) return;
    let aborted = false;
    (async () => {
      try {
        const req = await SettingsAPI.getRequired(company, year, month);
        if (!aborted) setRequiredPersonnel(req || {});
      } catch {
        const saved = localStorage.getItem(makeKey("requiredPersonnel"));
        if (!aborted && saved) setRequiredPersonnel(JSON.parse(saved));
      }
    })();
    return () => {
      aborted = true;
    };
  }, [company, year, month, makeKey]);

  /* --------- ローカルキャッシュ（読み取り失敗時の復旧用） --------- */
  useEffect(() => {
    if (!hasLoadedInitial || !company) return;
    try {
      localStorage.setItem(makeKey("shifts"), JSON.stringify(shifts));
    } catch (e) {
      console.error("自動保存失敗", e);
    }
  }, [shifts, company, year, month, hasLoadedInitial, makeKey]);

  /* --------- 計算系 --------- */
  const getAssignedCount = (dateStr: string, projectName: string) =>
    driverList.reduce((count, drv) => {
      const list: ShiftItem[] = Array.isArray(shifts[drv.id]?.[dateStr])
        ? (shifts[drv.id][dateStr] as ShiftItem[])
        : shifts[drv.id]?.[dateStr]
        ? [shifts[drv.id][dateStr] as ShiftItem]
        : [];
      return count + list.filter((it: ShiftItem) => it.project === projectName).length;
    }, 0);

  const calculateTotalMinutes = (driverId: string) =>
    days.reduce((total, d) => {
      const list: ShiftItem[] = Array.isArray(shifts[driverId]?.[d.dateStr])
        ? (shifts[driverId][d.dateStr] as ShiftItem[])
        : shifts[driverId]?.[d.dateStr]
        ? [shifts[driverId][d.dateStr] as ShiftItem]
        : [];

      const dayMinutes = list.reduce<number>((sub, it: ShiftItem) => {
        if (it.status === "absent") return sub;
        const p = projects.find((pr: any) => pr.name === it.project);
        if (!p || !p.startTime || !p.endTime) return sub;

        const [sh, sm] = p.startTime.split(":").map(Number);
        const [eh, em] = p.endTime.split(":").map(Number);
        return sub + Math.max(eh * 60 + em - (sh * 60 + sm), 0);
      }, 0);

      return total + dayMinutes;
    }, 0);

  // ▼ アクティブ案件（この月に必要人数がある or 実際に割当がある案件）
  const isProjectActive = (p: any) =>
    days.some((d) => {
      const key = `${p.name}_${d.dateStr}`;
      const required = requiredPersonnel[key] || 0;
      if (required > 0) return true;
      const assigned = getAssignedCount(d.dateStr, p.name);
      return assigned > 0;
    });

  const activeProjects = useMemo(
    () => projects.filter(isProjectActive),
    [projects, days, requiredPersonnel, driverList, shifts]
  );

  /* --------- 編集系（即サーバ保存 / 失敗時ローカルキャッシュ） --------- */
  function handleChange(
    driverId: string,
    dateStr: string,
    projectName: string | null,
    removeIndex?: number
  ) {
    setShifts((prev) => {
      const oldList: ShiftItem[] = Array.isArray(prev?.[driverId]?.[dateStr])
        ? [...(prev[driverId][dateStr] as ShiftItem[])]
        : prev?.[driverId]?.[dateStr]
        ? [prev[driverId][dateStr] as ShiftItem]
        : [];

      const newList = projectName
        ? [...oldList, { project: projectName, unitPrice: projectPriceMap[projectName] ?? 0 }]
        : removeIndex != null
        ? oldList.filter((_, idx) => idx !== removeIndex)
        : oldList.slice(0, -1);

      const updated: ShiftsState = { ...prev, [driverId]: { ...prev[driverId], [dateStr]: newList } };

      // 楽観反映 → サーバ保存
      (async () => {
        try {
          await ShiftsAPI.put({ company, year, month, shifts: updated });
        } catch (e: any) {
          console.warn("shifts save failed; kept local cache", e?.status || e);
          localStorage.setItem(makeKey("shifts"), JSON.stringify(updated));
        }
      })();

      return updated;
    });
  }

  /* --------- セル（確定後のステータス入力・表示） --------- */
  const ShiftCell: React.FC<{ driverId: string; dateStr: string }> = ({ driverId, dateStr }) => {
    const items: ShiftItem[] = Array.isArray(shifts[driverId]?.[dateStr])
      ? (shifts[driverId][dateStr] as ShiftItem[])
      : shifts[driverId]?.[dateStr]
      ? [shifts[driverId][dateStr] as ShiftItem]
      : [];

    const [adding, setAdding] = useState(false);

    // 確定後は削除不可・ステータス入力のみ（実績確定後は表示のみ）
    if (isConfirmed) {
      return (
        <div className="flex flex-col gap-0.5">
          {items.map((it, idx) => {
            const p = projects.find((pr: any) => pr.name === it.project);
            if (!p) return null;

            const badgeBg = it.status === "absent" ? "#9ca3af" : p.color;
            const badgeTxt = abbreviations[p.name] || p.name;

            return (
              <div key={idx} className="flex items-center">
                <div className="badge-cell rounded-md" style={{ backgroundColor: badgeBg, color: p.textColor }}>
                  {badgeTxt}
                </div>

                {!isResultConfirmed ? (
                  <StatusSelect
                    value={it.status}
                    disabled={false}
                    onChange={(v: ShiftItem["status"]) => {
                      setShifts((prev) => {
                        const list = [...items];
                        list[idx] = { ...list[idx], status: v };
                        const updated: ShiftsState = {
                          ...prev,
                          [driverId]: { ...prev[driverId], [dateStr]: list },
                        };
                        (async () => {
                          try {
                            await ShiftsAPI.put({ company, year, month, shifts: updated });
                          } catch (e: any) {
                            localStorage.setItem(makeKey("shifts"), JSON.stringify(updated));
                          }
                        })();
                        return updated;
                      });
                    }}
                  />
                ) : (
                  <span className="badge-cell-status-big bg-gray-300" title={it.status}>
                    {{
                      late: "遅",
                      early: "早",
                      absent: "欠",
                      normal: "",
                    }[it.status ?? "normal"]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    // 確定前：バッジ削除 / 追加可
    return (
      <div className="flex flex-col gap-0.5">
        {items.map((it, i) => {
          const p = projects.find((pr: any) => pr.name === it.project);
          if (!p) return null;
          return (
            <div
              key={i}
              className="h-6 w-24 rounded-md text-xs font-bold flex justify-center items-center cursor-pointer"
              style={{ backgroundColor: p.color, color: p.textColor }}
              title="クリックで削除"
              onClick={() => handleChange(driverId, dateStr, null, i)}
            >
              {abbreviations[p.name] || p.name}
            </div>
          );
        })}

        {adding ? (
          <select
            autoFocus
            onBlur={() => setAdding(false)}
            className="border text-xs rounded-md py-0.5 w-24"
            onChange={(e) => {
              if (e.target.value) handleChange(driverId, dateStr, e.target.value);
              setAdding(false);
            }}
          >
            <option value="">案件選択</option>
            {projects.map((p: any) => (
              <option key={p.id ?? p.name} value={p.name}>
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

  /* --------- 保存系 --------- */

  const handleSaveAbbreviations = async () => {
    try {
      // 略称をサーバへ
      await SettingsAPI.putAbbr(company, abbreviations);

      // （任意）色/文字色もサーバへ — エンドポイントが無ければ無視
      const styles = projects.map((p: any) => ({
        name: p.name,
        color: p.color || "#cccccc",
        textColor: p.textColor || "#000000",
      }));
      try {
        await SettingsAPI.putProjectStyles(company, styles);
      } catch {
        // API未実装や404の場合は何もしない（localStorageには保存しておく）
      }

      // ローカルキャッシュ（任意）
      localStorage.setItem("projectAbbreviations", JSON.stringify(abbreviations));
      localStorage.setItem("projectList", JSON.stringify(projects));

      setShowAbbreviationModal(false);
    } catch {
      alert("略称の保存に失敗しました。ネットワークをご確認ください。");
    }
  };

  const handleConfirmShift = async () => {
    try {
      await ShiftsAPI.setConfirmed(company, year, month, true);
      setIsConfirmed(true);
    } catch {
      // 暫定：ローカル保持
      localStorage.setItem(makeKey("confirmedShift"), "true");
      setIsConfirmed(true);
    }

    // === ドライバーごとの発注書PDFを生成してダウンロード（動的 import） ===
    const [{ default: jsPDF }] = await Promise.all([import("jspdf")]);
    const { default: autoTable } = await import("jspdf-autotable");

    const pdfMonth = `${year}-${String(month).padStart(2, "0")}`;

    for (const drv of driverList as any[]) {
      // 当月シフトだけ抽出
      const drvShifts: ShiftItem[] = Object.values(shifts?.[drv.id] || {}).reduce<ShiftItem[]>((acc, v) => {
        if (!v) return acc;
        return acc.concat(Array.isArray(v) ? v : [v]);
      }, []);
      if (drvShifts.length === 0) continue;

      const total = drvShifts.reduce((sum, s) => sum + (s?.unitPrice ?? 0), 0);

      const doc = new jsPDF();

      // ヘッダ
      doc.setFontSize(14);
      doc.text("発注書", 105, 20, { align: "center" });

      doc.setFontSize(11);
      doc.text(`対象月：${pdfMonth}`, 20, 34);
      doc.text(`氏名　：${drv.name}`, 20, 42);
      doc.text(`住所　：${drv.address ?? "未登録"}`, 20, 50);
      doc.text(`電話　：${drv.phone ?? "未登録"}`, 20, 58);

      // 明細
      (autoTable as any)(doc, {
        head: [["案件名", "単価(円/日)"]],
        body: drvShifts.map((s) => [s.project, s.unitPrice.toLocaleString()]),
        startY: 70,
        styles: { fontSize: 10 },
      });
      const finalY = (doc as any).lastAutoTable?.finalY ?? 70;
      doc.text(`合計金額：${total.toLocaleString()} 円（税込）`, 20, finalY + 10);

      const fileName = `PO_${year}${String(month).padStart(2, "0")}_${drv.id}.pdf`;
      doc.save(fileName);
    }
  };

  const handleUnconfirmShift = async () => {
    if (!window.confirm("本当に未確定に戻しますか？再度編集が可能になります。")) return;
    try {
      await ShiftsAPI.setConfirmed(company, year, month, false);
      await ShiftsAPI.setResultConfirmed(company, year, month, false);
    } catch {
      localStorage.removeItem(makeKey("confirmedShift"));
      localStorage.removeItem(makeKey("confirmedResult"));
    }
    setIsConfirmed(false);
    setIsResultConfirmed(false);
  };

  const handleExportPDF = async () => {
    const table = document.querySelector("table") as HTMLTableElement | null;
    if (!table) return;

    // 1. サイズCSSを当てる
    table.classList.add("pdf-export");

    // 2. 高解像度キャプチャ（動的 import）
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
    const canvas = await html2canvas(table, {
      scale: 3,
      scrollX: 0,
      scrollY: 0,
      windowWidth: table.scrollWidth,
      windowHeight: table.scrollHeight,
    });
    table.classList.remove("pdf-export");

    // 3. 自動ページ分割してPDFへ
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const ratio = canvas.height / canvas.width;
    const imgH = pageW * ratio;

    if (imgH <= pageH) {
      pdf.addImage(imgData, "PNG", 0, 0, pageW, imgH);
    } else {
      let offsetY = 0;
      const sliceH = canvas.width * (pageH / pageW);

      while (offsetY < canvas.height) {
        const partH = Math.min(sliceH, canvas.height - offsetY);
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = partH;
        slice.getContext("2d")!.drawImage(canvas, 0, offsetY, canvas.width, partH, 0, 0, canvas.width, partH);

        pdf.addImage(slice.toDataURL("image/png"), "PNG", 0, 0, pageW, pageH);

        offsetY += partH;
        if (offsetY < canvas.height) pdf.addPage();
      }
    }

    pdf.save(`${year}年${month}月_シフト表.pdf`);
  };

  /* --------- 実績確定（PS出力） --------- */
  const handleConfirmResult = async () => {
    if (!window.confirm("実績を確定しますか？ 確定後は編集できません。")) return;

    try {
      await ShiftsAPI.setResultConfirmed(company, year, month, true);
      setIsResultConfirmed(true);
      localStorage.setItem(makeKey("confirmedResult"), "true"); // 任意キャッシュ

      // ここで PS を作成（動的 import）
      const { createPS } = await import("../utils/pdfUtils");
      for (const drv of driverList) {
        const hours = calculateTotalMinutes(drv.id) / 60;
        const dataUrl = await createPS(drv.name, year, month, hours);
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `PS_${year}${String(month).padStart(2, "0")}_${drv.id}.pdf`;
        a.click();
      }
    } catch {
      alert("実績確定に失敗しました。ネットワークをご確認ください。");
    }
  };

  /* --------- 画面 --------- */

  const years = [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1];
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  if (loading) return <div className="p-6">読み込み中...</div>;

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4 flex items-center">
        <span role="img" aria-label="shift" className="text-blue-600 text-3xl mr-2">
          📅
        </span>
        シフト登録<span className="ml-2 text-sm text-gray-500">-Shift Register-</span>
      </h2>

      <div className="flex items-center mb-4 gap-2">
        <select
  value={year}
  onChange={(e) => setYear(+e.target.value)}
  className="border px-2 py-1 rounded bg-white text-black"
>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}年
            </option>
          ))}
        </select>
        <select
  value={month}
  onChange={(e) => setMonth(+e.target.value)}
  className="border px-2 py-1 rounded bg-white text-black"
>
          {months.map((m) => (
            <option key={m} value={m}>
              {m}月
            </option>
          ))}
        </select>

        <button
          onClick={() => setShowAbbreviationModal(true)}
          className="ml-2 px-3 py-1 bg-gray-600 text-white rounded hover:bg-blue-200 transition"
        >
          案件カスタム設定
        </button>

        <button
          className="ml-4 px-3 py-1 bg-blue-600 text-white rounded hover:bg-green-700"
          onClick={() => setShowRequiredModal(true)}
        >
          案件別人員設定
        </button>

        <button
          className="ml-2 px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
          onClick={() => {
            // 任意の一時保存（サーバには既に逐次保存している）
            localStorage.setItem(makeKey("shifts"), JSON.stringify(shifts));
            alert("一時保存しました");
          }}
        >
          一時保存
        </button>

        {!isConfirmed ? (
          <button onClick={handleConfirmShift} className="ml-2 px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600">
            シフト確定
          </button>
        ) : (
          <div className="ml-4 flex items-center gap-2">
            <span className="text-green-700 font-semibold">✅ シフトは確定済みです</span>

            {!isResultConfirmed ? (
              <button onClick={handleConfirmResult} className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                実績確定
              </button>
            ) : (
              <span className="text-indigo-700 font-semibold">✅ 実績確定済み</span>
            )}

            <button onClick={handleExportPDF} className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">
              PDF出力
            </button>
            <button onClick={handleUnconfirmShift} className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600">
              未確定に戻す
            </button>
          </div>
        )}
      </div>

      {/* 案件の略称設定モーダル */}
      {showAbbreviationModal && (
        <div className="border p-4 bg-white shadow-lg rounded mb-4">
          <h3 className="font-bold mb-2">案件の略称設定</h3>

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
                  <tr key={p.id ?? p.name}>
                    <td className="border px-2 py-1 whitespace-nowrap">{p.name}</td>
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
                    <td className="border px-2 py-1 text-center">
                      <input
                        type="color"
                        value={p.color || "#cccccc"}
                        onChange={(e) => {
                          const updated = projects.map((prj: any) =>
                            prj.name === p.name ? { ...prj, color: e.target.value } : prj
                          );
                          setProjects(updated);
                          localStorage.setItem("projectList", JSON.stringify(updated));
                        }}
                        title="セル背景色"
                      />
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <select
                        value={p.textColor || "#000000"}
                        onChange={(e) => {
                          const updated = projects.map((prj: any) =>
                            prj.name === p.name ? { ...prj, textColor: e.target.value } : prj
                          );
                          setProjects(updated);
                          localStorage.setItem("projectList", JSON.stringify(updated));
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

          <button className="mt-2 px-4 py-1 bg-blue-500 text-white rounded" onClick={handleSaveAbbreviations}>
            保存
          </button>
        </div>
      )}

      {/* 案件別必要人数設定モーダル */}
      {showRequiredModal && (
        <div className="border p-4 bg-white shadow-lg rounded mb-4">
          <h3 className="font-bold mb-2">案件ごとの必要人数設定（日付別）</h3>

          {projects.map((project: any) => (
            <div key={project.id ?? project.name} className="mb-4">
              <div className="flex items-center mb-2 gap-2">
                <strong className="w-32">{project.name}</strong>
                <input
                  type="number"
                  min={0}
                  placeholder="この月の全日に反映"
                  className="border px-2 py-1 w-32"
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10) || 0;
                    const newRequired = { ...requiredPersonnel };
                    days.forEach((d) => {
                      const key = `${project.name}_${d.dateStr}`;
                      newRequired[key] = value;
                    });
                    setRequiredPersonnel(newRequired);
                  }}
                />
                <span className="text-sm text-gray-500">※上記は一括入力欄</span>
              </div>

              <div className="grid grid-cols-5 gap-2 text-sm">
                {days.map((d) => {
                  const key = `${project.name}_${d.dateStr}`;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="w-20">{d.dateStr.split("-")[2]}日</span>
                      <input
                        type="number"
                        min={0}
                        value={requiredPersonnel[key] || ""}
                        className="border px-2 py-1 w-16"
                        onChange={(e) =>
                          setRequiredPersonnel((prev) => ({
                            ...prev,
                            [key]: parseInt(e.target.value, 10) || 0,
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
            onClick={async () => {
              try {
                await SettingsAPI.putRequired(company, year, month, requiredPersonnel);
                localStorage.setItem(makeKey("requiredPersonnel"), JSON.stringify(requiredPersonnel)); // 任意キャッシュ
                setShowRequiredModal(false);
              } catch {
                alert("必要人数の保存に失敗しました。");
              }
            }}
          >
            保存
          </button>
        </div>
      )}

      {/* シフト表 */}
      <table className="w-full border border-collapse shadow text-sm">
        <thead>
          {/* 日付 + 曜日行 */}
          <tr className="bg-blue-100 text-gray-800 sticky top-0 z-30">
            <th className="border px-1 py-1">氏名</th>
            {days.map((d) => (
              <th
                key={d.dateStr}
                className={`border px-1 py-1 text-center ${
                  d.day === 0 ? "bg-red-100" : d.day === 6 ? "bg-blue-50" : "bg-white"
                }`}
              >
                {d.dateStr.split("-")[2]}
                <br />
                {["日", "月", "火", "水", "木", "金", "土"][d.day]}
              </th>
            ))}
            <th className="sticky top-0 z-10 bg-blue-100 border px-1 py-1">合計時間</th>
          </tr>
        </thead>

        <tbody>
          {/* ▼ 案件（過不足）ブロック：アクティブ案件のみある時だけ表示 */}
          {activeProjects.length > 0 && (
            <>
              <tr className="bg-amber-50 text-amber-900 text-xs">
                <td className="border px-2 py-1 font-semibold">案件（過不足）</td>
                {days.map((d) => (
                  <td key={`lbl-${d.dateStr}`} className="border px-1 py-1 text-center">
                    差分
                  </td>
                ))}
                <td className="border px-1 py-1">-</td>
              </tr>

              {activeProjects.map((p: any) => (
                <tr key={`shortage-${p.name}`} className="bg-yellow-50 text-xs text-center sticky top-[48px] z-20">
                  <td className="border px-1 py-1 font-semibold text-gray-700 whitespace-nowrap">
                    {abbreviations[p.name] || p.name}
                  </td>
                  {days.map((d) => {
                    const key = `${p.name}_${d.dateStr}`;
                    const required = requiredPersonnel[key] || 0;
                    const assigned = getAssignedCount(d.dateStr, p.name);
                    const diff = assigned - required;
                    const color = diff === 0 ? "text-black" : diff > 0 ? "text-blue-600" : "text-red-600";
                    return (
                      <td key={`${key}-short`} className={`border px-1 py-1 text-xs ${color}`}>
                        {diff === 0 ? "0" : diff > 0 ? `+${diff}` : `${diff}`}
                      </td>
                    );
                  })}
                  <th className="sticky top-[42px] z-10 bg-yellow-50 border px-1 py-1">-</th>
                </tr>
              ))}

              {/* ▼ 区切り：ここから氏名ブロック */}
              <tr className="bg-slate-100 text-slate-700">
                <td className="border px-2 py-1 font-semibold">氏名</td>
                {days.map((d) => (
                  <td key={`sep-${d.dateStr}`} className="border px-1 py-1" />
                ))}
                <td className="border px-1 py-1 font-semibold">合計時間</td>
              </tr>
            </>
          )}

          {/* ▼ ドライバー行 */}
          {driverList.length === 0 ? (
            <tr>
              <td className="border px-2 py-4 text-center text-gray-600" colSpan={days.length + 2}>
                現在この会社のドライバーは登録されていません。ドライバー管理から追加してください。
              </td>
            </tr>
          ) : (
            driverList.map((driver, i) => (
              <tr key={driver.id} className={i % 2 === 0 ? "bg-white" : "bg-purple-100"}>
                <td className="border px-1 py-1 text-center whitespace-nowrap">{driver.name}</td>
                {days.map((d) => (
                  <td key={d.dateStr} className="border px-1 py-1">
                    <div className="flex items-center gap-1">
                      <ShiftCell driverId={driver.id} dateStr={d.dateStr} />
                    </div>
                  </td>
                ))}
                <td className="border px-1 py-1 text-right">{(calculateTotalMinutes(driver.id) / 60).toFixed(1)}h</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default AdminShiftRegister;
