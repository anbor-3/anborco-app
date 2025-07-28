import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PasswordReset from "./pages/PasswordReset";

import LoginApp from './apps/LoginApp';
import AdminApp from './apps/AdminApp';
import DriverApp from './apps/DriverApp';
import MasterApp from './apps/MasterApp'; // ✅ これが /master に対応

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="/driver/*" element={<DriverApp />} />
        <Route path="/master/*" element={<MasterApp />} />   {/* ✅ これが必要 */}
        <Route path="/*" element={<LoginApp />} />
        <Route path="/reset" element={<PasswordReset />} />
      </Routes>
    </Router>
  );
}
