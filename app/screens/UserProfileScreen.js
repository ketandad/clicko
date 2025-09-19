import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { Text, Button, TextInput, Divider, ActivityIndicator, Appbar, Switch, Avatar } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfile, updateUserProfile, updateUserAddress, getCurrentUser } from '../services/userService';
import { getAgentStats } from '../services/agentService';
import { colors } from '../theme';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function UserProfileScreen({ navigation }) {
  const { user, logout, handleTokenExpiration, toggleAgentMode, setCurrentMode, resetAgentOnboarding } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [profileImage, setProfileImage] = useState(null);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);

  // Agent stats state
  const [agentStats, setAgentStats] = useState({
    todayEarnings: 0,
    rating: 0,
    totalRatings: 0,
    completedServices: 0,
    totalBookings: 0,
    favoriteServices: 'None yet'
  });

  useEffect(() => {
    if (user && user.id) {
      loadUserProfile();
      // Load agent stats if user is an agent
      if (user.isAgent) {
        loadAgentStats();
      }
    } else {
      console.log('DEBUG: No user or user ID available, skipping profile load');
      setLoading(false);
    }
  }, [user]);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      console.log('DEBUG: Loading profile for user:', user);
      console.log('DEBUG: User ID:', user?.id);
      
      if (!user || !user.id) {
        throw new Error('No user ID available');
      }
      
      let userProfile;
      try {
        // First try to get specific user profile
        userProfile = await getUserProfile(user.id);
        console.log('DEBUG: Profile loaded via getUserProfile:', userProfile);
      } catch (profileError) {
        console.log('DEBUG: getUserProfile failed, trying getCurrentUser:', profileError);
        // If that fails, try getCurrentUser as fallback
        userProfile = await getCurrentUser();
        console.log('DEBUG: Profile loaded via getCurrentUser:', userProfile);
      }
      
      setProfile(userProfile);
      
      // Set form fields
      setName(userProfile.name || '');
      setEmail(userProfile.email || '');
      setPhone(userProfile.phone || '');
      setAddress(userProfile.address || '');
      setProfileImage(userProfile.profile_image_url || null);
      setEmailNotifications(userProfile.email_notifications !== false);
      setPushNotifications(userProfile.push_notifications !== false);
    } catch (error) {
      console.error('Error loading user profile:', error);
      console.error('Error details:', error.response?.data || error.message);
      console.error('Error status:', error.response?.status);
      
      // Handle token expiration specifically
      if (error.response?.status === 401) {
        console.log('🚨 UserProfileScreen: Authentication failed, handling token expiration');
        Alert.alert(
          'Session Expired', 
          'Your session has expired. Please login again.',
          [
            {
              text: 'Login Again',
              onPress: () => handleTokenExpiration()
            }
          ]
        );
        return;
      }
      
      // Provide more specific error messaging for other errors
      let errorMessage = 'Failed to load profile information.';
      if (error.response?.status === 404) {
        errorMessage = 'Profile not found.';
      } else if (error.message?.includes('Network')) {
        errorMessage = 'Network connection failed. Please check your internet connection.';
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const loadAgentStats = async () => {
    try {
      console.log('📊 ProfileScreen: Loading agent stats...');
      const stats = await getAgentStats();
      
      setAgentStats({
        todayEarnings: stats.today_earnings || 0,
        rating: stats.avg_rating || 0,
        totalRatings: stats.total_bookings || 0, // Using total bookings as proxy for ratings
        completedServices: stats.total_bookings || 0,
        totalBookings: stats.total_bookings || 0,
        favoriteServices: 'None yet' // This would come from user preferences
      });
      
      console.log('✅ ProfileScreen: Agent stats loaded successfully');
    } catch (error) {
      console.error('❌ ProfileScreen: Error loading agent stats:', error);
      // Keep default values on error
    }
  };

  const handleUpdateProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    try {
      setUpdating(true);
      
      const updatedProfile = {
        name,
        phone,
        email_notifications: emailNotifications,
        push_notifications: pushNotifications,
      };

      // Only update address if it has changed
      if (address !== (profile?.address || '')) {
        await updateUserAddress(user.id, address);
      }

      const result = await updateUserProfile(user.id, updatedProfile);
      setProfile({ ...profile, ...result });
      setEditMode(false);
      
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'You need to grant access to your photos to change profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
      // In a real app, you would upload this image to your server here
      // and update the profileImage URL after successful upload
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: () => logout()
        }
      ]
    );
  };

  const handleAgentModeToggle = async () => {
    try {
      if (!user?.isAgent) {
        // Switching to agent mode
        if (user?.agentOnboardingCompleted) {
          // Already onboarded - just switch mode
          Alert.alert(
            'Switch to Agent Mode',
            'Switch to agent mode to start receiving service requests.',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Switch', 
                onPress: () => {
                  setCurrentMode('agent');
                  Alert.alert(
                    'Agent Mode Activated',
                    'You are now in agent mode and can receive service requests!',
                    [{ text: 'OK' }]
                  );
                }
              }
            ]
          );
        } else {
          // Need onboarding first
          Alert.alert(
            'Switch to Agent Mode',
            'Complete agent onboarding to start providing services and earning money.',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Start Onboarding', 
                onPress: () => navigation.navigate('AgentOnboarding')
              }
            ]
          );
        }
      } else {
        // Switching to customer mode
        Alert.alert(
          'Switch to Customer Mode',
          'You will no longer receive service requests. You can switch back anytime.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Switch', 
              onPress: () => {
                setCurrentMode('user');
                Alert.alert(
                  'Customer Mode Activated',
                  'You are now in customer mode.',
                  [{ text: 'OK' }]
                );
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error toggling agent mode:', error);
      Alert.alert('Error', 'Failed to switch mode. Please try again.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!user || !user.id) {
    return (
      <View style={styles.loadingContainer}>
        <Icon name="account-alert" size={64} color={colors.error} />
        <Text style={styles.errorText}>User information not available</Text>
        <Button mode="contained" onPress={() => logout()}>
          Login Again
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Profile" />
        <Appbar.Action 
          icon={editMode ? "close" : "pencil"} 
          onPress={() => setEditMode(!editMode)} 
        />
      </Appbar.Header>

      <ScrollView style={styles.scrollView}>
        <View style={styles.profileHeader}>
          <TouchableOpacity 
            style={styles.profileImageContainer} 
            onPress={editMode ? pickImage : undefined}
            disabled={!editMode}
          >
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.profileImage} />
            ) : (
              <Avatar.Text 
                size={100} 
                label={name.substring(0, 2).toUpperCase()} 
                backgroundColor={colors.primary} 
              />
            )}
            {editMode && (
              <View style={styles.editImageOverlay}>
                <Icon name="camera" size={24} color="white" />
              </View>
            )}
          </TouchableOpacity>

          {!editMode && profile ? (
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{profile.name || 'Name not available'}</Text>
              <Text style={styles.userEmail}>{profile.email || 'Email not available'}</Text>
              {user?.isAgent && user?.walletBalance !== undefined && (
                <View style={styles.walletInfo}>
                  <Icon name="wallet" size={20} color={colors.primary} />
                  <Text style={styles.walletBalance}>₹{user.walletBalance}</Text>
                </View>
              )}
            </View>
          ) : null}
        </View>

        <View style={styles.formContainer}>
          {editMode ? (
            <>
              <TextInput
                label="Full Name"
                value={name}
                onChangeText={setName}
                mode="outlined"
                style={styles.input}
              />
              <TextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                mode="outlined"
                style={styles.input}
                disabled={true}
                dense
              />
              <TextInput
                label="Phone"
                value={phone}
                onChangeText={setPhone}
                mode="outlined"
                style={styles.input}
                keyboardType="phone-pad"
              />
              <TextInput
                label="Address"
                value={address}
                onChangeText={setAddress}
                mode="outlined"
                style={styles.input}
                multiline
              />

              <View style={styles.notificationSection}>
                <Text style={styles.sectionTitle}>Notifications</Text>
                <View style={styles.settingRow}>
                  <Text>Email Notifications</Text>
                  <Switch
                    value={emailNotifications}
                    onValueChange={setEmailNotifications}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.settingRow}>
                  <Text>Push Notifications</Text>
                  <Switch
                    value={pushNotifications}
                    onValueChange={setPushNotifications}
                    color={colors.primary}
                  />
                </View>
              </View>

              <Button
                mode="contained"
                onPress={handleUpdateProfile}
                style={styles.updateButton}
                loading={updating}
                disabled={updating}
              >
                Update Profile
              </Button>
            </>
          ) : (
            <>
              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Contact Information</Text>
                <View style={styles.infoRow}>
                  <Icon name="phone" size={20} color={colors.textSecondary} />
                  <Text style={styles.infoText}>{profile?.phone || 'No phone number added'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Icon name="email" size={20} color={colors.textSecondary} />
                  <Text style={styles.infoText}>{profile?.email || 'No email available'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Icon name="map-marker" size={20} color={colors.textSecondary} />
                  <Text style={styles.infoText}>{profile?.address || 'No address added'}</Text>
                </View>
              </View>

              <Divider style={styles.divider} />

              {user?.isAgent && user?.agentOnboardingCompleted && (
                <>
                  <View style={styles.agentSection}>
                    <Text style={styles.sectionTitle}>Agent Dashboard</Text>
                    <View style={styles.infoRow}>
                      <Icon name="chart-line" size={20} color={colors.primary} />
                      <Text style={styles.infoText}>Today's Earnings: ₹{agentStats.todayEarnings}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Icon name="star" size={20} color={colors.primary} />
                      <Text style={styles.infoText}>Rating: {agentStats.rating} ({agentStats.totalRatings} reviews)</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Icon name="check-circle" size={20} color={colors.primary} />
                      <Text style={styles.infoText}>Completed Services: {agentStats.completedServices}</Text>
                    </View>
                  </View>
                  <Divider style={styles.divider} />
                </>
              )}

              {!user?.isAgent && (
                <>
                  <View style={styles.customerSection}>
                    <Text style={styles.sectionTitle}>Your Activity</Text>
                    <View style={styles.infoRow}>
                      <Icon name="calendar-check" size={20} color={colors.primary} />
                      <Text style={styles.infoText}>Total Bookings: {agentStats.totalBookings}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Icon name="heart" size={20} color={colors.primary} />
                      <Text style={styles.infoText}>Favorite Services: {agentStats.favoriteServices}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Icon name="map-marker" size={20} color={colors.primary} />
                      <Text style={styles.infoText}>Preferred Area: {profile?.address || 'Not set'}</Text>
                    </View>
                  </View>
                  <Divider style={styles.divider} />
                </>
              )}

              <View style={styles.notificationSection}>
                <Text style={styles.sectionTitle}>Notifications</Text>
                <View style={styles.infoRow}>
                  <Icon name="email-outline" size={20} color={colors.textSecondary} />
                  <Text style={styles.infoText}>Email Notifications: {emailNotifications ? 'On' : 'Off'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Icon name="bell-outline" size={20} color={colors.textSecondary} />
                  <Text style={styles.infoText}>Push Notifications: {pushNotifications ? 'On' : 'Off'}</Text>
                </View>
              </View>

              <Divider style={styles.divider} />

              <View style={styles.agentModeSection}>
                <Text style={styles.sectionTitle}>Service Provider Mode</Text>
                <View style={styles.infoRow}>
                  <Icon 
                    name={user?.isAgent ? "account-tie" : "account"} 
                    size={20} 
                    color={user?.isAgent ? colors.primary : colors.textSecondary} 
                  />
                  <View style={styles.agentModeInfo}>
                    <Text style={styles.infoText}>
                      {user?.isAgent ? 'Agent Mode: Active' : 'Customer Mode: Active'}
                    </Text>
                    <Text style={styles.agentModeSubtext}>
                      {user?.agentOnboardingCompleted 
                        ? (user?.isAgent ? 'You can receive service requests' : 'Switch to agent mode to provide services')
                        : 'Complete onboarding to become an agent'
                      }
                    </Text>
                  </View>
                  {user?.agentOnboardingCompleted ? (
                    <Switch
                      value={user?.isAgent || false}
                      onValueChange={() => {
                        if (user?.isAgent) {
                          setCurrentMode('user');
                        } else {
                          setCurrentMode('agent');
                        }
                      }}
                      color={colors.primary}
                    />
                  ) : (
                    <Button 
                      mode="contained" 
                      icon="account-plus" 
                      onPress={() => navigation.navigate('AgentOnboarding')}
                      compact
                      buttonColor={colors.primary}
                      textColor="white"
                    >
                      Become Agent
                    </Button>
                  )}
                </View>

                {/* Debug: Reset Agent State (Temporary) */}
                {user?.agentOnboardingCompleted && !user?.isAgent && (
                  <View style={styles.infoRow}>
                    <Icon name="refresh" size={20} color={colors.warning} />
                    <Button 
                      mode="outlined" 
                      icon="restart" 
                      onPress={() => {
                        Alert.alert(
                          'Reset Agent State',
                          'This will reset your agent onboarding status and allow you to restart the process. Are you sure?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { 
                              text: 'Reset', 
                              style: 'destructive',
                              onPress: async () => {
                                await resetAgentOnboarding();
                                Alert.alert('Success', 'Agent state has been reset. You can now try onboarding again.');
                              }
                            }
                          ]
                        );
                      }}
                      compact
                      buttonColor={colors.warning}
                      textColor={colors.warning}
                      style={{ marginLeft: 10 }}
                    >
                      Reset Agent State
                    </Button>
                  </View>
                )}
              </View>

              <Divider style={styles.divider} />

              <View style={styles.actionsSection}>
                <Button 
                  mode="outlined" 
                  icon="history" 
                  onPress={() => navigation.navigate('BookingHistory')}
                  style={styles.actionButton}
                >
                  Booking History
                </Button>

                <Button 
                  mode="outlined"
                  icon="logout" 
                  onPress={handleLogout}
                  style={[styles.actionButton, styles.logoutButton]}
                  labelStyle={{ color: colors.error }}
                >
                  Logout
                </Button>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: colors.textSecondary,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: 'white',
  },
  profileImageContainer: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  editImageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    alignItems: 'center',
    marginTop: 10,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  userEmail: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 5,
  },
  walletInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  walletBalance: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 6,
    color: colors.primary,
  },
  formContainer: {
    padding: 16,
  },
  input: {
    marginBottom: 16,
    backgroundColor: 'white',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: colors.textPrimary,
  },
  infoSection: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoText: {
    marginLeft: 10,
    fontSize: 16,
    color: colors.textPrimary,
    flex: 1,
  },
  divider: {
    marginVertical: 16,
  },
  notificationSection: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  agentModeSection: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  agentModeInfo: {
    flex: 1,
    marginLeft: 10,
    marginRight: 10,
  },
  agentModeSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  agentSection: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  customerSection: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  updateButton: {
    marginTop: 10,
    paddingVertical: 6,
  },
  actionsSection: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
  },
  actionButton: {
    marginBottom: 12,
  },
  logoutButton: {
    borderColor: colors.error,
  },
});
