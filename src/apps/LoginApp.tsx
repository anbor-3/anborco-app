import { Routes, Route, Navigate } from 'react-router-dom';
import Login from '../pages/Login';

const LoginApp = () => {
  return (
    // ✅ 完全固定幅用の app-container を適用
    <div className="login-container">
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
};

export default LoginApp;
