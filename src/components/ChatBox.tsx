
import  { useState, useRef, useEffect } from 'react';
import { SendHorizontal, Users, Pencil, ImagePlus } from 'lucide-react';
import useCompanyUsers from '../hooks/useCompanyUsers';
import { db, storage } from "../firebaseClient";
import {
  collection,
  addDoc,
  doc,
  setDoc,
  onSnapshot,
  Timestamp,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/* ---------- 型定義 ---------- */
type Message = {
  id: string;
  sender: string;
  text: string;
  time: string | Timestamp;
  imageUrl?: string | null;
};

type Group = {
  id: string;
  name: string;
  members: string[];
  unreadBy: string[];
  company: string;
  messages: Message[];
};

/* ==================== コンポーネント本体 ==================== */
export default function ChatBox() {
  /* --- ログインユーザー --- */
// Login.tsx で保存しているキーは "currentUser" 想定
const stored = localStorage.getItem("currentUser");
if (!stored) {
  // 未ログインガード（必要ならリダイレクトでもOK）
  throw new Error("Not logged in: currentUser not found in localStorage");
}
const currentUser = JSON.parse(stored) as {
  id?: string;        // Login.tsx では id を使うことがある
  uid?: string;       // 以前のコードの互換
  name: string;
  role: "driver" | "admin" | "master";
  company: string;
};
// 以降は myUid を統一的に利用
const myUid = currentUser.id ?? currentUser.uid ?? "";

  /* --- 各種 State --- */
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [input, setInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedPrivate, setSelectedPrivate] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [creatingPrivateChat, setCreatingPrivateChat] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [editingMembers, setEditingMembers] = useState(false);
  const [tempMembers, setTempMembers] = useState<string[]>([]);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  /* --- 会社メンバー一覧 --- */
  const { users: companyMembers } = useCompanyUsers(currentUser.company);
  const drivers = companyMembers.filter(u => u.role === 'driver');
  const admins = companyMembers.filter(u => u.role === 'admin');

  /* ---------- メッセージ送信 ---------- */
const sendMessage = async () => {
  if (!selectedGroup || (!input.trim() && !file)) return;

  let imageUrl: string | null = null;
  if (file) {
    const snap = await uploadBytes(
      ref(storage, `chat_images/${Date.now()}_${file.name}`),
      file
    );
    imageUrl = await getDownloadURL(snap.ref);
  }

  // Firestore にメッセージを追加
  await addDoc(collection(db, "messages"), {
    sender: myUid,
    text: input,
    time: Timestamp.now(),
    imageUrl,
    groupId: selectedGroup.id,
  });

  // 既読管理：自分以外を未読に
  const nextUnread = selectedGroup.members.filter((uid) => uid !== myUid);
  await setDoc(
    doc(db, "groups", selectedGroup.id),
    { unreadBy: nextUnread },
    { merge: true }
  );

  // 👉 ローカル即時反映（落ち着いて同じロジックで）
  const newMsg: Message = {
    id: `${Date.now()}`, // 文字列で統一
    sender: myUid,
    text: input,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    imageUrl,
  };

  const updatedChat: Group = {
    ...selectedGroup,
    messages: [...selectedGroup.messages, newMsg],
    unreadBy: nextUnread,
  };

  setGroups((prev) => [
    updatedChat,
    ...prev.filter((g) => g.id !== selectedGroup.id),
  ]);
  setSelectedGroup(updatedChat);

  setInput("");
  setFile(null);
};

  /* ---------- グループ作成 ---------- */
  const createGroup = async () => {
    const payload = {
  name: groupNameInput || '新グループ',
  members: [myUid, ...selectedMembers],
  // 作成直後は「自分以外」を未読にする
  unreadBy: [myUid, ...selectedMembers].filter(uid => uid !== myUid),
  company: currentUser.company,
};
    const refDoc = await addDoc(collection(db, 'groups'), payload);
    const newGroup: Group = { id: refDoc.id, ...payload, messages: [] };

    setGroups(prev => [newGroup, ...prev]);
    setSelectedGroup(newGroup);
    setTempMembers(newGroup.members);

    setCreatingGroup(false);
    setGroupNameInput('');
    setSelectedMembers([]);
  };

  /* ---------- 1対1チャット ---------- */
  const createPrivateChat = async () => {
    const target = companyMembers.find(m => m.uid === selectedPrivate);
    if (!target) return;

    const payload = {
  name: target.name,
  members: [myUid, target.uid],
  unreadBy: [target.uid], // 相手だけ未読
  company: currentUser.company,
};
    const refDoc = await addDoc(collection(db, 'groups'), payload);
    const newGroup: Group = { id: refDoc.id, ...payload, messages: [] };

    setGroups(prev => [newGroup, ...prev]);
    setSelectedGroup(newGroup);
    setCreatingPrivateChat(false);
    setSelectedPrivate('');
  };

  /* ---------- Firestore 監視：メッセージ ---------- */
useEffect(() => {
  if (!selectedGroup) return;

  // 閉包のズレを防ぐため groupId をローカルに閉じ込める
  const groupId = selectedGroup.id;

  const q = query(
    collection(db, "messages"),
    where("groupId", "==", groupId),
    orderBy("time", "asc")
  );

  const unsub = onSnapshot(q, (snap) => {
    const msgs: Message[] = snap.docs.map((d) => {
      const data = d.data() as Omit<Message, "id"> & { time?: Timestamp };
      const timeStr =
        data.time instanceof Timestamp
          ? data.time.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : String(data.time ?? "");
      return {
        id: d.id,
        sender: data.sender,
        text: data.text,
        time: timeStr,
        imageUrl: data.imageUrl ?? null,
      };
    });

    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, messages: msgs } : g))
    );

    // 選択中グループなら最新を入れ替え
    if (selectedGroup?.id === groupId) {
      setSelectedGroup((prev) => (prev ? { ...prev, messages: msgs } : prev));
    }
  });

  return unsub;
}, [selectedGroup?.id]); // id だけ依存にすると無駄な再購読が減る

  /* グループ */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'groups'), snap => {
      const fetched: Group[] = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<Group, 'id' | 'messages'>),
        messages: [],
      }));
      setGroups(fetched);
      if (!selectedGroup && fetched.length) setSelectedGroup(fetched[0]);
    });
    return unsub;
  }, []);

  /* ---------- スクロールBottom ---------- */
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedGroup]);

  /* ---------- 並び替え ---------- */
  const sortedGroups = [...groups].sort((a, b) => {
  // time は表示用の文字列に変換済みのため、同一日を想定した簡易比較
  // 本格対応するなら購読時に timeMs も持たせるのがベター
  const aMsg = a.messages[a.messages.length - 1];
  const bMsg = b.messages[b.messages.length - 1];
  const aKey = aMsg ? new Date(`1970-01-01T${String(aMsg.time)}:00`).getTime() : 0;
  const bKey = bMsg ? new Date(`1970-01-01T${String(bMsg.time)}:00`).getTime() : 0;
  return bKey - aKey;
});

  /* ==================== JSX ==================== */
  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* ---------------- サイドバー ---------------- */}
      <aside className="w-1/4 bg-[#1f2e34] p-4 text-white space-y-4">
        <button
          className="w-full py-2 bg-green-600 rounded"
          onClick={() => setCreatingPrivateChat(!creatingPrivateChat)}
        >
          ＋新規チャット
        </button>
        <button
          className="w-full py-2 bg-green-600 rounded"
          onClick={() => setCreatingGroup(!creatingGroup)}
        >
          ＋新規グループチャット
        </button>

        {/* 1対1 モーダル */}
        {creatingPrivateChat && (
          <div className="bg-[#2f3e46] p-2 rounded space-y-1">
            {drivers.map(d => (
              <label key={d.uid} className="block text-sm">
                <input
                  type="radio"
                  name="private"
                  checked={selectedPrivate === d.uid}
                  onChange={() => setSelectedPrivate(d.uid)}
                  className="mr-2"
                />
                {d.name}
              </label>
            ))}
            <button onClick={createPrivateChat} className="mt-2 bg-green-700 px-3 py-1 rounded">
              作成
            </button>
          </div>
        )}

        {/* グループ作成モーダル */}
        {creatingGroup && (
          <div className="bg-[#2f3e46] p-2 rounded space-y-1">
            <input
              value={groupNameInput}
              onChange={e => setGroupNameInput(e.target.value)}
              placeholder="グループ名"
              className="w-full mb-2 px-2 py-1 rounded text-black"
            />
            {drivers.map(d => (
              <label key={d.uid} className="block text-sm">
                <input
                  type="checkbox"
                  checked={selectedMembers.includes(d.uid)}
                  onChange={() =>
                    setSelectedMembers(prev =>
                      prev.includes(d.uid) ? prev.filter(id => id !== d.uid) : [...prev, d.uid],
                    )
                  }
                  className="mr-2"
                />
                {d.name}
              </label>
            ))}
            <button onClick={createGroup} className="mt-2 bg-green-700 px-3 py-1 rounded">
              作成
            </button>
          </div>
        )}

        {/* グループ一覧 */}
        <div className="space-y-2 mt-4">
          {sortedGroups.map(g => (
            <div
              key={g.id}
              onClick={() => {
                setGroups(prev =>
  prev.map(grp =>
    grp.id === g.id
      ? { ...grp, unreadBy: grp.unreadBy.filter(uid => uid !== myUid) }
      : grp,
  ),
);
// Firestore 側へも既読反映（任意だが推奨）
setDoc(doc(db, 'groups', g.id), {
  unreadBy: g.unreadBy.filter(uid => uid !== myUid),
}, { merge: true });

setSelectedGroup(g);
setTempMembers(g.members);
              }}
              className={`p-2 rounded cursor-pointer hover:bg-green-700 ${
                selectedGroup?.id === g.id ? 'bg-green-700' : 'bg-[#2f3e46]'
              }`}
            >
              <div className="flex justify-between">
                <span>{g.name}</span>
                {g.unreadBy?.includes(currentUser.uid) && (
                  <span className="text-xs text-red-500">●</span>
                )}
              </div>
              {g.messages.length > 0 && (
                <p className="text-xs text-gray-300 truncate mt-1">
                  {g.messages[g.messages.length - 1].text}
                </p>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* ---------------- メイン画面 ---------------- */}
      <main className="flex-1 flex flex-col bg-gray-100">
        {/* ヘッダー */}
        {selectedGroup && (
          <header className="bg-white shadow px-6 py-4 flex justify-between items-center">
            {!editingGroupName ? (
              <h2 className="text-lg font-semibold flex items-center">
                {selectedGroup.name}
                <button
                  onClick={() => {
                    setGroupNameInput(selectedGroup.name);
                    setEditingGroupName(true);
                  }}
                  className="ml-2 text-gray-500 hover:text-gray-700"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => setEditingMembers(true)}
                  className="ml-4 text-sm text-blue-500 underline"
                >
                  メンバー編集
                </button>
              </h2>
            ) : (
              <div className="flex items-center space-x-2">
                <input
                  value={groupNameInput}
                  onChange={e => setGroupNameInput(e.target.value)}
                  className="border rounded px-2 py-1"
                />
                <button
                  onClick={async () => {
                    await setDoc(
                      doc(db, 'groups', selectedGroup.id),
                      { name: groupNameInput },
                      { merge: true },
                    );
                    setEditingGroupName(false);
                  }}
                  className="bg-green-600 text-white px-3 py-1 rounded"
                >
                  保存
                </button>
              </div>
            )}

            {/* メンバー一覧 */}
            <div className="text-sm text-gray-600 flex items-center space-x-1">
              <Users size={14} />
              <span>
                {selectedGroup.members
  .map(uid => (uid === myUid ? currentUser.name : companyMembers.find(u => u.uid === uid)?.name ?? 'Unknown'))
  .join(', ')}
              </span>
            </div>
          </header>
        )}

        {/* メンバー編集パネル */}
        {editingMembers && selectedGroup && (
          <section className="bg-gray-200 p-3">
            <p className="font-bold text-sm mb-2">メンバー選択</p>
            {[...admins, ...drivers].map(u => (
              <label key={u.uid} className="block text-sm">
                <input
                  type="checkbox"
                  checked={tempMembers.includes(u.uid)}
                  onChange={() =>
                    setTempMembers(prev =>
                      prev.includes(u.uid) ? prev.filter(id => id !== u.uid) : [...prev, u.uid],
                    )
                  }
                  className="mr-2"
                />
                {u.name}
              </label>
            ))}

            <div className="mt-3 flex gap-2">
              <button
                className="bg-green-600 text-white px-3 py-1 rounded"
                onClick={async () => {
                  await setDoc(doc(db, 'groups', selectedGroup.id), { members: tempMembers }, { merge: true });
                  setEditingMembers(false);
                }}
              >
                保存
              </button>
              <button className="underline" onClick={() => setEditingMembers(false)}>
                キャンセル
              </button>
            </div>
          </section>
        )}

        {/* メッセージリスト */}
        <section className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
          {selectedGroup?.messages.map(m => (
            <div
              key={m.id}
              className={`max-w-lg p-2 px-4 rounded shadow ${
  m.sender === myUid ? 'bg-green-100 self-end' : 'bg-white self-start'
}`}
            >
              {m.imageUrl && <img src={m.imageUrl} alt="attachment" className="w-32 rounded mb-1" />}
              <p className="text-sm whitespace-pre-line">{m.text}</p>
              <p className="text-right text-xs text-gray-500">{m.time}</p>
            </div>
          ))}
          <div ref={chatBottomRef} />
        </section>

        {/* 入力欄 */}
        <footer className="border-t bg-white p-4 flex items-center space-x-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="メッセージを入力..."
            className="flex-1 border rounded px-4 py-2"
          />
          <input
            type="file"
            id="img-upload"
            className="hidden"
            accept="image/*"
            onChange={e => setFile(e.target.files?.[0] || null)} // ③ 型付け対応
          />
          <label htmlFor="img-upload" className="cursor-pointer">
            <ImagePlus size={20} className="text-gray-500 hover:text-gray-800" />
          </label>
          <button onClick={sendMessage} className="bg-green-600 p-2 rounded text-white">
            <SendHorizontal size={20} />
          </button>
        </footer>
      </main>
    </div>
  );
}
