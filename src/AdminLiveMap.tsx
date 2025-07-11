import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { FaCog } from "react-icons/fa";

interface Driver {
  id: string;
  name: string;
  position: [number, number];
  color: string;
  gpsEnabled: boolean;
  address: string;
}

const initialDrivers: Driver[] = [
  {
    id: "1",
    name: "佐藤太郎",
    position: [35.6895, 139.6917],
    color: "#ffffff",
    gpsEnabled: true,
    address: "東京都新宿区西新宿1-1-1",
  },
  {
    id: "2",
    name: "鈴木花子",
    position: [34.6937, 135.5023],
    color: "#ffffff",
    gpsEnabled: true,
    address: "大阪府大阪市中央区難波1-2-3",
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
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers);
  const [tempColors, setTempColors] = useState<{ [key: string]: string }>({});
  const [search, setSearch] = useState("");
  const [highlightedId, setHighlightedId] = useState
<string | null>(null);
  const [hoveredDriverId, setHoveredDriverId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

 useEffect(() => {
  if (search) {
    const match = drivers.find((d) => d.name.includes(search));
    setHighlightedId(match?.id || null);
  } else {
    setHighlightedId(null); // ← 検索が空になったらピンを青に戻す
  }
}, [search, drivers]);
useEffect(() => {
  const savedDrivers = localStorage.getItem("driverList");
  if (savedDrivers) {
    try {
      const parsed = JSON.parse(savedDrivers);
      const workingDrivers = parsed
        .filter((d: any) => d.isWorking)
        .map((d: any, index: number) => ({
          id: d.id || `driver${index}`,
          name: d.name,
          position: d.position || [35.6895, 139.6917], // 仮位置
          color: "#ffffff",
          gpsEnabled: true,
          address: d.address || "所在地未登録",
        }));
      setDrivers(workingDrivers);
    } catch (e) {
      console.error("driverList 読み込み失敗", e);
    }
  }
}, []);

  const handleColorChange = (id: string, color: string) => {
    setTempColors((prev) => ({ ...prev, [id]: color }));
  };

  const handleSaveColors = () => {
    setDrivers((prev) =>
      prev.map((d) =>
        tempColors[d.id] ? { ...d, color: tempColors[d.id] } : d
      )
    );
    setTempColors({});
    setShowSettings(false);
  };

  const filteredDrivers = drivers.filter((d) => d.gpsEnabled);

  return (
    <div className="p-4 relative w-full">
      <h2 className="text-2xl font-bold flex items-center mb-4">
        <span role="img" aria-label="map" className="text-blue-600 text-3xl mr-2">🗺️</span>
        ドライバー位置情報マップ <span className="ml-2 text-gray-500 text-base">-Driver Map-</span>
      </h2>

      <div className="flex flex-wrap items-center mb-2 space-x-4 z-20 relative">
        <input
          type="text"
          placeholder="ドライバー名で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border px-3 py-1 rounded shadow"
        />
        <button
          className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center"
          onClick={() => setShowSettings(!showSettings)}
        >
          <FaCog className="mr-1" /> 設定
        </button>
      </div>

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

      <div className="w-full mt-4" style={{ height: "calc(100vh - 260px)", minHeight: "500px" }}>
        <MapContainer center={[35.6895, 139.6917]} zoom={6} className="h-full w-full z-10">
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {filteredDrivers.map((driver) => (
            <Marker
              key={driver.id}
              position={driver.position}
              icon={L.icon({
                iconUrl:
                  driver.id === highlightedId
                    ? "https://maps.gstatic.com/mapfiles/ms2/micons/red-dot.png"
                    : "https://maps.gstatic.com/mapfiles/ms2/micons/blue-dot.png",
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
