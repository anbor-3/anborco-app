import React, { useEffect, useState } from "react";

const DriverProfile = () => {
  const [profile, setProfile] = useState<{
    id: string;
    name: string;
    type: string;
    company: string;
    phone: string;
    address: string;
    birthday: string;
  } | null>(null);

  useEffect(() => {
    const drivers = JSON.parse(localStorage.getItem("driverList") || "[]");

    // ログイン中のドライバー名を取得
    const currentDriverName = localStorage.getItem("loggedInDriver");

    if (!currentDriverName) {
      setProfile(null);
      return;
    }

    const found = drivers.find((d: any) => d.name === currentDriverName);
    setProfile(found || null);
  }, []);

  if (!profile) {
    return (
      <div className="text-red-600">
        プロフィール情報が見つかりません（ログイン情報が未設定か、該当ドライバーが未登録です）。
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto bg-white p-6 rounded shadow space-y-4">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">👤 ドライバープロフィール</h1>
      <div><strong>氏名：</strong>{profile.name}</div>
      <div><strong>所属会社：</strong>{profile.company}</div>
      <div><strong>区分：</strong>{profile.type}</div>
      <div><strong>電話番号：</strong>{profile.phone}</div>
      <div><strong>住所：</strong>{profile.address}</div>
      <div><strong>生年月日：</strong>{profile.birthday}</div>
    </div>
  );
};

export default DriverProfile;
