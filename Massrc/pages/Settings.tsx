
import React, { useState } from 'react';

const Settings = () => {
  const [selected, setSelected] = useState('driver');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">画面構成の設定</h1>
      <p className="mb-4">以下の画面ごとに構成変更ができます。</p>
      <div className="flex space-x-4 mb-6">
        <button
          className={`px-4 py-2 rounded ${selected === 'driver' ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setSelected('driver')}
        >
          ドライバー画面
        </button>
        <button
          className={`px-4 py-2 rounded ${selected === 'admin' ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setSelected('admin')}
        >
          管理者画面
        </button>
        <button
          className={`px-4 py-2 rounded ${selected === 'master' ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setSelected('master')}
        >
          マスター画面
        </button>
      </div>
      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-xl font-bold mb-2">
          {selected === 'driver' ? 'ドライバー' : selected === 'admin' ? '管理者' : 'マスター'} 画面の構成
        </h2>
        <p className="text-sm text-gray-700">このセクションでは、選択中の画面に表示する項目や構成を設定できます（将来拡張予定）。</p>
      </div>
    </div>
  );
};

export default Settings;
