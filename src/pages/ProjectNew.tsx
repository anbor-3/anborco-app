
import React, { useState, useEffect } from "react";

type Project = {
  id?: number;
  company: string;
  manager: string;
  phone: string;
  name: string;
  contractStart: string;
  contractEnd: string;
  reward: string;
  workDays: string;
  startTime: string;
  endTime: string;
  paymentDate: string;
  transferDate: string;
  requiredPeople: number;
  workingHours: string;
  operatingTime: string;
};

type Props = {
  initialProject: Project | null;
  onSave: (project: Project) => void;
  onCancel: () => void;
};

export default function ProjectNew({ initialProject, onSave, onCancel }: Props) {
  const [formData, setFormData] = useState<Project>({
    company: "",
    manager: "",
    phone: "",
    name: "",
    contractStart: "",
    contractEnd: "",
    reward: "",
    workDays: "",
    startTime: "",
    endTime: "",
    paymentDate: "",
    transferDate: "",
    requiredPeople: 0,
    workingHours: "",
    operatingTime: "",
  });

  useEffect(() => {
    if (initialProject) {
      setFormData(initialProject);
    }
  }, [initialProject]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: name === "requiredPeople" ? Number(value) : value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center">
      <div className="bg-white p-6 rounded shadow w-2/3 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {initialProject ? "案件を編集" : "新規案件追加"}
        </h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm">会社名</label>
            <input type="text" name="company" value={formData.company} onChange={handleChange} className="border rounded w-full p-2" />
          </div>
          <div>
            <label className="block text-sm">担当者名</label>
            <input type="text" name="manager" value={formData.manager} onChange={handleChange} className="border rounded w-full p-2" />
          </div>
          <div>
            <label className="block text-sm">電話番号</label>
            <input type="text" name="phone" value={formData.phone} onChange={handleChange} className="border rounded w-full p-2" />
          </div>
          <div>
            <label className="block text-sm">案件名</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} className="border rounded w-full p-2" />
          </div>
          <div>
            <label className="block text-sm">契約開始日</label>
            <input type="date" name="contractStart" value={formData.contractStart} onChange={handleChange} className="border rounded w-full p-2" />
          </div>
          <div>
            <label className="block text-sm">契約終了日</label>
            <input type="date" name="contractEnd" value={formData.contractEnd} onChange={handleChange} className="border rounded w-full p-2" />
          </div>
          <div>
            <label className="block text-sm">報酬額</label>
            <input type="text" name="reward" value={formData.reward} onChange={handleChange} className="border rounded w-full p-2" />
          </div>
          <div>
            <label className="block text-sm">勤務日数</label>
            <input type="text" name="workDays" value={formData.workDays} onChange={handleChange} className="border rounded w-full p-2" />
          </div>
          <div>
            <label className="block text-sm">勤務時間</label>
            <input type="text" name="workingHours" value={formData.workingHours} onChange={handleChange} className="border rounded w-full p-2" />
          </div>
          <div>
            <label className="block text-sm">稼働時間</label>
            <input type="text" name="operatingTime" value={formData.operatingTime} onChange={handleChange} className="border rounded w-full p-2" />
          </div>
          <div>
            <label className="block text-sm">入金日</label>
            <input type="text" name="paymentDate" value={formData.paymentDate} onChange={handleChange} className="border rounded w-full p-2" />
          </div>
          <div>
            <label className="block text-sm">支払日</label>
            <input type="text" name="transferDate" value={formData.transferDate} onChange={handleChange} className="border rounded w-full p-2" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm">必要人員数</label>
            <input type="number" name="requiredPeople" value={formData.requiredPeople} onChange={handleChange} className="border rounded w-full p-2" />
          </div>
          <div className="col-span-2 flex justify-end gap-2">
            <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">キャンセル</button>
            <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">保存</button>
          </div>
        </form>
      </div>
    </div>
  );
}
