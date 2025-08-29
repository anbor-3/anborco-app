import { useState } from "react";
import Select, { MultiValue } from "react-select"; // ← 型も一緒にimport

export type Customer = {
  id: string;
  uid: string;   // 自動発番 ID
  upw: string;   // 自動発番 PW
  //--------------------------------------------------------------------
  company: string;
  address: string;
  representative: string;
  plan: string; // 旧: 1つだけのプラン（保持しておく）
  startDate: string;
  endDate: string;
  //--------------------------------------------------------------------
  contactPerson: string;
  contactPhone: string;
  email: string;
  //--------------------------------------------------------------------
  corporateNo: string;
  invoiceNo: string;
  paymentSite: string;
  paymentMethod: string;
  //--------------------------------------------------------------------
  note?: string;           // 契約書 PDF URL 等
  selectedPlans: string[]; // ✅ 複数プランを保持
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rec: Omit<Customer, "id" | "uid" | "upw">) => void;
  pricingPlans: { id: string; name: string }[]; // ✅ 料金プランデータ
};

// ← 追加: react-select の option 用に型を定義
type Option = { value: string; label: string };

export default function NewCustomerModal({ isOpen, onClose, onSave, pricingPlans }: Props) {
  // ✅ selectedPlansを配列で保持
  const [form, setForm] = useState<Omit<Customer, "id" | "uid" | "upw">>({
    company: "", address: "", representative: "",
    plan: "", startDate: "", endDate: "",
    contactPerson: "", contactPhone: "", email: "",
    corporateNo: "", invoiceNo: "", paymentSite: "",
    paymentMethod: "", note: "", selectedPlans: [] // ✅ 初期値を配列に
  });

  if (!isOpen) return null;

  // react-select に渡す options（毎回 map してOK、気になるなら useMemo でも可）
  const planOptions: Option[] = pricingPlans.map((p) => ({ value: p.id, label: p.name }));
  const selectedOptions: Option[] = form.selectedPlans.map((id) => ({
    value: id,
    label: pricingPlans.find((p) => p.id === id)?.name || id,
  }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-3xl rounded shadow p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-xl font-bold mb-4">新規顧客登録</h2>

        {/* ------ 入力フォーム ------ */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          {/* 会社・基本 */}
          <label className="space-y-1 col-span-2">
            <span className="font-semibold">会社名</span>
            <input
              className="border p-1 w-full"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />
          </label>
          <label className="space-y-1 col-span-2">
            <span className="font-semibold">本社住所</span>
            <input
              className="border p-1 w-full"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </label>
          <label className="space-y-1">
            <span className="font-semibold">代表者名</span>
            <input
              className="border p-1 w-full"
              value={form.representative}
              onChange={(e) => setForm({ ...form, representative: e.target.value })}
            />
          </label>

          {/* ✅ プラン選択をreact-selectに変更 */}
          <label className="space-y-1 col-span-2">
            <span className="font-semibold">契約プラン</span>
            <Select<Option, true>
              isMulti
              options={planOptions}
              value={selectedOptions}
              // ← ここを型付け（MultiValue<Option>）
              onChange={(selected: MultiValue<Option>) => {
                setForm({ ...form, selectedPlans: selected.map((o) => o.value) });
              }}
            />
          </label>

          <label className="space-y-1">
            <span className="font-semibold">利用開始日</span>
            <input
              type="date"
              className="border p-1 w-full"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </label>
          <label className="space-y-1">
            <span className="font-semibold">契約満了日</span>
            <input
              type="date"
              className="border p-1 w-full"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </label>

          {/* 以下は既存項目 */}
          <div className="col-span-2 border-t pt-2 font-semibold">担当窓口</div>
          <label className="space-y-1">
            <span>担当者名</span>
            <input
              className="border p-1 w-full"
              value={form.contactPerson}
              onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
            />
          </label>
          <label className="space-y-1">
            <span>電話番号</span>
            <input
              className="border p-1 w-full"
              value={form.contactPhone}
              onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
            />
          </label>
          <label className="space-y-1 col-span-2">
            <span>Email</span>
            <input
              type="email"
              className="border p-1 w-full"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>

          {/* その他 */}
          <div className="col-span-2 border-t pt-2 font-semibold">税務・請求</div>
          <label className="space-y-1">
            <span>法人番号</span>
            <input
              className="border p-1 w-full"
              value={form.corporateNo}
              onChange={(e) => setForm({ ...form, corporateNo: e.target.value })}
            />
          </label>
          <label className="space-y-1">
            <span>インボイス番号</span>
            <input
              className="border p-1 w-full"
              value={form.invoiceNo}
              onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })}
            />
          </label>
          <label className="space-y-1">
            <span>支払サイト</span>
            <input
              className="border p-1 w-full"
              value={form.paymentSite}
              onChange={(e) => setForm({ ...form, paymentSite: e.target.value })}
            />
          </label>
          <label className="space-y-1">
            <span>支払方法</span>
            <input
              className="border p-1 w-full"
              value={form.paymentMethod}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            />
          </label>

          {/* PDF URL */}
          <label className="space-y-1 col-span-2">
            <span className="font-semibold">契約書 PDF URL</span>
            <input
              className="border p-1 w-full"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </label>
        </div>

        {/* ボタン群 */}
        <div className="mt-6 flex justify-end gap-3">
          <button className="px-4 py-1 bg-gray-300 rounded" onClick={onClose}>
            キャンセル
          </button>
          <button
            className="px-4 py-1 bg-green-600 text-white rounded"
            onClick={() => {
              // ここでは入力データだけ渡す（id/uid/upw は親で付与）
              onSave({
                ...form,
                // 互換のため旧 plan フィールドにも先頭プランを入れておく（ID保管）
                plan: form.selectedPlans[0] || ""
              });
              onClose();
            }}
          >
            登録
          </button>
        </div>
      </div>
    </div>
  );
}
