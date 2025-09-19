import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import {
  Text,
  Avatar,
  Card,
  Button,
  Switch,
  Divider,
  TextInput,
  IconButton,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfile, updateUserProfile } from '../services/userService';
import { colors } from '../theme';

// Customer color scheme - friendly and approachable
const customerColors = {
  primary: '#3B82F6', // Bright blue
  secondary: '#8B5CF6', // Purple
  accent: '#F59E0B', // Amber
  background: '#F8FAFC',
  surface: '#FFFFFF',
  text: '#1F2937',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
};

export default function CustomerProfileScreen() {
  const navigation = useNavigation();
  const { user, logout, setCurrentMode } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const profileData = await getUserProfile(user.id);
      setProfile(profileData);
      setName(profileData.name || '');
      setEmail(profileData.email || '');
      setPhone(profileData.phone || '');
      setAddress(profileData.address || '');
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const updatedData = { name, email, phone, address };
      await updateUserProfile(user.id, updatedData);
      setProfile(prev => ({ ...prev, ...updatedData }));
      setEditMode(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const switchToAgentMode = () => {
    console.log('🔄 CustomerProfile: switchToAgentMode called');
    console.log('👤 CustomerProfile: User state:', {
      isAgent: user?.isAgent,
      agentOnboardingCompleted: user?.agentOnboardingCompleted,
      currentMode: user?.currentMode
    });
    
    if (user?.agentOnboardingCompleted) {
      Alert.alert(
        'Switch to Agent Mode',
        'Switch to agent mode to start providing services and earning money.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Switch', 
            onPress: () => {
              console.log('✅ CustomerProfile: Switching to agent mode');
              setCurrentMode('agent');
              Alert.alert('Agent Mode', 'You are now in agent mode!');
            }
          }
        ]
      );
    } else {
      console.log('❌ CustomerProfile: User needs onboarding');
      Alert.alert(
        'Become an Agent',
        'Complete agent onboarding to start providing services and earning money.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Start Onboarding', 
            onPress: () => {
              console.log('📝 CustomerProfile: Starting onboarding');
              navigation.navigate('AgentOnboarding');
            }
          }
        ]
      );
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', onPress: logout }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[customerColors.primary, customerColors.secondary]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Profile</Text>
          <TouchableOpacity onPress={() => setEditMode(!editMode)}>
            <Icon name={editMode ? "close" : "pencil"} size={24} color="white" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Customer Status Card */}
        <Card style={styles.statusCard}>
          <Card.Content>
            <View style={styles.statusRow}>
              <View style={styles.avatarSection}>
                <Avatar.Text 
                  size={80} 
                  label={profile?.name?.charAt(0)?.toUpperCase() || 'C'} 
                  style={[styles.avatar, { backgroundColor: customerColors.primary }]}
                  labelStyle={styles.avatarLabel}
                />
              </View>
              <View style={styles.statusInfo}>
                <Text style={styles.customerName}>{profile?.name || 'Customer Name'}</Text>
                <Text style={styles.statusText}>ClickO Customer</Text>
                <Text style={styles.memberSince}>Member since 2024</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Customer Stats */}
        <Card style={styles.statsCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Your Activity</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>23</Text>
                <Text style={styles.statLabel}>Total Bookings</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>₹2,450</Text>
                <Text style={styles.statLabel}>Total Spent</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>4.9</Text>
                <Text style={styles.statLabel}>Avg Rating</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Personal Information */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            
            {editMode ? (
              <>
                <TextInput
                  label="Full Name"
                  value={name}
                  onChangeText={setName}
                  mode="outlined"
                  style={styles.input}
                  theme={{ colors: { primary: customerColors.primary } }}
                />
                <TextInput
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  mode="outlined"
                  style={styles.input}
                  theme={{ colors: { primary: customerColors.primary } }}
                />
                <TextInput
                  label="Phone"
                  value={phone}
                  onChangeText={setPhone}
                  mode="outlined"
                  style={styles.input}
                  theme={{ colors: { primary: customerColors.primary } }}
                />
                <TextInput
                  label="Address"
                  value={address}
                  onChangeText={setAddress}
                  mode="outlined"
                  multiline
                  style={styles.input}
                  theme={{ colors: { primary: customerColors.primary } }}
                />
                <Button 
                  mode="contained" 
                  onPress={handleSave}
                  loading={loading}
                  style={[styles.saveButton, { backgroundColor: customerColors.primary }]}
                >
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                <View style={styles.infoRow}>
                  <Icon name="account" size={20} color={customerColors.textSecondary} />
                  <Text style={styles.infoText}>{profile?.name || 'Not available'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Icon name="email" size={20} color={customerColors.textSecondary} />
                  <Text style={styles.infoText}>{profile?.email || 'Not available'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Icon name="phone" size={20} color={customerColors.textSecondary} />
                  <Text style={styles.infoText}>{profile?.phone || 'Not available'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Icon name="map-marker" size={20} color={customerColors.textSecondary} />
                  <Text style={styles.infoText}>{profile?.address || 'Not available'}</Text>
                </View>
              </>
            )}
          </Card.Content>
        </Card>

        {/* Preferences */}
        <Card style={styles.preferencesCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Preferences</Text>
            <View style={styles.preferenceRow}>
              <Icon name="bell" size={20} color={customerColors.textSecondary} />
              <Text style={styles.preferenceText}>Push Notifications</Text>
              <Switch value={true} color={customerColors.primary} />
            </View>
            <View style={styles.preferenceRow}>
              <Icon name="email" size={20} color={customerColors.textSecondary} />
              <Text style={styles.preferenceText}>Email Updates</Text>
              <Switch value={false} color={customerColors.primary} />
            </View>
          </Card.Content>
        </Card>

        {/* Favorite Services */}
        <Card style={styles.favoritesCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Favorite Services</Text>
            <View style={styles.servicesList}>
              <View style={styles.serviceChip}>
                <Text style={styles.serviceText}>Home Cleaning</Text>
              </View>
              <View style={styles.serviceChip}>
                <Text style={styles.serviceText}>Plumbing</Text>
              </View>
              <View style={styles.serviceChip}>
                <Text style={styles.serviceText}>Electrical</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Agent Mode */}
        <Card style={styles.agentCard}>
          <Card.Content>
            <View style={styles.agentRow}>
              <View style={styles.agentInfo}>
                <Text style={styles.agentTitle}>
                  {user?.agentOnboardingCompleted ? 'Switch to Agent Mode' : 'Become a Service Provider'}
                </Text>
                <Text style={styles.agentSubtitle}>
                  {user?.agentOnboardingCompleted 
                    ? 'Start providing services and earning money' 
                    : 'Join thousands of agents earning extra income'
                  }
                </Text>
              </View>
              <Button 
                mode="contained" 
                onPress={switchToAgentMode}
                style={[styles.agentButton, { backgroundColor: customerColors.accent }]}
              >
                {user?.agentOnboardingCompleted ? 'Switch Mode' : 'Get Started'}
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Actions */}
        <Card style={styles.actionsCard}>
          <Card.Content>
            <Button 
              mode="contained" 
              icon="history"
              onPress={() => navigation.navigate('BookingHistory')}
              style={[styles.actionButton, { backgroundColor: customerColors.primary }]}
            >
              Booking History
            </Button>
            <Button 
              mode="contained" 
              icon="help-circle"
              onPress={() => {}}
              style={[styles.actionButton, { backgroundColor: customerColors.secondary }]}
            >
              Help & Support
            </Button>
            <Button 
              mode="outlined" 
              icon="logout"
              onPress={handleLogout}
              style={[styles.actionButton, styles.logoutButton, { borderColor: customerColors.error }]}
              labelStyle={{ color: customerColors.error }}
            >
              Logout
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: customerColors.background,
  },
  header: {
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  statusCard: {
    marginBottom: 16,
    backgroundColor: customerColors.surface,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarSection: {
    marginRight: 16,
  },
  avatar: {
    elevation: 4,
  },
  avatarLabel: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  statusInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: customerColors.text,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 14,
    color: customerColors.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  memberSince: {
    fontSize: 12,
    color: customerColors.textSecondary,
  },
  statsCard: {
    marginBottom: 16,
    backgroundColor: customerColors.surface,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: customerColors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: customerColors.textSecondary,
    marginTop: 4,
  },
  infoCard: {
    marginBottom: 16,
    backgroundColor: customerColors.surface,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: customerColors.text,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 16,
    color: customerColors.text,
    marginLeft: 12,
    flex: 1,
  },
  input: {
    marginBottom: 12,
  },
  saveButton: {
    marginTop: 8,
  },
  preferencesCard: {
    marginBottom: 16,
    backgroundColor: customerColors.surface,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  preferenceText: {
    fontSize: 16,
    color: customerColors.text,
    marginLeft: 12,
    flex: 1,
  },
  favoritesCard: {
    marginBottom: 16,
    backgroundColor: customerColors.surface,
  },
  servicesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  serviceChip: {
    backgroundColor: customerColors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  serviceText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  agentCard: {
    marginBottom: 16,
    backgroundColor: customerColors.surface,
    borderColor: customerColors.accent,
    borderWidth: 1,
  },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  agentInfo: {
    flex: 1,
    marginRight: 16,
  },
  agentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: customerColors.text,
    marginBottom: 4,
  },
  agentSubtitle: {
    fontSize: 14,
    color: customerColors.textSecondary,
  },
  agentButton: {
    minWidth: 100,
  },
  actionsCard: {
    marginBottom: 32,
    backgroundColor: customerColors.surface,
  },
  actionButton: {
    marginBottom: 12,
  },
  logoutButton: {
    backgroundColor: 'transparent',
  },
});