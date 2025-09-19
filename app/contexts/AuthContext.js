import React, { createContext, useState, useContext, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { checkAgentProfile } from '../services/agentService';

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
        console.log('🔍 AuthContext: Loading user from storage...');
        const token = await SecureStore.getItemAsync('userToken');
        const userId = await SecureStore.getItemAsync('userId');
        const userName = await SecureStore.getItemAsync('userName');
        const isAgent = await SecureStore.getItemAsync('isAgent') === 'true';
        const agentOnboardingCompleted = await SecureStore.getItemAsync('agentOnboardingCompleted') === 'true';
        const walletBalance = parseInt(await SecureStore.getItemAsync('walletBalance') || '0');
        const currentMode = await SecureStore.getItemAsync('currentMode') || 'user';
        
        console.log('📦 AuthContext: Stored data -', {
          hasToken: !!token,
          userId,
          userName,
          isAgent,
          agentOnboardingCompleted,
          walletBalance
        });
        
        if (token && userId && userName) {
          const userData = {
            id: parseInt(userId),
            name: userName,
            isAgent: currentMode === 'agent', // User can be in agent mode, but capabilities depend on onboarding
            agentOnboardingCompleted,
            walletBalance,
            currentMode,
            token
          };
          console.log('✅ AuthContext: User restored from storage:', userData);
          setUser(userData);
        } else {
          console.log('❌ AuthContext: No valid user data found in storage');
        }
      } catch (error) {
        console.error('❌ AuthContext: Error loading user data:', error);
      } finally {
        console.log('✅ AuthContext: Loading complete, setting loading to false');
        setLoading(false);
      }
    }
    
    loadUserFromStorage();
  }, []);

  const login = async (userData) => {
    try {
      console.log('🔐 AuthContext: Login called with userData:', userData);
      
      // Check if user has existing agent profile in database
      const agentProfile = await checkAgentProfile(userData.id);
      const hasAgentProfile = agentProfile !== null;
      
      console.log('👤 AuthContext: Agent profile check:', { hasAgentProfile, agentProfile });
      
      // Update userData with actual agent status from database
      const enhancedUserData = {
        ...userData,
        agentOnboardingCompleted: hasAgentProfile || userData.agentOnboardingCompleted || false,
        walletBalance: agentProfile?.wallet_balance || userData.walletBalance || 0,
      };
      
      // Store user data in SecureStore
      await SecureStore.setItemAsync('userToken', enhancedUserData.token || '');
      await SecureStore.setItemAsync('userId', (enhancedUserData.id || '').toString());
      await SecureStore.setItemAsync('userName', enhancedUserData.name || '');
      await SecureStore.setItemAsync('isAgent', (enhancedUserData.isAgent || false).toString());
      await SecureStore.setItemAsync('agentOnboardingCompleted', (enhancedUserData.agentOnboardingCompleted || false).toString());
      await SecureStore.setItemAsync('walletBalance', (enhancedUserData.walletBalance || 0).toString());
      await SecureStore.setItemAsync('currentMode', enhancedUserData.currentMode || 'user');
      
      console.log('💾 AuthContext: User data stored successfully');
      
      // Update state
      setUser(enhancedUserData);
      console.log('✅ AuthContext: User state updated with agent status');
    } catch (error) {
      console.error('❌ AuthContext: Error in login:', error);
      throw error;
    }
  };

  const handleTokenExpiration = async () => {
    try {
      console.log('🚨 AuthContext: Token expired, logging out user');
      await logout();
    } catch (error) {
      console.error('❌ AuthContext: Error handling token expiration:', error);
    }
  };

  const logout = async () => {
    try {
      console.log('🚪 AuthContext: Logout called');
      await SecureStore.deleteItemAsync('userToken');
      await SecureStore.deleteItemAsync('userId');
      await SecureStore.deleteItemAsync('userName');
      await SecureStore.deleteItemAsync('isAgent');
      await SecureStore.deleteItemAsync('agentOnboardingCompleted');
      await SecureStore.deleteItemAsync('walletBalance');
      await SecureStore.deleteItemAsync('currentMode');
      setUser(null);
      console.log('✅ AuthContext: Logout complete');
    } catch (error) {
      console.error('❌ AuthContext: Error during logout:', error);
    }
  };

  const toggleAgentMode = async () => {
    try {
      const updatedUser = { ...user, isAgent: !user.isAgent };
      await SecureStore.setItemAsync('isAgent', updatedUser.isAgent.toString());
      await SecureStore.setItemAsync('currentMode', updatedUser.isAgent ? 'agent' : 'user');
      setUser(updatedUser);
      console.log('🔄 AuthContext: Mode toggled to:', updatedUser.isAgent ? 'agent' : 'user');
    } catch (error) {
      console.error('Error toggling agent mode:', error);
    }
  };

  const setCurrentMode = async (mode) => {
    try {
      const isAgent = mode === 'agent';
      
      // Always check for agent profile when switching to agent mode
      let walletBalance = user?.walletBalance || 0;
      let agentOnboardingCompleted = user?.agentOnboardingCompleted || false;
      
      if (isAgent) {
        console.log('🏦 AuthContext: Checking for agent profile...');
        try {
          const agentProfile = await checkAgentProfile(user.id);
          if (agentProfile) {
            walletBalance = agentProfile.wallet_balance;
            agentOnboardingCompleted = true; // If agent profile exists, onboarding is complete
            console.log('💰 AuthContext: Found agent profile with wallet balance:', walletBalance);
          } else {
            console.log('❌ AuthContext: No agent profile found - user needs onboarding');
          }
        } catch (error) {
          console.error('❌ AuthContext: Error checking agent profile:', error);
          console.log('🔧 AuthContext: Continuing with cached values due to network error');
          // Continue with cached values if network fails
        }
      }
      
      const updatedUser = { 
        ...user, 
        isAgent,
        currentMode: mode,
        walletBalance: walletBalance,
        agentOnboardingCompleted: agentOnboardingCompleted
      };
      await SecureStore.setItemAsync('isAgent', isAgent.toString());
      await SecureStore.setItemAsync('currentMode', mode);
      await SecureStore.setItemAsync('agentOnboardingCompleted', agentOnboardingCompleted.toString());
      await SecureStore.setItemAsync('walletBalance', walletBalance.toString());
      setUser(updatedUser);
      console.log('🎯 AuthContext: Current mode set to:', mode);
      console.log('📊 AuthContext: User state after mode change:', {
        isAgent: updatedUser.isAgent,
        agentOnboardingCompleted: updatedUser.agentOnboardingCompleted,
        currentMode: updatedUser.currentMode,
        walletBalance: updatedUser.walletBalance
      });
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
      console.log('✅ AuthContext: Agent onboarding completed with ₹1000 welcome bonus');
    } catch (error) {
      console.error('Error completing agent onboarding:', error);
    }
  };

  const resetAgentOnboarding = async () => {
    try {
      console.log('🔄 AuthContext: Resetting agent onboarding state');
      const updatedUser = { 
        ...user, 
        agentOnboardingCompleted: false, 
        isAgent: false,
        currentMode: 'user',
        walletBalance: 0
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
    completeAgentOnboarding,
    resetAgentOnboarding
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
