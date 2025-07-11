
export default function ContractManager() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">契約書・証明書管理</h1>
      <table className="w-full border">
        <thead className="bg-gray-100">
          <tr><th>会社名</th><th>契約期間</th><th>証明書</th></tr>
        </thead>
        <tbody>
          <tr className="text-center border-t">
            <td>合同会社ABC</td>
            <td>2024/04/01〜2025/03/31</td>
            <td><button className="text-blue-600 underline">確認</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
