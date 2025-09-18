import React, { createContext, useState, useContext, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if the user is already logged in
    async function loadUserFromStorage() {
      try {
        const token = await SecureStore.getItemAsync('userToken');
        const userId = await SecureStore.getItemAsync('userId');
        const userName = await SecureStore.getItemAsync('userName');
        const isAgent = await SecureStore.getItemAsync('isAgent') === 'true';
        
        if (token && userId && userName) {
          setUser({
            id: parseInt(userId),
            name: userName,
            isAgent,
            token
          });
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadUserFromStorage();
  }, []);

  const logout = async () => {
    try {
      await SecureStore.deleteItemAsync('userToken');
      await SecureStore.deleteItemAsync('userId');
      await SecureStore.deleteItemAsync('userName');
      await SecureStore.deleteItemAsync('isAgent');
      setUser(null);
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const toggleAgentMode = async () => {
    try {
      const updatedUser = { ...user, isAgent: !user.isAgent };
      await SecureStore.setItemAsync('isAgent', updatedUser.isAgent.toString());
      setUser(updatedUser);
    } catch (error) {
      console.error('Error toggling agent mode:', error);
    }
  };

  const value = {
    user,
    setUser,
    loading,
    logout,
    isLoggedIn: !!user,
    toggleAgentMode
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
