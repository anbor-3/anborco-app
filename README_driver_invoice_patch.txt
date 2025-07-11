
【DriverInvoiceCreator.tsx の設置手順】

1. ファイル配置:
   - DriverInvoiceCreator.tsx → /src/pages/ に配置

2. App.tsx の <Routes> に以下を追加（DriverPaymentPreview の直後など）:
   import DriverInvoiceCreator from "../pages/DriverInvoiceCreator";
   <Route path="invoice" element={<DriverInvoiceCreator />} />

3. 動作:
   - ドライバーが `/driver/payment/2025/06` 等で「確認」を押すと `/driver/invoice` に遷移
   - 請求番号を入力 → 請求書PDFを作成・保存・ダウンロードし履歴へ移動
