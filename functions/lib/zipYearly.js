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
exports.zipYearly = void 0;
const functions = __importStar(require("firebase-functions"));
const storage_1 = require("firebase-admin/storage");
const firestore_1 = require("firebase-admin/firestore");
const jszip_1 = __importDefault(require("jszip"));
const bucket = (0, storage_1.getStorage)().bucket();
const db = (0, firestore_1.getFirestore)();
exports.zipYearly = functions
    .runWith({ memory: "1GB", timeoutSeconds: 540 })
    .pubsub.topic("yearlyZipTopic")
    .onPublish(async () => {
    const lastYear = new Date().getFullYear() - 1; // e.g. 2024
    const folders = ["PO", "PS", "INV"];
    for (const folder of folders) {
        const [files] = await bucket.getFiles({ prefix: `${folder}/${lastYear}` });
        if (files.length === 0)
            continue;
        const zip = new jszip_1.default();
        for (const f of files) {
            const buf = (await f.download())[0];
            zip.file(f.name.split("/").pop(), buf);
        }
        const zipBuf = await zip.generateAsync({ type: "nodebuffer" });
        const zipPath = `${folder}/${lastYear}.zip`;
        await bucket.file(zipPath).save(zipBuf);
        await Promise.all(files.map((f) => f.delete()));
        await db.collection("yearly_zips").doc(`${folder}_${lastYear}`).set({
            type: folder,
            year: lastYear,
            path: zipPath,
            createdAt: firestore_1.Timestamp.now(),
        });
    }
});
