
import React from 'react';

export default function AdminDashboard() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">ダッシュボード</h1>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white shadow p-4 rounded">
          <p className="text-gray-500">未提出日報</p>
          <p className="text-3xl font-bold text-red-500">2件</p>
        </div>
        <div className="bg-white shadow p-4 rounded">
          <p className="text-gray-500">本日稼働中のドライバー</p>
          <p className="text-3xl font-bold text-green-600">5名</p>
        </div>
        <div className="bg-white shadow p-4 rounded">
          <p className="text-gray-500">近日通知件数</p>
          <p className="text-3xl font-bold text-blue-600">4件</p>
        </div>
      </div>
    </div>
  );
}
