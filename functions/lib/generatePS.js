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
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePS = void 0;
const functions = __importStar(require("firebase-functions"));
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const pdf_lib_1 = require("pdf-lib");
const sg = __importStar(require("@sendgrid/mail"));
sg.setApiKey(functions.config().sendgrid.key);
const db = (0, firestore_1.getFirestore)();
const bucket = (0, storage_1.getStorage)().bucket();
exports.generatePS = functions.firestore
    .document('shifts/{ym}')
    .onUpdate(async (change, ctx) => {
    if (!change.after.get('confirmed') || change.before.get('confirmed'))
        return;
    const ym = ctx.params.ym;
    const drivers = change.after.get('driverIds') || [];
    const [tpl] = await bucket.file('templates/ps_base.pdf').download();
    for (const driverId of drivers) {
        const driverSnap = await db.doc(`drivers/${driverId}`).get();
        if (!driverSnap.exists)
            continue;
        const driver = driverSnap.data();
        const amount = await calcAmount(driverId, ym);
        const pdfDoc = await pdf_lib_1.PDFDocument.load(tpl);
        const page = pdfDoc.getPages()[0];
        const font = await pdfDoc.embedFont(pdf_lib_1.StandardFonts.Helvetica);
        page.drawText(driver.name, { x: 150, y: 700, size: 12, font });
        page.drawText(`${amount.toLocaleString()} 円`, { x: 400, y: 650, size: 12, font });
        const pdfBytes = await pdfDoc.save();
        const path = `PS/${ym}/${driverId}.pdf`;
        await bucket.file(path).save(Buffer.from(pdfBytes));
        await db.collection('payment_statements').doc(`${ym}_${driverId}`).set({
            driverId, ym, amount, pdfPath: path, mailSent: true, createdAt: firestore_1.Timestamp.now()
        });
        await sg.send({
            to: driver.mail,
            from: 'noreply@anborco.jp',
            subject: `【支払明細書】${ym} ${driver.name} 様`,
            text: 'シフト確定に伴う支払明細書をお送りします。',
            attachments: [{
                    filename: 'PS.pdf',
                    type: 'application/pdf',
                    content: Buffer.from(pdfBytes).toString('base64'),
                    disposition: 'attachment'
                }]
        });
    }
});
async function calcAmount(driverId, ym) {
    return 123456; // TODO business logic
}
