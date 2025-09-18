import React from 'react';
import { Navigate } from 'react-router-dom';

// Dummy auth check
const isAuthenticated = () => {
  // Replace with actual auth logic
  return localStorage.getItem('token') !== null;
};

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return isAuthenticated() ? <>{children}</> : <Navigate to="/login" />;
};

export default PrivateRoute;