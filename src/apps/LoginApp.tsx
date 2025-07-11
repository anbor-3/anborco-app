// src/apps/LoginApp.tsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from '../pages/Login';

const LoginApp = () => {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      {/* 不正なURLはログインに戻すが、"admin" や "driver" などの本来のルートには干渉しない */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

export default LoginApp;