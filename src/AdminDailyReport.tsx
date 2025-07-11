
import React, { useState } from 'react';

interface Report {
  id: string;
  company: string;
  name: string;
  date: string;
  temperature: 'OK' | 'NG';
  alcohol: 'OK' | 'NG';
  start: string;
  breakStart: string;
  breakEnd: string;
  end: string;
  distanceBefore: number;
  distanceAfter: number;
}

const sampleReports: Report[] = [
  {
    id: 'DRV-0001',
    company: '株式会社トライ物流',
    name: '佐藤 和真',
    date: '2025-04-19',
    temperature: 'OK',
    alcohol: 'NG',
    start: '08:00',
    breakStart: '12:00',
    breakEnd: '12:45',
    end: '18:00',
    distanceBefore: 35210,
    distanceAfter: 35590
  }
];

export default function AdminDailyReport() {
  const [selected, setSelected] = useState<Report | null>(null);

  const showModal = (report: Report) => {
    setSelected(report);
  };

  const hideModal = () => {
    setSelected(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
      <h1 className="text-3xl font-bold text-green-800 tracking-wide shadow-sm">📋 日報管理 <span className="text-sm text-gray-500">- Driver Reports-</span>
      </h1>
      <div className="space-x-2">
        <button className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm">編集</button>
        <button className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 text-sm">削除</button>
      </div>
    </div>
      <table className="w-full text-sm border-separate border-spacing-y-2 bg-white rounded shadow border border-gray-300">
        <thead className="bg-gray-100 text-left">
          <tr>
            <th className="p-2">ID</th>
            <th>会社名</th>
            <th>氏名</th>
            <th>日付</th>
            <th>体調管理</th>
            <th>稼働開始</th>
            <th>休憩開始</th>
            <th>休憩終了</th>
            <th>稼働終了</th>
            <th>走行距離</th>
            <th className="text-center">詳細</th>
          </tr>
        </thead>
        <tbody>
          {sampleReports.map(report => (
            <tr key={report.id} className="border-b hover:bg-green-50 bg-white shadow-sm">
              <td className="p-2">{report.id}</td>
              <td>{report.company}</td>
              <td>{report.name}</td>
              <td>{report.date}</td>
              <td>
                <span className={report.temperature === 'OK' ? 'text-green-600' : 'text-red-600'}>
                  体温: {report.temperature}
                </span>
                <br />
                <span className={report.alcohol === 'OK' ? 'text-green-600' : 'text-red-600'}>
                  ｱﾙｺｰﾙ: {report.alcohol}
                </span>
              </td>
              <td>{report.start}</td>
              <td>{report.breakStart}</td>
              <td>{report.breakEnd}</td>
              <td>{report.end}</td>
              <td>{(report.distanceAfter - report.distanceBefore)} km</td>
              <td className="text-center">
                <button onClick={() => showModal(report)} className="text-blue-600 hover:underline">
                  表示
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow p-6 w-[90%] max-w-xl space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">日報詳細</h2>
            <p><strong>氏名：</strong>{selected.name}</p>
            <p><strong>会社名：</strong>{selected.company}</p>
            <p><strong>日付：</strong>{selected.date}</p>
            <p><strong>体温検査：</strong>{selected.temperature}</p>
            <p><strong>アルコール検査：</strong>{selected.alcohol}</p>
            <p><strong>稼働開始：</strong>{selected.start}</p>
            <p><strong>休憩開始：</strong>{selected.breakStart}</p>
            <p><strong>休憩終了：</strong>{selected.breakEnd}</p>
            <p><strong>稼働終了：</strong>{selected.end}</p>
            <p><strong>走行距離：</strong>{selected.distanceAfter - selected.distanceBefore} km</p>
            <div className="text-right">
              <button onClick={hideModal} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">閉じる</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
