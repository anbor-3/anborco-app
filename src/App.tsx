// src/App.tsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import PasswordReset from "./pages/PasswordReset";
import LoginApp from "./apps/LoginApp";
import AdminApp from "./apps/AdminApp";
import DriverApp from "./apps/DriverApp";
import MasterApp from "./apps/MasterApp";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/admin/*"  element={<AdminApp />} />
        <Route path="/driver/*" element={<DriverApp />} />
        <Route path="/master/*" element={<MasterApp />} />
        <Route path="/reset"    element={<PasswordReset />} />
        <Route path="/*"        element={<LoginApp />} />
      </Routes>
    </Router>
  );
}
