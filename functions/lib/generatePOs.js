"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePOs = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const pdf_lib_1 = require("pdf-lib");
const mail_1 = __importDefault(require("@sendgrid/mail"));
admin.initializeApp();
const db = (0, firestore_1.getFirestore)();
const bucket = admin.storage().bucket();
mail_1.default.setApiKey(process.env.SENDGRID_KEY);
exports.generatePOs = functions.firestore
    .document("shifts/{ym}")
    .onUpdate(async (change, ctx) => {
    const after = change.after.data();
    if (!after.confirmed || after.poDone)
        return; // 未確定 or 既に処理済みなら何もしない
    const ym = ctx.params.ym; // 例 202507
    const drivers = await db.getAll(...after.driverIds.map((id) => db.doc(`drivers/${id}`)));
    // 1. テンプレ PDF を読み込み
    const [tplBuf] = await bucket.file("templates/PO.pdf").download();
    for (const drv of drivers) {
        const { name, mail, sealPath } = drv.data();
        // 2. テンプレ → pdf-lib で複製し印影を貼り付け（省略例）
        const pdfDoc = await pdf_lib_1.PDFDocument.load(tplBuf);
        const page = pdfDoc.getPage(0);
        page.drawText(name, { x: 120, y: 520, size: 12 });
        // …印影画像を貼る場合はここで embed & drawImage …
        const pdfBytes = await pdfDoc.save();
        const pdfPath = `PO/${ym}/${drv.id}.pdf`;
        await bucket.file(pdfPath).save(pdfBytes);
        // 3. メタデータを Firestore へ
        await db.collection("purchase_orders").add({
            driverId: drv.id,
            ym,
            path: pdfPath,
            created: admin.firestore.FieldValue.serverTimestamp(),
        });
        // 4. メール送信
        if (mail) {
            await mail_1.default.send({
                to: mail,
                from: "noreply@anbor.co.jp",
                subject: `【発注書】${ym.slice(0, 4)}年${ym.slice(4)}月 ${name} 様`,
                html: `<p>発注書をお送りします。ご確認ください。</p>`,
                attachments: [
                    {
                        filename: `PO_${ym}_${name}.pdf`,
                        content: Buffer.from(pdfBytes).toString("base64"),
                        type: "application/pdf",
                        disposition: "attachment",
                    },
                ],
            });
        }
    }
    // 5. 二重実行防止フラグ
    await change.after.ref.update({ poDone: true });
});
