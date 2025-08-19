import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { MapContainer, TileLayer, Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { FaCog } from "react-icons/fa";

/* ========= APIから返る想定の型 ========= */
type DriverLocation = {
  driverId: string;
  name: string;
  company: string;
  lat: number;
  lng: number;
  updatedAt: string; // ISO
  status?: "working" | "break" | "off";
};

/* ========= 画面内部で使う型（既存を流用） ========= */
interface Driver {
  id: string;
  name: string;
  position: [number, number];
  color: string;
  gpsEnabled: boolean;
  address: string; // ← ツールチップ用（ここに「最終更新」などを入れる）
}

/* ========= 初期ダミー（API失敗時のフォールバックに残す） ========= */
const initialDrivers: Driver[] = [
  {
    id: "1",
    name: "佐藤太郎",
    position: [35.6895, 139.6917],
    color: "#ffffff",
    gpsEnabled: true,
    address: "所在地未登録",
  },
  {
    id: "2",
    name: "鈴木花子",
    position: [34.6937, 135.5023],
    color: "#ffffff",
    gpsEnabled: true,
    address: "所在地未登録",
  },
];

const colorOptions = [
  "#ffffff",
  "#f8d7da",
  "#d1ecf1",
  "#d4edda",
  "#fff3cd",
  "#f0f0f0",
  "#e2e3e5",
  "#cfe2ff",
  "#f5c6cb",
  "#c3e6cb",
];

const LiveMap = () => {
  /* ===== ログイン情報 ===== */
  const loginId = localStorage.getItem("loginId") || ""; // ★自分のID
  // 会社・権限を使う予定があれば以下を使って下さい
  const company = localStorage.getItem("company") || "";
  const role = (localStorage.getItem("role") || "driver") as "driver" | "admin" | "master";

  /* ===== 状態 ===== */
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers);
  const [tempColors, setTempColors] = useState<{ [key: string]: string }>({});
  const [search, setSearch] = useState("");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [hoveredDriverId, setHoveredDriverId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const [isLoading, setIsLoading] = useState(false);      // ★追加：手動更新の状態
  const [lastUpdated, setLastUpdated] = useState<string>(""); // ★追加：最終更新表示

  /* ====== APIから位置情報を取得（5分ごと＋手動） ====== */
  const fetchDriverLocations = async () => {
    setIsLoading(true);
    try {
      const auth = getAuth();
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        alert("未ログインです");
        setIsLoading(false);
        return;
      }

      // 会社で絞る場合はクエリに company を付与（サーバ側の実装に合わせて）
      const res = await fetch(`/api/driver-locations?company=${encodeURIComponent(company)}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: DriverLocation[] = await res.json();

      // APIのスキーマを画面用にマッピング
      const mapped: Driver[] = data.map((loc) => ({
        id: loc.driverId,
        name: loc.name,
        position: [loc.lat, loc.lng],
        color: "#ffffff",
        gpsEnabled: true,
        // 「住所」欄には最終更新を表示（APIに住所があれば差し替えてOK）
        address: `最終更新: ${new Date(loc.updatedAt).toLocaleString()}`,
      }));

      setDrivers(mapped);
      setLastUpdated(new Date().toLocaleString());
    } catch (e) {
      console.error("位置情報の取得に失敗しました。ローカル保存にフォールバックします。", e);
      // ★フォールバック（既存ローカルデータ）
      const savedDrivers = localStorage.getItem("driverList");
      if (savedDrivers) {
        try {
          const parsed = JSON.parse(savedDrivers);
          const workingDrivers: Driver[] = parsed
            .filter((d: any) => d.isWorking)
            .map((d: any, index: number) => ({
              id: d.id || `driver${index}`,
              name: d.name,
              position: d.position || [35.6895, 139.6917], // 仮位置
              color: "#ffffff",
              gpsEnabled: true,
              address: d.address || "所在地未登録",
            }));
          setDrivers(workingDrivers.length ? workingDrivers : initialDrivers);
        } catch {
          setDrivers(initialDrivers);
        }
      } else {
        setDrivers(initialDrivers);
      }
    } finally {
      setIsLoading(false);
    }
  };

  /* 初回＋5分ごとに自動更新 */
  useEffect(() => {
    fetchDriverLocations();
    const t = setInterval(fetchDriverLocations, 300000); // 300,000ms = 5分
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 検索で赤ピン／解除で青ピン（部分一致・大文字小文字無視） */
  useEffect(() => {
    const text = search.trim().toLowerCase();
    if (text) {
      const match = drivers.find((d) => d.name.toLowerCase().includes(text));
      setHighlightedId(match?.id || null);
    } else {
      setHighlightedId(null); // ← 検索が空なら青に戻す
    }
  }, [search, drivers]);

  /* 色設定（既存機能そのまま） */
  const handleColorChange = (id: string, color: string) => {
    setTempColors((prev) => ({ ...prev, [id]: color }));
  };
  const handleSaveColors = () => {
    setDrivers((prev) =>
      prev.map((d) => (tempColors[d.id] ? { ...d, color: tempColors[d.id] } : d))
    );
    setTempColors({});
    setShowSettings(false);
  };

  /* 表示対象：
     本番仕様の指示どおり「ログインしているドライバーのみ」を表示 */
  const visibleDrivers = drivers.filter(
    (d) => d.gpsEnabled && d.id === loginId
  );

  return (
    <div className="p-4 relative w-full">
      <h2 className="text-2xl font-bold flex items-center mb-4">
        <span role="img" aria-label="map" className="text-blue-600 text-3xl mr-2">🗺️</span>
        ドライバー位置情報マップ <span className="ml-2 text-gray-500 text-base">-Driver Map-</span>
      </h2>

      {/* 検索＋手動更新＋最終更新表示＋設定 */}
      <div className="flex flex-wrap items-center mb-2 space-x-4 z-20 relative">
        <input
          type="text"
          placeholder="ドライバー名で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border px-3 py-1 rounded shadow"
        />
        {search && (
          <button
            className="px-3 py-1 border rounded hover:bg-gray-50"
            onClick={() => setSearch("")}
            title="検索クリア"
          >
            クリア
          </button>
        )}
        <button
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={fetchDriverLocations}
          disabled={isLoading}
        >
          {isLoading ? "更新中..." : "手動更新"}
        </button>
        <span className="text-sm text-gray-600">最終更新: {lastUpdated || "-"}</span>

        <button
          className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center"
          onClick={() => setShowSettings(!showSettings)}
        >
          <FaCog className="mr-1" /> 設定
        </button>
      </div>

      {/* 設定パネル（既存の色設定そのまま） */}
      {showSettings && (
        <div className="absolute left-4 top-40 bg-white border p-4 rounded shadow-lg z-30 w-96">
          <h3 className="font-bold mb-2">色の設定</h3>
          {drivers.map((driver) => (
            <div key={driver.id} className="flex items-center mb-2">
              <span className="w-24">{driver.name}</span>
              <div className="flex flex-wrap gap-1">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    className="w-5 h-5 rounded border border-gray-400"
                    style={{ backgroundColor: color }}
                    onClick={() => handleColorChange(driver.id, color)}
                  />
                ))}
              </div>
            </div>
          ))}
          <button
            className="mt-4 px-4 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={handleSaveColors}
          >
            保存
          </button>
        </div>
      )}

      {/* 地図 */}
      <div className="w-full mt-4" style={{ height: "calc(100vh - 260px)", minHeight: "500px" }}>
        <MapContainer center={[35.6895, 139.6917]} zoom={6} className="h-full w-full z-10">
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {visibleDrivers.map((driver) => (
            <Marker
              key={driver.id}
              position={driver.position}
              icon={L.icon({
                iconUrl:
                  driver.id === highlightedId
                    ? "https://maps.gstatic.com/mapfiles/ms2/micons/red-dot.png"  // 検索ヒット時は赤
                    : "https://maps.gstatic.com/mapfiles/ms2/micons/blue-dot.png", // 通常は青
                iconSize: [32, 32],
                iconAnchor: [16, 32],
              })}
              eventHandlers={{
                mouseover: () => setHoveredDriverId(driver.id),
                mouseout: () => setHoveredDriverId(null),
              }}
            >
              <Tooltip permanent direction="top" offset={[0, -20]}>
                <div
                  style={{
                    backgroundColor: driver.color,
                    padding: "4px 6px",
                    borderRadius: "4px",
                    border: "1px solid #000",
                    whiteSpace: "nowrap",
                    fontSize: "12px",
                  }}
                >
                  {hoveredDriverId === driver.id && (
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#555",
                        marginBottom: "2px",
                      }}
                    >
                      {driver.address}
                    </div>
                  )}
                  <div style={{ fontWeight: "bold" }}>{driver.name}</div>
                </div>
              </Tooltip>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default LiveMap;
