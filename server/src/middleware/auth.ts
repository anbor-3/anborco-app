import { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import admin from "firebase-admin";
dotenv.config();

const disable = process.env.DISABLE_AUTH === "true";

let initialized = false;
function initAdmin() {
  if (initialized || disable) return;
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID!;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL!;
  const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey } as any),
    });
  }
  initialized = true;
}
initAdmin();

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (disable) return next();
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return res.status(401).json({ error: "no token" });
    const decoded = await admin.auth().verifyIdToken(token);
    (req as any).uid = decoded.uid;
    next();
  } catch (e) {
    res.status(401).json({ error: "invalid token" });
  }
}
