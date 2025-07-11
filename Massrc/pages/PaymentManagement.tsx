
import React from 'react';

const paymentData = [
  { company: '株式会社グリーン物流', month: '2024-03', paid: true, amount: 50000 },
  { company: '株式会社スピード配送', month: '2024-03', paid: false, amount: 80000 },
  { company: '株式会社ライトライン', month: '2024-03', paid: true, amount: 120000 },
];

const PaymentManagement = () => {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">支払管理</h2>
      <table className="min-w-full table-auto border-collapse border border-gray-300 bg-white shadow">
        <thead>
          <tr className="bg-gray-100 text-center">
            <th className="border px-4 py-2">会社名</th>
            <th className="border px-4 py-2">月</th>
            <th className="border px-4 py-2">支払状況</th>
            <th className="border px-4 py-2">売上金額</th>
          </tr>
        </thead>
        <tbody>
          {paymentData.map((item, index) => (
            <tr key={index} className="text-center">
              <td className="border px-4 py-2">{item.company}</td>
              <td className="border px-4 py-2">{item.month}</td>
              <td className="border px-4 py-2">
                {item.paid ? (
                  <span className="text-green-600 font-semibold">支払済</span>
                ) : (
                  <span className="text-red-600 font-semibold">未払い</span>
                )}
              </td>
              <td className="border px-4 py-2">¥{item.amount.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PaymentManagement;
