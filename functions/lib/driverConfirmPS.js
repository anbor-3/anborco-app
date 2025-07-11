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
exports.driverConfirmPS = void 0;
const functions = __importStar(require("firebase-functions"));
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const pdf_lib_1 = require("pdf-lib");
exports.driverConfirmPS = functions.https.onCall(async (data, context) => {
    const { psId } = data;
    const uid = context.auth?.uid;
    if (!uid)
        throw new functions.https.HttpsError('unauthenticated', 'Login required');
    const db = (0, firestore_1.getFirestore)();
    const psRef = db.doc(`payment_statements/${psId}`);
    const psSnap = await psRef.get();
    if (!psSnap.exists)
        throw new functions.https.HttpsError('not-found', 'PS not found');
    const ps = psSnap.data();
    if (ps.driverId !== uid)
        throw new functions.https.HttpsError('permission-denied', 'not owner');
    if (ps.driverConfirmed)
        return { ok: true };
    const bucket = (0, storage_1.getStorage)().bucket();
    const [psBuf] = await bucket.file(ps.pdfPath).download();
    const [sealBuf] = await bucket.file(ps.sealPath).download();
    const doc = await pdf_lib_1.PDFDocument.load(psBuf);
    const sealImage = await doc.embedPng(sealBuf);
    const page = doc.getPage(0);
    page.drawImage(sealImage, { x: 430, y: 90, width: 80, height: 80 });
    const invBytes = await doc.save();
    const invPath = `INV/${ps.ym}/${uid}.pdf`;
    await bucket.file(invPath).save(Buffer.from(invBytes));
    await db.collection('invoices').doc(`inv_${ps.ym}_${uid}`).set({
        driverId: uid, ym: ps.ym, amount: ps.amount, pdfPath: invPath, createdAt: firestore_1.Timestamp.now()
    });
    await psRef.update({ driverConfirmed: true });
    return { ok: true };
});
