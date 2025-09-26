import React, { createContext, useState, useContext, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { checkAgentProfile } from '../services/agentService';
import { validateStoredToken } from '../utils/tokenValidation';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleTokenExpiration = async () => {
    try {
      console.log('🚨 AuthContext: Token expired, preserving user mode preferences');
      await logout(true); // Pass true to preserve mode
    } catch (error) {
      console.error('❌ AuthContext: Error handling token expiration:', error);
    }
  };

  const logout = async (preserveMode = false) => {
    try {
      console.log('🚪 AuthContext: Logout called', preserveMode ? '(preserving mode)' : '(clearing all data)');
      await SecureStore.deleteItemAsync('userToken');
      await SecureStore.deleteItemAsync('userId');
      await SecureStore.deleteItemAsync('userName');
      await SecureStore.deleteItemAsync('isAgent');
      await SecureStore.deleteItemAsync('agentOnboardingCompleted');
      await SecureStore.deleteItemAsync('walletBalance');
      
      // Only clear mode on manual logout, preserve it on token expiration
      if (!preserveMode) {
        await SecureStore.deleteItemAsync('currentMode');
      }
      
      setUser(null);
      console.log('✅ AuthContext: Logout complete');
    } catch (error) {
      console.error('❌ AuthContext: Error during logout:', error);
    }
  };

  useEffect(() => {
    // Check if the user is already logged in
    async function loadUserFromStorage() {
      try {
        console.log('🔍 AuthContext: Loading user from storage...');
        
        // First validate the stored token (but only clear if actually expired)
        const tokenValidation = await validateStoredToken();
        if (!tokenValidation.isValid) {
          if (tokenValidation.reason === 'expired') {
            await handleTokenExpiration();
          } else {
            console.log('⚠️ AuthContext: Token validation failed:', tokenValidation.reason);
            // Don't auto-logout for network errors, just proceed with stored data
          }
        }

        const token = await SecureStore.getItemAsync('userToken');
        const userId = await SecureStore.getItemAsync('userId');
        const userName = await SecureStore.getItemAsync('userName');
        const isAgent = await SecureStore.getItemAsync('isAgent');
        const agentOnboardingCompleted = await SecureStore.getItemAsync('agentOnboardingCompleted');
        const walletBalance = await SecureStore.getItemAsync('walletBalance');
        const currentMode = await SecureStore.getItemAsync('currentMode');

        if (token && userId && userName) {
          const userData = {
            id: userId,
            name: userName,
            token,
            isAgent: isAgent === 'true',
            agentOnboardingCompleted: agentOnboardingCompleted === 'true',
            walletBalance: parseInt(walletBalance) || 0,
            // PRESERVE LAST STATE: Use stored mode or default to 'user' for first time
            currentMode: currentMode || 'user'
          };

          console.log(`🎯 AuthContext: Storage restore - isAgent: ${userData.isAgent}, storedMode: ${currentMode}, finalMode: ${userData.currentMode}`);

          // ALWAYS check backend for agent profile (to sync with backend state)
          try {
            console.log('🔍 AuthContext: Checking backend for agent profile (startup verification)...');
            console.log('🔍 DEBUG: Calling checkAgentProfile with userId:', userData.id);
            const agentProfile = await checkAgentProfile(userData.id);
            console.log('🔍 DEBUG: checkAgentProfile returned:', agentProfile);
            if (agentProfile) {
              // User has agent profile in backend - update local state to match
              console.log(`🎯 AuthContext: Found agent profile in backend - Status: ${agentProfile.status}`);
              userData.agentProfile = agentProfile;
              userData.isAgent = true;
              userData.agentOnboardingCompleted = true;
              // PRESERVE user's last chosen mode - don't change it
              // userData.currentMode stays as it was loaded from storage
              
              // Update SecureStore to match backend reality (but preserve mode choice)
              await SecureStore.setItemAsync('isAgent', 'true');
              await SecureStore.setItemAsync('agentOnboardingCompleted', 'true');
              // DON'T change currentMode - preserve user's last choice
              
              console.log(`✅ AuthContext: Local state synced with backend agent profile`);
              console.log(`🎯 DEBUG: Final userData - isAgent: ${userData.isAgent}, agentOnboardingCompleted: ${userData.agentOnboardingCompleted}, currentMode: ${userData.currentMode}`);
            } else {
              console.log('ℹ️ AuthContext: No agent profile found in backend');
            }
          } catch (profileError) {
            console.error('⚠️ AuthContext: Could not load agent profile:', profileError.message);
            // Don't fail login if agent profile check fails
          }

          setUser(userData);
          console.log('✅ AuthContext: User restored from storage:', {
            id: userData.id,
            name: userData.name,
            isAgent: userData.isAgent,
            agentOnboardingCompleted: userData.agentOnboardingCompleted,
            currentMode: userData.currentMode,
            walletBalance: userData.walletBalance
          });
          console.log('🏦 AuthContext: Backend agent check result:', {
            hasAgentProfile: !!userData.agentProfile,
            agentProfile: userData.agentProfile ? userData.agentProfile.status : null
          });
        } else {
          console.log('ℹ️ AuthContext: No valid user data found in storage');
        }
      } catch (error) {
        console.error('❌ AuthContext: Error loading user from storage:', error);
      } finally {
        setLoading(false);
      }
    }

    loadUserFromStorage();
  }, []);

  const login = async (userData) => {
    try {
      console.log('🔐 AuthContext: Login called with user data');
      
      // Store user data in secure storage
      await SecureStore.setItemAsync('userToken', userData.token);
      await SecureStore.setItemAsync('userId', userData.id.toString());
      await SecureStore.setItemAsync('userName', userData.name);
      await SecureStore.setItemAsync('isAgent', (userData.isAgent || false).toString());
      await SecureStore.setItemAsync('agentOnboardingCompleted', (userData.agentOnboardingCompleted || false).toString());
      await SecureStore.setItemAsync('walletBalance', (userData.walletBalance || 0).toString());
      
      // PRESERVE LAST STATE: Only set currentMode if not already stored (first time login)
      const existingMode = await SecureStore.getItemAsync('currentMode');
      const finalMode = existingMode || userData.currentMode || 'user';
      await SecureStore.setItemAsync('currentMode', finalMode);

      // If user is an agent according to login response, update local flags immediately
      if (userData.isAgent) {
        console.log('🎯 AuthContext: User is agent according to login response, updating flags');
        await SecureStore.setItemAsync('agentOnboardingCompleted', 'true');
        userData.agentOnboardingCompleted = true; // Update the object too
      }

      console.log(`🎯 AuthContext: Login mode preservation - isAgent: ${userData.isAgent}, agentOnboardingCompleted: ${userData.agentOnboardingCompleted}, existingMode: ${existingMode}, finalMode: ${finalMode}`);

      setUser(userData);
      console.log('✅ AuthContext: User logged in and data stored');
      return userData;
    } catch (error) {
      console.error('❌ AuthContext: Error during login:', error);
      throw error;
    }
  };

  const updateUserProfile = async (profileData) => {
    try {
      console.log('🔄 AuthContext: Updating user profile with:', profileData);
      const updatedUser = { ...user, ...profileData };
      
      // Update secure storage for specific fields
      if (profileData.agentOnboardingCompleted !== undefined) {
        await SecureStore.setItemAsync('agentOnboardingCompleted', profileData.agentOnboardingCompleted.toString());
      }
      if (profileData.isAgent !== undefined) {
        await SecureStore.setItemAsync('isAgent', profileData.isAgent.toString());
      }
      if (profileData.walletBalance !== undefined) {
        await SecureStore.setItemAsync('walletBalance', profileData.walletBalance.toString());
      }
      if (profileData.currentMode) {
        await SecureStore.setItemAsync('currentMode', profileData.currentMode);
      }
      
      setUser(updatedUser);
      console.log('✅ AuthContext: User profile updated successfully');
    } catch (error) {
      console.error('❌ AuthContext: Error updating user profile:', error);
      throw error;
    }
  };

  const toggleAgentMode = async () => {
    try {
      const newMode = user?.currentMode === 'agent' ? 'user' : 'agent';
      const updatedUser = { ...user, currentMode: newMode };
      await SecureStore.setItemAsync('currentMode', newMode);
      setUser(updatedUser);
      console.log(`🔄 AuthContext: Mode switched to ${newMode}`);
    } catch (error) {
      console.error('Error toggling agent mode:', error);
    }
  };

  const setCurrentMode = async (mode) => {
    try {
      const updatedUser = { ...user, currentMode: mode };
      await SecureStore.setItemAsync('currentMode', mode);
      setUser(updatedUser);
      console.log(`🔄 AuthContext: Mode set to ${mode}`);
    } catch (error) {
      console.error('Error setting current mode:', error);
    }
  };

  const completeAgentOnboarding = async () => {
    try {
      const updatedUser = { 
        ...user, 
        agentOnboardingCompleted: true, 
        isAgent: true,
        walletBalance: 1000 // Welcome bonus
      };
      await SecureStore.setItemAsync('agentOnboardingCompleted', 'true');
      await SecureStore.setItemAsync('isAgent', 'true');
      await SecureStore.setItemAsync('currentMode', 'agent');
      await SecureStore.setItemAsync('walletBalance', '1000');
      setUser(updatedUser);
      console.log('✅ AuthContext: Agent onboarding completed');
    } catch (error) {
      console.error('Error completing agent onboarding:', error);
    }
  };

  const resetAgentOnboarding = async () => {
    try {
      const updatedUser = { 
        ...user, 
        agentOnboardingCompleted: false, 
        isAgent: false,
        walletBalance: 0,
        currentMode: 'user'
      };
      await SecureStore.setItemAsync('agentOnboardingCompleted', 'false');
      await SecureStore.setItemAsync('isAgent', 'false');
      await SecureStore.setItemAsync('currentMode', 'user');
      await SecureStore.setItemAsync('walletBalance', '0');
      setUser(updatedUser);
      console.log('✅ AuthContext: Agent onboarding state reset');
    } catch (error) {
      console.error('Error resetting agent onboarding:', error);
    }
  };

  // Function to manually refresh user state from backend (useful for sync issues)
  const refreshUserState = async () => {
    try {
      if (!user?.id) {
        console.log('⚠️ AuthContext: Cannot refresh - no user ID available');
        return;
      }
      
      console.log('🔄 AuthContext: Manually refreshing user state from backend...');
      const agentProfile = await checkAgentProfile(user.id);
      
      const updatedUser = { ...user };
      if (agentProfile) {
        console.log(`🎯 AuthContext: Agent profile found during refresh - Status: ${agentProfile.status}`);
        updatedUser.agentProfile = agentProfile;
        updatedUser.isAgent = true;
        updatedUser.agentOnboardingCompleted = true;
        // PRESERVE user's current mode choice - don't force agent mode
        updatedUser.currentMode = updatedUser.currentMode || 'user';
        
        // Update SecureStore (but preserve mode choice)
        await SecureStore.setItemAsync('isAgent', 'true');
        await SecureStore.setItemAsync('agentOnboardingCompleted', 'true');
        // Don't force mode change - user can switch manually if they want
      } else {
        console.log('ℹ️ AuthContext: No agent profile found during refresh');
        updatedUser.agentProfile = null;
        updatedUser.isAgent = false;
        updatedUser.agentOnboardingCompleted = false;
      }
      
      setUser(updatedUser);
      console.log('✅ AuthContext: User state refreshed from backend');
      return updatedUser;
    } catch (error) {
      console.error('❌ AuthContext: Error refreshing user state:', error);
      throw error;
    }
  };

  // Developer function to clear ALL cached data (useful when database is cleared)
  const clearAllData = async () => {
    try {
      console.log('🗑️ AuthContext: Clearing ALL cached authentication data');
      await SecureStore.deleteItemAsync('userToken');
      await SecureStore.deleteItemAsync('userId');
      await SecureStore.deleteItemAsync('userName');
      await SecureStore.deleteItemAsync('isAgent');
      await SecureStore.deleteItemAsync('agentOnboardingCompleted');
      await SecureStore.deleteItemAsync('walletBalance');
      await SecureStore.deleteItemAsync('currentMode');
      setUser(null);
      console.log('✅ AuthContext: All cached data cleared - app reset to fresh state');
    } catch (error) {
      console.error('❌ AuthContext: Error clearing all data:', error);
    }
  };

  const value = {
    user,
    setUser,
    loading,
    login,
    logout,
    handleTokenExpiration,
    isLoggedIn: !!user,
    toggleAgentMode,
    setCurrentMode,
    updateUserProfile,
    completeAgentOnboarding,
    resetAgentOnboarding,
    refreshUserState,
    clearAllData
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}