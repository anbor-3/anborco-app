
import React from "react";
import { Card, CardContent } from "@/components/ui/card";

const Dashboard = () => {
  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-white">
      {/* 日報提出状況 */}
      <Card className="bg-green-900">
        <CardContent>
          <h2 className="text-lg font-semibold mb-2">📋 日報提出状況</h2>
          <p>提出済：12名 / 未提出：3名</p>
          <div className="h-2 bg-white mt-2 relative">
            <div className="absolute h-2 bg-lime-400" style={{ width: "80%" }}></div>
          </div>
        </CardContent>
      </Card>

      {/* 稼働中ドライバー */}
      <Card className="bg-gray-800">
        <CardContent>
          <h2 className="text-lg font-semibold mb-2">👤 本日稼働中ドライバー</h2>
          <ul className="space-y-1 text-sm">
            <li className="text-lime-400">高橋さん（稼働中）</li>
            <li className="text-yellow-300">霜山さん（休憩中）</li>
            <li className="text-gray-400">田中さん（未稼働）</li>
          </ul>
        </CardContent>
      </Card>

      {/* GPS位置取得サマリ */}
      <Card className="bg-blue-900">
        <CardContent>
          <h2 className="text-lg font-semibold mb-2">🗺 GPS取得状況</h2>
          <p>取得中：3名 / 未取得：2名</p>
          <div className="h-2 bg-white mt-2 relative">
            <div className="absolute h-2 bg-blue-300" style={{ width: "60%" }}></div>
          </div>
        </CardContent>
      </Card>

      {/* 法改正対応ToDo進捗 */}
      <Card className="bg-gray-700">
        <CardContent>
          <h2 className="text-lg font-semibold mb-2">✅ 法改正対応タスク進捗</h2>
          <p>完了：5 / 全体：8</p>
          <div className="h-2 bg-white mt-2 relative">
            <div className="absolute h-2 bg-lime-500" style={{ width: "62%" }}></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
