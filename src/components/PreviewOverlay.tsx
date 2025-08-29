import React, { useEffect } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  src: string;          // PDF/DataURL/Blob URL など
  title?: string;
  onClose: () => void;
};

const PreviewOverlay: React.FC<Props> = ({ open, src, title, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";     // 背景スクロール抑止
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      {/* 背景 */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      {/* ビューア本体 */}
      <div className="absolute inset-4 md:inset-8 bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 h-12 border-b bg-white/90">
          <div className="font-semibold truncate">{title ?? "プレビュー"}</div>
          <div className="flex items-center gap-2">
            <a href={src} target="_blank" rel="noreferrer" className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-sm">
              新しいタブで開く
            </a>
            <button onClick={onClose} className="px-3 py-1 rounded bg-gray-800 text-white hover:bg-black text-sm">
              閉じる（Esc）
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          {/* PDF は iframe/object どちらでもOK。iframeの方がシンプル */}
          <iframe
            title="preview"
            src={src}
            className="w-full h-full"
            style={{ border: "none" }}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PreviewOverlay;
