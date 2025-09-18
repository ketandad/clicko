import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      verifyToken();
    } else {
      setLoading(false);
    }
  }, []);

  async function verifyToken() {
    try {
      const response = await api.get('/admin/verify-token');
      setCurrentUser(response.data);
    } catch (error) {
      logout();
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    try {
      const response = await api.post('/admin/login', { email, password });
      const { token, user } = response.data;
      localStorage.setItem('adminToken', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setCurrentUser(user);
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  }

  function logout() {
    localStorage.removeItem('adminToken');
    delete api.defaults.headers.common['Authorization'];
    setCurrentUser(null);
  }

  const value = {
    currentUser,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
