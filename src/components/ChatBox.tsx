// src/components/ChatBox.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Send, ImagePlus, Pencil, Trash2, DoorOpen, Search } from "lucide-react";
import dayjs from "dayjs";

import { auth, db, storage } from "../firebaseClient";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  setDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getDownloadURL, ref as sRef, uploadBytes } from "firebase/storage";

/* ===================== Feature flag（会社間はまだ無効） ===================== */
const ENABLE_XCOMPANY =
  // Next.js
  ((typeof process !== "undefined" ? (process as any) : undefined)?.env?.NEXT_PUBLIC_ENABLE_XCOMPANY === "true") ||
  // Vite
  ((typeof import.meta !== "undefined" ? (import.meta as any) : undefined)?.env?.VITE_ENABLE_XCOMPANY === "true") ||
  false;

/* ===================== Types ===================== */
type ChatScope = "company" | "external"; // external は将来の会社間用（今は未使用）

type Message = {
  id: string;
  sender: string;   // uid
  time: string;     // YYYY-MM-DD HH:mm:ss（描画用）
  createdAt?: any;  // Firestore Timestamp
  text: string;
  imageUrl?: string | null;
};

type ChatTarget = {
  id: string;       // chatId（group も DM も共通）
  name: string;     // 表示名（group名 or 相手名）
  members: string[];
  isGroup: boolean;
  ownerId?: string; // グループオーナー
  company?: string; // 会社内チャットの所属会社
  scope?: ChatScope; // 既定は "company"
  allowedCompanies?: string[]; // 将来の会社間用（今は ["<company>"]）
  spaceId?: string; // 将来、マスターで束ねるスペースID
  lastReadAt?: Record<string, any>; // { uid: Timestamp }
  messages: Message[];
};

type DirectoryUser = {
  uid: string;
  name: string;
  email?: string;
  role?: string;
  company?: string;
  active?: boolean;
};

/* ===================== Firestore Layout =====================

users:      /users/{uid} -> { name, email, role, company, active }
chats:      /chats/{chatId} -> {
              isGroup, name?, ownerId?, members[], company, scope, allowedCompanies, spaceId?,
              lastReadAt{uid: Timestamp}, createdAt
            }
messages:   /chats/{chatId}/messages/{messageId}

DM chat id (新):
  dm_${company}_${min(uid1, uid2)}_${max(uid1, uid2)}
  ※ 旧: dm_${min}_${max} も読み込み時に自動移行チェック

============================================================ */

