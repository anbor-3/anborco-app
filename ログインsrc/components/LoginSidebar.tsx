
import React from "react";
import { Lock } from "lucide-react";

const Sidebar = () => (
  <aside className="w-48 bg-gray-700 text-white flex flex-col">
    <div className="p-4 flex items-center space-x-2 hover:bg-gray-600 cursor-pointer">
      <Lock className="w-5 h-5" />
      <span>ログイン</span>
    </div>
  </aside>
);

export default Sidebar;
