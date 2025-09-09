// src/components/ComplianceNewsWidget.tsx
import { useEffect, useState } from "react";
import { fetchComplianceNews, type NewsItem } from "../utils/news";

export default function ComplianceNewsWidget() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const list = await fetchComplianceNews({ filter: true, limit: 20 });
        setItems(list);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="p-4 border rounded">
      <div className="mb-3 flex gap-2">
        <input
          className="border rounded px-2 py-1 flex-1"
          placeholder="キーワード（例：アルコール, 改善基準）"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          className="px-3 py-1 rounded bg-blue-600 text-white"
          onClick={async () => {
            setLoading(true);
            try {
              const list = await fetchComplianceNews({
                q,
                filter: true,
                limit: 20,
              });
              setItems(list);
            } finally {
              setLoading(false);
            }
          }}
        >
          検索
        </button>
      </div>

      {loading ? (
        <div>読込中…</div>
      ) : items.length === 0 ? (
        <div className="text-gray-500">該当なし</div>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.link}>
              <a
                href={n.link}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline"
              >
                {n.title}
              </a>
              <div className="text-xs text-gray-500">
                {n.source}・{new Date(n.isoDate).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
