import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { Text, Button, TextInput, Divider, ActivityIndicator, Appbar, Switch, Avatar } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfile, updateUserProfile, updateUserAddress } from '../services/userService';
import { colors } from '../config';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function UserProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
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

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      const userProfile = await getUserProfile(user.id);
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
      Alert.alert('Error', 'Failed to load profile information.');
    } finally {
      setLoading(false);
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
      if (address !== profile.address) {
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
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

          {!editMode ? (
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{profile.name}</Text>
              <Text style={styles.userEmail}>{profile.email}</Text>
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
                  <Text style={styles.infoText}>{profile.phone || 'No phone number added'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Icon name="email" size={20} color={colors.textSecondary} />
                  <Text style={styles.infoText}>{profile.email}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Icon name="map-marker" size={20} color={colors.textSecondary} />
                  <Text style={styles.infoText}>{profile.address || 'No address added'}</Text>
                </View>
              </View>

              <Divider style={styles.divider} />

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
                  icon="account-switch" 
                  onPress={() => navigation.navigate('AgentOnboarding')}
                  style={styles.actionButton}
                >
                  Become an Agent
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