const ChatBox = () => {
  /* ---------- Self / org ---------- */
  const [currentUid, setCurrentUid] = useState<string>("");
  const [currentUserName, setCurrentUserName] = useState<string>("");
  const [company, setCompany] = useState<string>("");

  /* ---------- Lists ---------- */
  const [groups, setGroups] = useState<ChatTarget[]>([]);
  const [dms, setDms] = useState<ChatTarget[]>([]);
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);

  /* ---------- Selection / compose ---------- */
  const [selectedChat, setSelectedChat] = useState<ChatTarget | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);

  /* ---------- Invite modal ---------- */
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitePick, setInvitePick] = useState<string[]>([]);

  /* ---------- Directory search (DM) ---------- */
  const [queryStr, setQueryStr] = useState("");
  thead
  const [activeIdx, setActiveIdx] = useState<number>(-1);

  /* ---------- Unread badge map ---------- */
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});

  const bottomRef = useRef<HTMLDivElement>(null);

  /* ===================== Auth ===================== */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      setCurrentUid(user.uid);

      const meSnap = await getDoc(doc(db, "users", user.uid));
      const me = meSnap.exists() ? (meSnap.data() as DirectoryUser) : undefined;

      setCurrentUserName(me?.name || user.displayName || user.email || "Me");
      setCompany(me?.company || localStorage.getItem("company") || "default");
    });
    return () => unsub();
  }, []);

  /* ===================== Directory（社内のみ） ===================== */
  useEffect(() => {
    if (!company) return;
    const qUsers = query(
      collection(db, "users"),
      where("company", "==", company),
      where("active", "==", true)
    );
    const unsub = onSnapshot(qUsers, (snap) => {
      const list: DirectoryUser[] = snap.docs
        .map((d) => ({ uid: d.id, ...(d.data() as any) }))
        .filter((u) => u.uid !== currentUid);
      setDirectory(list);
    });
    return () => unsub();
  }, [company, currentUid]);

  /* ===================== Groups（社内 & 自分がメンバー） ===================== */
  useEffect(() => {
    if (!currentUid || !company) return;
    const qGroups = query(
      collection(db, "chats"),
      where("isGroup", "==", true),
      where("company", "==", company),
      where("scope", "==", "company"),
      where("members", "array-contains", currentUid)
    );
    const unsub = onSnapshot(qGroups, (snap) => {
      const list: ChatTarget[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: data.name || "グループ",
          members: data.members || [],
          isGroup: true,
          ownerId: data.ownerId,
          company: data.company,
          scope: data.scope || "company",
          allowedCompanies: data.allowedCompanies || [data.company],
          spaceId: data.spaceId,
          lastReadAt: data.lastReadAt || {},
          messages: [], // 別購読
        };
      });
      setGroups(list);
    });
    return () => unsub();
  }, [currentUid, company]);

  /* ===================== DMs（社内 & 自分がメンバー） ===================== */
  useEffect(() => {
    if (!currentUid || !company) return;
    const qDMs = query(
      collection(db, "chats"),
      where("isGroup", "==", false),
      where("company", "==", company),
      where("scope", "==", "company"),
      where("members", "array-contains", currentUid)
    );
    const unsub = onSnapshot(qDMs, (snap) => {
      const list: ChatTarget[] = snap.docs.map((d) => {
        const data = d.data() as any;
        const partnerUid = (data.members || []).find((m: string) => m !== currentUid);
        const partnerName =
          directory.find((u) => u.uid === partnerUid)?.name || data.name || "メンバー";
        return {
          id: d.id,
          name: partnerName,
          members: data.members || [],
          isGroup: false,
          company: data.company,
          scope: data.scope || "company",
          allowedCompanies: data.allowedCompanies || [data.company],
          spaceId: data.spaceId,
          lastReadAt: data.lastReadAt || {},
          messages: [],
        };
      });
      setDms(list);
    });
    return () => unsub();
  }, [currentUid, company, directory]);

  /* ===================== Messages（選択チャット） ===================== */
  useEffect(() => {
    if (!selectedChat?.id) return;
    // 安全：現段階は company スコープのみ許可
    if (selectedChat.scope && selectedChat.scope !== "company" && !ENABLE_XCOMPANY) {
      setSelectedChat(null);
      return;
    }
    const qMsgs = query(
      collection(db, "chats", selectedChat.id, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(qMsgs, (snap) => {
      const msgs: Message[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          sender: data.sender,
          text: data.text || "",
          imageUrl: data.imageUrl || null,
          createdAt: data.createdAt,
          time: data.createdAt ? dayjs(data.createdAt.toDate()).format("YYYY-MM-DD HH:mm:ss") : "",
        };
      });

      setSelectedChat((prev) => (prev ? { ...prev, messages: msgs } : prev));

      // 既読更新（閲覧時）
      if (currentUid) {
        updateDoc(doc(db, "chats", selectedChat.id), {
          [`lastReadAt.${currentUid}`]: serverTimestamp(),
        }).catch(() => {});
      }
    });
    return () => unsub();
  }, [selectedChat?.id, currentUid, selectedChat?.scope]);

  /* ===================== 未読件数（全チャット） ===================== */
  useEffect(() => {
    if (!currentUid) return;

    const targets = [...groups, ...dms];
    if (targets.length === 0) {
      setUnreadMap({});
      return;
    }

    const unsubs = targets.map((chat) => {
      // 会社外は現段階では無効
      if (chat.scope && chat.scope !== "company" && !ENABLE_XCOMPANY) {
        return () => {};
      }
      const msgsCol = collection(db, "chats", chat.id, "messages");
      const last = chat.lastReadAt?.[currentUid];
      const qBase = last ? query(msgsCol, where("createdAt", ">", last)) : query(msgsCol);

      return onSnapshot(qBase, (snap) => {
        // 自分が送ったメッセージは未読に含めない
        const unread = snap.docs.filter((d) => d.data()?.sender !== currentUid).length;
        setUnreadMap((prev) => ({ ...prev, [chat.id]: unread }));
      });
    });

    return () => {
      unsubs.forEach((u) => {
        try {
          u();
        } catch {}
      });
    };
  }, [groups, dms, currentUid]);

  /* ===================== Helpers ===================== */
  const unreadCount = (chat: ChatTarget) => unreadMap[chat.id] ?? 0;

  const dmIdLegacy = (a: string, b: string) => (a < b ? `dm_${a}_${b}` : `dm_${b}_${a}`);
  const dmIdOf = (a: string, b: string, co: string) =>
    (a < b ? `dm_${co}_${a}_${b}` : `dm_${co}_${b}_${a}`);

  const ensureDmChatAndOpen = async (partner: DirectoryUser) => {
    if (!currentUid || !company) return;

    const idNew = dmIdOf(currentUid, partner.uid, company);
    const idOld = dmIdLegacy(currentUid, partner.uid);
    const chatRefNew = doc(db, "chats", idNew);
    const chatRefOld = doc(db, "chats", idOld);

    const snapNew = await getDoc(chatRefNew);
    if (!snapNew.exists()) {
      const snapOld = await getDoc(chatRefOld);
      if (snapOld.exists()) {
        // 旧IDが存在 → 会社情報・スコープを整備（安全な範囲で）
        try {
          await updateDoc(chatRefOld, {
            company,
            scope: "company",
            allowedCompanies: [company],
          });
        } catch {}
        const data: any = snapOld.data() || {};
        setSelectedChat({
          id: idOld,
          name: partner.name,
          members: data.members || [currentUid, partner.uid],
          isGroup: false,
          company,
          scope: "company",
          allowedCompanies: [company],
          spaceId: data.spaceId,
          lastReadAt: data.lastReadAt || {},
          messages: [],
        });
        return;
      }

      // 新規作成（会社スコープ）
      await setDoc(chatRefNew, {
        isGroup: false,
        members: [currentUid, partner.uid],
        company,
        scope: "company",
        allowedCompanies: [company],
        lastReadAt: { [currentUid]: serverTimestamp() },
        createdAt: serverTimestamp(),
      });
    }

    setSelectedChat({
      id: idNew,
      name: partner.name,
      members: [currentUid, partner.uid],
      isGroup: false,
      company,
      scope: "company",
      allowedCompanies: [company],
      lastReadAt: {},
      messages: [],
    });
  };

  const normStr = (s: string) =>
    (s || "")
      .toLowerCase()
      .normalize("NFKC")
      .replace(/[ぁ-ん]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));

  const filteredDirectory = useMemo(() => {
    if (!queryStr.trim()) return [];
    const Q = normStr(queryStr);
    return directory.filter(
      (u) =>
        normStr(u.name).includes(Q) ||
        normStr(u.email || "").includes(Q) ||
        normStr(u.uid).includes(Q)
    );
  }, [directory, queryStr]);

  /* ===================== Group ops ===================== */
  const createGroup = async () => {
    if (!currentUid || !company) return;
    const name = prompt("新しいグループ名を入力してください");
    if (!name) return;
    const ref = await addDoc(collection(db, "chats"), {
      isGroup: true,
      name,
      ownerId: currentUid,
      members: [currentUid],
      company,
      scope: "company",            // ★ 社内限定
      allowedCompanies: [company], // ★ 将来の会社間用フィールド
      lastReadAt: { [currentUid]: serverTimestamp() },
      createdAt: serverTimestamp(),
    });
    setSelectedChat({
      id: ref.id,
      name,
      members: [currentUid],
      isGroup: true,
      ownerId: currentUid,
      company,
      scope: "company",
      allowedCompanies: [company],
      lastReadAt: {},
      messages: [],
    });
  };

  const leaveGroup = async () => {
    if (!selectedChat?.isGroup || !currentUid) return;

    if (selectedChat.ownerId !== currentUid) {
      const newMembers = selectedChat.members.filter((m) => m !== currentUid);
      await updateDoc(doc(db, "chats", selectedChat.id), { members: newMembers });
      setSelectedChat(null);
      return;
    }

    const ok = confirm("オーナーです。このグループを削除しますか？（元に戻せません）");
    if (!ok) return;

    const msgsSnap = await getDocs(collection(db, "chats", selectedChat.id, "messages"));
    const batch = writeBatch(db);
    msgsSnap.forEach((m) => batch.delete(m.ref));
    batch.delete(doc(db, "chats", selectedChat.id));
    await batch.commit();
    setSelectedChat(null);
  };

  const applyInvite = async () => {
    if (!selectedChat || !selectedChat.isGroup || !currentUid) return;
    if (selectedChat.ownerId !== currentUid) {
      alert("招待できるのはグループオーナーのみです");
      setInviteOpen(false);
      setInvitePick([]);
      return;
    }
    const added = invitePick.filter((uid) => !selectedChat.members.includes(uid));
    if (added.length === 0) {
      setInviteOpen(false);
      setInvitePick([]);
      return;
    }
    const newMembers = [...selectedChat.members, ...added];
    await updateDoc(doc(db, "chats", selectedChat.id), { members: newMembers });
    setSelectedChat({ ...selectedChat, members: newMembers });
    setInviteOpen(false);
    setInvitePick([]);
  };

  /* ===================== Open chat ===================== */
  const openChat = async (chat: ChatTarget) => {
    // 現段階は社内スコープのみ
    if (chat.scope && chat.scope !== "company" && !ENABLE_XCOMPANY) return;

    if (currentUid) {
      updateDoc(doc(db, "chats", chat.id), {
        [`lastReadAt.${currentUid}`]: serverTimestamp(),
      }).catch(() => {});
    }
    setSelectedChat({ ...chat, messages: chat.messages ?? [] });
  };

  /* ===================== Send / Edit / Delete ===================== */
  const sendMessage = async () => {
    if (!selectedChat || (!newMessage.trim() && !file) || !currentUid) return;

    // スコープ/メンバー確認（保険）
    if ((selectedChat.scope && selectedChat.scope !== "company" && !ENABLE_XCOMPANY) ||
        !selectedChat.members.includes(currentUid)) {
      alert("このチャットには投稿できません。");
      return;
    }

    let imageUrl: string | null = null;
    if (file) {
      const objectPath = `chat_images/${company}/${selectedChat.id}/${Date.now()}_${file.name}`;
      const snap = await uploadBytes(sRef(storage, objectPath), file);
      imageUrl = await getDownloadURL(snap.ref);
    }

    await addDoc(collection(db, "chats", selectedChat.id, "messages"), {
      sender: currentUid,
      text: newMessage || "",
      imageUrl,
      createdAt: serverTimestamp(),
    });

    await updateDoc(doc(db, "chats", selectedChat.id), {
      [`lastReadAt.${currentUid}`]: serverTimestamp(),
    }).catch(() => {});

    setNewMessage("");
    setFile(null);
  };

  const editMessage = async () => {
    if (editIndex === null || !selectedChat) return;
    const msg = selectedChat.messages[editIndex];
    if (!msg) return;
    await updateDoc(doc(db, "chats", selectedChat.id, "messages", msg.id), {
      text: newMessage,
    });
    setNewMessage("");
    setEditIndex(null);
  };

  const deleteMessage = async (idx: number) => {
    if (!selectedChat) return;
    const msg = selectedChat.messages[idx];
    if (!msg) return;
    // 論理削除（痕跡は残す）
    await updateDoc(doc(db, "chats", selectedChat.id, "messages", msg.id), {
      text: "（削除されました）",
      imageUrl: null,
    });
  };

  /* ===================== UI ===================== */
  return (
    <div className="flex h-[85vh] w-full border rounded-xl shadow-lg overflow-hidden">
      {/* ===== Sidebar ===== */}
      <aside className="w-80 bg-gradient-to-b from-zinc-900 to-zinc-800 text-white overflow-y-auto relative">
        {/* Header + Search */}
        <div className="sticky top-0 z-10 bg-zinc-900 p-4 border-b border-zinc-700 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">
              チャット <span className="text-sm text-zinc-400">-Chat-</span>
            </h2>
            <button
              onClick={createGroup}
              className="rounded bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-sm font-medium"
            >
              ➕ 新規グループ
            </button>
          </div>

          {/* 🔍 社内ディレクトリ検索 */}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              value={queryStr}
              onChange={(e) => {
                setQueryStr(e.target.value);
                setActiveIdx(0);
              }}
              onKeyDown={(e) => {
                if (!filteredDirectory.length) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveIdx((i) => (i + 1) % filteredDirectory.length);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveIdx((i) => (i - 1 + filteredDirectory.length) % filteredDirectory.length);
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const pick = filteredDirectory[Math.max(0, activeIdx)];
                  if (pick) {
                    ensureDmChatAndOpen(pick);
                    setQueryStr("");
                    setActiveIdx(-1);
                  }
                } else if (e.key === "Escape") {
                  setQueryStr("");
                  setActiveIdx(-1);
                }
              }}
              placeholder="社内メンバー名・メール・IDで検索"
              className="w-full pl-8 pr-3 py-2 rounded bg-zinc-800/70 border border-zinc-700 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* 🔎 候補ドロップダウン */}
          {queryStr.trim() && filteredDirectory.length > 0 && (
            <div className="bg-zinc-800 border border-zinc-700 rounded shadow-lg max-h-64 overflow-y-auto">
              {filteredDirectory.map((u, i) => (
                <button
                  key={u.uid}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => {
                    ensureDmChatAndOpen(u);
                    setQueryStr("");
                    setActiveIdx(-1);
                  }}
                  className={`w-full text-left px-3 py-2 ${
                    i === activeIdx ? "bg-zinc-700" : "hover:bg-zinc-700"
                  }`}
                >
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-zinc-300">
                    {u.email || "-"} ・ {u.uid} {u.role ? `・${u.role}` : ""}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Lists */}
        <div className="px-3 py-2">
          {/* Groups */}
          <h3 className="mt-2 mb-1 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            グループ
          </h3>
          {groups.length === 0 && <div className="text-zinc-400 text-sm mb-2">グループはまだありません</div>}
          {groups.map((group) => (
            <div
              key={group.id}
              className={`p-2 rounded cursor-pointer hover:bg-zinc-700 ${
                selectedChat?.id === group.id ? "bg-zinc-700" : ""
              }`}
              onClick={() => openChat(group)}
            >
              <div className="flex justify-between items-center">
                <span className="truncate">{group.name}</span>
                {unreadCount(group) > 0 && (
                  <span className="text-xs bg-red-500 text-white rounded-full px-2">
                    {unreadCount(group)}
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* DMs */}
          <h3 className="mt-4 mb-1 text-xs font-semibold text-zinc-400 uppercase tracking-wider">個人チャット</h3>
          {dms.length === 0 && <div className="text-zinc-400 text-sm">検索からDMを開始できます</div>}
          {dms.map((dm) => (
            <div
              key={dm.id}
              className={`p-2 rounded cursor-pointer hover:bg-zinc-700 ${
                selectedChat?.id === dm.id ? "bg-zinc-700" : ""
              }`}
              onClick={() => openChat(dm)}
            >
              <div className="flex justify-between items-center">
                <span className="truncate">{dm.name}</span>
                {unreadCount(dm) > 0 && (
                  <span className="text-xs bg-red-500 text-white rounded-full px-2">
                    {unreadCount(dm)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* ===== Main Chat ===== */}
      <main className="flex-1 flex flex-col bg-white">
        {/* Header */}
        {selectedChat && (
          <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center z-10">
            <div>
              <h3 className="text-lg font-semibold">{selectedChat.name}</h3>
              <p className="text-sm text-gray-500">
                {selectedChat.isGroup ? "グループチャット" : "個人チャット"}
              </p>

              {/* メンバーバッジ（グループのみ） */}
              {selectedChat.isGroup && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {selectedChat.members.map((uid) => (
                    <span
                      key={uid}
                      className="inline-flex items-center rounded-full bg-zinc-100 border border-zinc-200 px-2 py-0.5 text-xs text-zinc-700"
                      title={uid === selectedChat.ownerId ? "グループオーナー" : undefined}
                    >
                      {directory.find((u) => u.uid === uid)?.name ||
                        (uid === currentUid ? currentUserName : uid)}
                      {uid === selectedChat.ownerId && (
                        <span className="ml-1 text-[10px] text-amber-600">★</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* 招待（オーナーのみ） */}
              {selectedChat.isGroup && (
                <button
                  onClick={() => {
                    if (selectedChat.ownerId !== currentUid) return;
                    setInviteOpen(true);
                    setInvitePick([]);
                  }}
                  disabled={selectedChat.ownerId !== currentUid}
                  className={`rounded border px-3 py-1.5 text-sm inline-flex items-center gap-1 ${
                    selectedChat.ownerId === currentUid
                      ? "border-emerald-300 text-emerald-600 hover:bg-emerald-50"
                      : "border-zinc-300 text-zinc-400 cursor-not-allowed"
                  }`}
                  title={
                    selectedChat.ownerId === currentUid
                      ? "メンバーを招待"
                      : "招待できるのはオーナーのみです"
                  }
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <path d="M15 14c3.866 0 7 2.015 7 4.5V21H8v-2.5C8 16.015 11.134 14 15 14Z" stroke="currentColor" />
                    <path d="M15 11a4 4 0 1 0-0.001-8.001A4 4 0 0 0 15 11Z" stroke="currentColor" />
                    <path d="M4 8h5M6.5 5.5v5" stroke="currentColor" />
                  </svg>
                  メンバー追加
                </button>
              )}

              {/* 退出（オーナーは削除／メンバーは離脱） */}
              {selectedChat.isGroup && (
                <button
                  onClick={leaveGroup}
                  className="rounded border px-3 py-1.5 text-sm inline-flex items-center gap-1 border-red-300 text-red-600 hover:bg-red-50"
                  title="グループ退出"
                >
                  <DoorOpen className="h-4 w-4" />
                  退出
                </button>
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {selectedChat ? (
            selectedChat.messages.map((msg, idx) => {
              const mine = msg.sender === currentUid;
              return (
                <div key={msg.id} className={`my-2 flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`p-3 rounded-xl max-w-[65%] shadow-md ${
                      mine ? "bg-blue-100 text-right" : "bg-gray-100 text-left"
                    }`}
                  >
                    {msg.imageUrl && (
                      <img src={msg.imageUrl} alt="attachment" className="mb-1 rounded max-w-full" />
                    )}
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                    <div className="text-xs text-gray-500 mt-1 flex justify-between items-center">
                      <span>{msg.time}</span>
                      {mine && (
                        <span className="ml-2 space-x-2">
                          <button
                            onClick={() => {
                              setEditIndex(idx);
                              setNewMessage(msg.text);
                            }}
                            className="inline text-gray-600 hover:text-gray-800"
                            title="編集"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => deleteMessage(idx)}
                            className="inline text-red-500 hover:text-red-600"
                            title="削除"
                          >
                            <Trash2 size={14} />
                          </button>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-gray-400 mt-4 text-center">
              チャットを選択するか、左上で検索して開始してください
            </p>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {selectedChat && (
          <div className="p-4 border-t flex items-center gap-2">
            <input
              className="flex-1 border rounded px-3 py-2"
              placeholder="メッセージを入力..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (editIndex !== null ? editMessage() : sendMessage())}
            />
            <label className="inline-flex items-center gap-2 cursor-pointer text-gray-600 hover:text-gray-800">
              <ImagePlus className="h-5 w-5" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
            <button
              onClick={editIndex !== null ? editMessage : sendMessage}
              className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              送信
            </button>
          </div>
        )}
      </main>

      {/* 招待モーダル */}
      {inviteOpen && selectedChat && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-96 p-4">
            <h3 className="text-lg font-semibold mb-2">メンバーを招待</h3>
            {(() => {
              const memberSet = new Set(selectedChat.members ?? []);
              const candidates = directory.filter((u) => !memberSet.has(u.uid));
              return (
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {candidates.map((u) => (
                    <label
                      key={u.uid}
                      className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={invitePick.includes(u.uid)}
                        onChange={(e) => {
                          if (e.target.checked) setInvitePick((p) => [...p, u.uid]);
                          else setInvitePick((p) => p.filter((id) => id !== u.uid));
                        }}
                      />
                      <span>{u.name}</span>
                    </label>
                  ))}
                </div>
              );
            })()}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setInviteOpen(false)} className="px-3 py-1.5 rounded border">
                キャンセル
              </button>
              <button onClick={applyInvite} className="px-3 py-1.5 rounded bg-emerald-600 text-white">
                招待する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatBox;
