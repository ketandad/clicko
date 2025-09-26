import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Image,
  ActivityIndicator,
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
import { checkAgentProfile, getAgentStats } from '../services/agentService';
import { getAgentSubCategories, getAgentCategories } from '../services/agentSubCategoryService';
import * as SecureStore from 'expo-secure-store';
import { colors } from '../theme';
import PhoneInput from '../components/PhoneInput';
import AddressAutocomplete from '../components/AddressAutocomplete';
import PhotoCapture from '../components/PhotoCapture';

// Professional agent color scheme - no green
const agentColors = {
  primary: '#2563EB', // Blue
  secondary: '#7C3AED', // Purple  
  accent: '#DC2626', // Red
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceSecondary: '#F1F5F9', // Light gray for secondary surfaces
  text: '#1E293B',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  success: '#059669', // Teal instead of green
  warning: '#D97706',
  error: '#DC2626',
};

export default function AgentProfileScreen() {
  const navigation = useNavigation();
  const { user, logout, setCurrentMode, setUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [walletBalance, setWalletBalance] = useState(user?.walletBalance || 0);
  const [agentStats, setAgentStats] = useState({
    rating: 0,
    totalRatings: 0,
    completedServices: 0,
    totalEarnings: 0,
  });
  
  // Service management (subcategories + categories)
  const [agentSubCategories, setAgentSubCategories] = useState([]);
  const [agentCategories, setAgentCategories] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  
  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [formattedPhone, setFormattedPhone] = useState('');
  const [addressData, setAddressData] = useState({
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const profileData = await getUserProfile(user.id);
      
      // Check if profileData contains HTML (indicates backend issue)
      if (typeof profileData === 'string' && profileData.includes('<!doctype html>')) {
        console.log('📋 AgentProfile: Received HTML response - backend may not be running');
      } else if (profileData && typeof profileData === 'object') {
        console.log('📋 AgentProfile: Profile data loaded successfully');
        console.log('📞 AgentProfile: Phone number from API:', profileData.phone);
      } else {
        console.log('📋 AgentProfile: Profile data loaded:', profileData);
        console.log('📞 AgentProfile: Phone number from API:', profileData?.phone);
      }
      
      setProfile(profileData);
      setName(profileData.name || '');
      setEmail(profileData.email || '');
      setPhone(profileData.phone || '');
      setFormattedPhone(profileData.formatted_phone || profileData.phone || '');
      setAddress(profileData.address || '');
      
      // Set enhanced address data
      setAddressData({
        addressLine1: profileData.address_line_1 || '',
        addressLine2: profileData.address_line_2 || '',
        city: profileData.city || '',
        state: profileData.state || '',
        postalCode: profileData.postal_code || '',
        country: profileData.country || 'India',
      });
      
      // Set profile photo if available
      if (profileData.profile_photo_url) {
        setProfilePhoto({ uri: profileData.profile_photo_url });
      }
      
      // Fetch latest agent profile data including wallet balance
      if (user?.isAgent) {
        console.log('💰 AgentProfile: Fetching latest wallet balance for user:', user.id);
        try {
          const agentProfile = await checkAgentProfile(user.id);
          if (agentProfile && agentProfile.wallet_balance !== undefined) {
            console.log('💰 AgentProfile: Updated wallet balance:', agentProfile.wallet_balance);
            setWalletBalance(agentProfile.wallet_balance);
            
            // Update the user context with latest wallet balance
            setUser(prevUser => ({
              ...prevUser,
              walletBalance: agentProfile.wallet_balance
            }));
          } else {
            console.log('💰 AgentProfile: No agent profile found or no wallet balance');
          }

          // Load agent statistics
          loadAgentStats();
          
          // Load agent services
          loadServices();
        } catch (error) {
          console.error('❌ AgentProfile: Error fetching wallet balance:', error);
          console.log('🔧 AgentProfile: Using cached wallet balance');
          // Continue with cached balance if network fails
          
          // Still load agent statistics even if wallet balance fails
          loadAgentStats();
        }
      }
      
      // Load agent statistics if user is an agent
      if (user?.isAgent) {
        loadAgentStats();
        loadServices();
      }
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

  const loadAgentStats = async () => {
    if (user?.isAgent && user.id) {
      try {
        console.log('📊 AgentProfile: Loading agent stats for user:', user.id);
        const stats = await getAgentStats(user.id);
        console.log('📊 AgentProfile: Received stats:', stats);
        
        setAgentStats({
          rating: stats.avg_rating || 0,
          totalRatings: stats.total_bookings || 0, // Using total bookings as proxy for ratings
          completedServices: stats.total_bookings || 0,
          totalEarnings: stats.total_earnings || 0,
        });
      } catch (error) {
        console.error('❌ AgentProfile: Error loading agent stats:', error);
        // Keep default values (0) on error
      }
    }
  };

  const loadServices = async () => {
    // Get token directly from SecureStore like other services do
    const authToken = await SecureStore.getItemAsync('userToken');
    
    console.log('🔍 AgentProfile: loadServices called', {
      isAgent: user?.isAgent,
      hasAuthToken: !!authToken,
      userId: user?.id
    });
    
    if (user?.isAgent && authToken) {
      try {
        setLoadingServices(true);
        
        // Load subcategories first
        console.log('📞 AgentProfile: Calling getAgentSubCategories...');
        const subCategories = await getAgentSubCategories(authToken);
        console.log('📦 AgentProfile: Received subcategories:', subCategories);
        setAgentSubCategories(subCategories);
        
        // If no subcategories, load main categories as fallback
        if (subCategories.length === 0) {
          console.log('📞 AgentProfile: No subcategories, loading categories...');
          const categories = await getAgentCategories(authToken);
          console.log('📦 AgentProfile: Received categories:', categories);
          setAgentCategories(categories);
        } else {
          console.log('✅ AgentProfile: Found subcategories, clearing categories');
          setAgentCategories([]); // Clear categories if we have subcategories
        }
        
      } catch (error) {
        console.error('❌ AgentProfile: Error loading services:', error);
        // On error, still try to load categories as fallback
        if (authToken) {
          try {
            const categories = await getAgentCategories(authToken);
            setAgentCategories(categories);
          } catch (catError) {
            console.error('❌ AgentProfile: Error loading categories fallback:', catError);
          }
        }
      } finally {
        setLoadingServices(false);
      }
    } else {
      console.log('❌ AgentProfile: Cannot load services - missing requirements:', {
        isAgent: user?.isAgent,
        hasAuthToken: !!authToken
      });
    }
  };



  const handleSave = async () => {
    try {
      setLoading(true);
      const updatedData = { 
        name, 
        email, 
        phone, 
        formatted_phone: formattedPhone,
        address,
        address_line_1: addressData.addressLine1,
        address_line_2: addressData.addressLine2,
        city: addressData.city,
        state: addressData.state,
        postal_code: addressData.postalCode,
        country: addressData.country,
        profile_photo_url: profilePhoto?.uri || '',
      };
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

  const switchToCustomerMode = () => {
    console.log('🔄 AgentProfile: switchToCustomerMode called');
    console.log('👤 AgentProfile: User state:', {
      isAgent: user?.isAgent,
      agentOnboardingCompleted: user?.agentOnboardingCompleted,
      currentMode: user?.currentMode
    });
    
    Alert.alert(
      'Switch to Customer Mode',
      'You will switch to customer mode. You can switch back to agent mode anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Switch', 
          onPress: () => {
            console.log('✅ AgentProfile: Switching to customer mode');
            setCurrentMode('user');
            Alert.alert('Customer Mode', 'You are now in customer mode.');
          }
        }
      ]
    );
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
        colors={[agentColors.primary, agentColors.secondary]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Agent Profile</Text>
          <TouchableOpacity onPress={() => setEditMode(!editMode)}>
            <Icon name={editMode ? "close" : "pencil"} size={24} color="white" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Agent Status Card */}
        <Card style={styles.statusCard}>
          <Card.Content>
            <View style={styles.statusRow}>
              <View style={styles.avatarSection}>
                {profilePhoto ? (
                  <Image
                    source={profilePhoto}
                    style={styles.profileImage}
                    onError={() => setProfilePhoto(null)}
                  />
                ) : (
                  <Avatar.Text 
                    size={80} 
                    label={profile?.name?.charAt(0)?.toUpperCase() || 'A'} 
                    style={[styles.avatar, { backgroundColor: agentColors.primary }]}
                    labelStyle={styles.avatarLabel}
                  />
                )}
                <View style={styles.verifiedBadge}>
                  <Icon name="check-decagram" size={20} color={agentColors.success} />
                </View>
                {editMode && (
                  <TouchableOpacity style={styles.editPhotoButton} onPress={() => {}}>
                    <Icon name="camera" size={16} color="white" />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.statusInfo}>
                <Text style={styles.agentName}>{profile?.name || 'Agent Name'}</Text>
                <View style={styles.ratingRow}>
                  <Icon name="star" size={16} color="#FFD700" />
                  <Text style={styles.rating}>{agentStats.rating} ({agentStats.totalRatings} reviews)</Text>
                </View>
                <Text style={styles.statusText}>Verified Agent</Text>
                <View style={styles.walletRow}>
                  <Icon name="wallet" size={16} color={agentColors.primary} />
                  <Text style={styles.walletBalance}>₹{walletBalance}</Text>
                </View>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Agent Stats */}
        <Card style={styles.statsCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Performance Overview</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{agentStats.completedServices}</Text>
                <Text style={styles.statLabel}>Completed</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>₹{agentStats.totalEarnings}</Text>
                <Text style={styles.statLabel}>Total Earned</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{agentStats.rating}</Text>
                <Text style={styles.statLabel}>Rating</Text>
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
                  theme={{ colors: { primary: agentColors.primary } }}
                />
                <TextInput
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  mode="outlined"
                  style={styles.input}
                  theme={{ colors: { primary: agentColors.primary } }}
                />
                <PhoneInput
                  label="Phone Number"
                  value={phone}
                  onChangeText={(text) => {
                    setPhone(text);
                    setFormattedPhone(text);
                  }}
                  style={styles.input}
                />
                <AddressAutocomplete
                  label="Address"
                  value={address}
                  onAddressSelect={(selectedAddress) => {
                    setAddress(selectedAddress.fullAddress);
                    setAddressData({
                      addressLine1: selectedAddress.addressLine1,
                      addressLine2: selectedAddress.addressLine2,
                      city: selectedAddress.city,
                      state: selectedAddress.state,
                      postalCode: selectedAddress.postalCode,
                      country: selectedAddress.country,
                    });
                  }}
                  style={styles.input}
                />
                <PhotoCapture
                  photoType="profile"
                  photo={profilePhoto}
                  onPhotoCapture={setProfilePhoto}
                  style={styles.photoCapture}
                />
                <Button 
                  mode="contained" 
                  onPress={handleSave}
                  loading={loading}
                  style={[styles.saveButton, { backgroundColor: agentColors.primary }]}
                >
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                <View style={styles.infoRow}>
                  <Icon name="account" size={20} color={agentColors.textSecondary} />
                  <Text style={styles.infoText}>{name || 'Not available'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Icon name="email" size={20} color={agentColors.textSecondary} />
                  <Text style={styles.infoText}>{email || 'Not available'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Icon name="phone" size={20} color={agentColors.textSecondary} />
                  <Text style={styles.infoText}>{formattedPhone || phone || 'No phone number added'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Icon name="map-marker" size={20} color={agentColors.textSecondary} />
                  <View style={styles.addressContainer}>
                    {addressData.addressLine1 ? (
                      <>
                        <Text style={styles.infoText}>{addressData.addressLine1}</Text>
                        {addressData.addressLine2 && (
                          <Text style={styles.infoTextSecondary}>{addressData.addressLine2}</Text>
                        )}
                        <Text style={styles.infoTextSecondary}>
                          {[addressData.city, addressData.state, addressData.postalCode].filter(Boolean).join(', ')}
                        </Text>
                        {addressData.country && addressData.country !== 'India' && (
                          <Text style={styles.infoTextSecondary}>{addressData.country}</Text>
                        )}
                      </>
                    ) : (
                      <Text style={styles.infoText}>{address || 'Not available'}</Text>
                    )}
                  </View>
                </View>
              </>
            )}
          </Card.Content>
        </Card>

        {/* Agent Services */}
        <Card style={styles.servicesCard}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Services</Text>
              <TouchableOpacity 
                onPress={() => navigation.navigate('AgentServiceCRUD')}
                style={styles.editIconButton}
              >
                <Icon name="pencil" size={20} color={agentColors.primary} />
              </TouchableOpacity>
            </View>
            
            {loadingServices ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={agentColors.primary} />
                <Text style={styles.loadingText}>Loading services...</Text>
              </View>
            ) : agentSubCategories.length > 0 ? (
              // Show subcategories
              <View style={styles.servicesList}>
                {agentSubCategories.map((subCategory) => (
                  <View key={subCategory.id} style={styles.serviceChip}>
                    <View style={styles.serviceInfo}>
                      <Text style={styles.serviceText}>{subCategory.name}</Text>
                      <Text style={styles.categoryText}>{subCategory.category_name}</Text>
                      {subCategory.has_pricing && (
                        <View style={styles.pricingIndicator}>
                          <Icon name="currency-usd" size={12} color={agentColors.success} />
                          <Text style={styles.pricingText}>Priced</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ) : agentCategories.length > 0 ? (
              // Show main categories as fallback
              <View style={styles.servicesList}>
                {agentCategories.map((category) => (
                  <View key={category.id} style={styles.serviceChip}>
                    <View style={styles.serviceInfo}>
                      <Text style={styles.serviceText}>{category.name}</Text>
                      <Text style={styles.categoryText}>Main Category</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Icon name="briefcase-outline" size={48} color={agentColors.textSecondary} />
                <Text style={styles.emptyStateTitle}>No Services Added</Text>
                <Text style={styles.emptyStateText}>
                  Tap the edit icon above to add and manage your services
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Mode Switch */}
        <Card style={styles.modeCard}>
          <Card.Content>
            <View style={styles.modeRow}>
              <View style={styles.modeInfo}>
                <Text style={styles.modeTitle}>Agent Mode Active</Text>
                <Text style={styles.modeSubtitle}>Receiving service requests</Text>
              </View>
              <Button 
                mode="outlined" 
                onPress={switchToCustomerMode}
                style={[styles.switchButton, { borderColor: agentColors.primary }]}
                labelStyle={{ color: agentColors.primary }}
              >
                Switch to Customer
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Actions */}
        <Card style={styles.actionsCard}>
          <Card.Content>
            <Button 
              mode="outlined" 
              icon="logout"
              onPress={handleLogout}
              style={[styles.mainActionButton, styles.logoutButton, { borderColor: agentColors.error }]}
              labelStyle={{ color: agentColors.error }}
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
    backgroundColor: agentColors.background,
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
    backgroundColor: agentColors.surface,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarSection: {
    position: 'relative',
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
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 2,
  },
  statusInfo: {
    flex: 1,
  },
  agentName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: agentColors.text,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  rating: {
    fontSize: 14,
    color: agentColors.textSecondary,
    marginLeft: 4,
  },
  statusText: {
    fontSize: 14,
    color: agentColors.success,
    fontWeight: '600',
    marginBottom: 8,
  },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletBalance: {
    fontSize: 16,
    fontWeight: 'bold',
    color: agentColors.primary,
    marginLeft: 4,
  },
  statsCard: {
    marginBottom: 16,
    backgroundColor: agentColors.surface,
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
    color: agentColors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: agentColors.textSecondary,
    marginTop: 4,
  },
  infoCard: {
    marginBottom: 16,
    backgroundColor: agentColors.surface,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: agentColors.text,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 16,
    color: agentColors.text,
    marginLeft: 12,
    flex: 1,
  },
  input: {
    marginBottom: 12,
  },
  saveButton: {
    marginTop: 8,
  },
  servicesCard: {
    marginBottom: 16,
    backgroundColor: agentColors.surface,
  },
  servicesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  serviceChip: {
    backgroundColor: agentColors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  serviceText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  modeCard: {
    marginBottom: 16,
    backgroundColor: agentColors.surface,
  },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modeInfo: {
    flex: 1,
  },
  modeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: agentColors.text,
  },
  modeSubtitle: {
    fontSize: 14,
    color: agentColors.textSecondary,
  },
  switchButton: {
    marginLeft: 16,
  },
  actionsCard: {
    marginBottom: 32,
    backgroundColor: agentColors.surface,
  },
  mainActionButton: {
    marginBottom: 12,
  },
  logoutButton: {
    backgroundColor: 'transparent',
  },
  // New styles for enhanced profile features
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    elevation: 4,
  },
  editPhotoButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: agentColors.primary,
    borderRadius: 12,
    padding: 4,
  },
  addressContainer: {
    flex: 1,
    marginLeft: 12,
  },
  infoTextSecondary: {
    fontSize: 14,
    color: agentColors.textSecondary,
    marginTop: 2,
  },
  photoCapture: {
    marginVertical: 12,
  },
  // New service management styles
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  editIconButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: agentColors.surface,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerButton: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginLeft: 8,
  },
  serviceChip: {
    backgroundColor: agentColors.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: agentColors.border,
  },
  serviceChipContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceText: {
    fontSize: 16,
    fontWeight: '600',
    color: agentColors.text,
    marginBottom: 2,
  },
  categoryText: {
    fontSize: 12,
    color: agentColors.textSecondary,
    marginBottom: 4,
  },
  pricingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pricingText: {
    fontSize: 11,
    color: agentColors.success,
    marginLeft: 4,
    fontWeight: '500',
  },
  serviceActions: {
    flexDirection: 'row',
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  pricingButton: {
    backgroundColor: agentColors.success,
  },
  addPricingButton: {
    backgroundColor: agentColors.background,
    borderWidth: 1,
    borderColor: agentColors.primary,
  },
  removeButton: {
    backgroundColor: agentColors.error,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: agentColors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: agentColors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  addFirstServiceButton: {
    paddingHorizontal: 24,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginLeft: 8,
    color: agentColors.textSecondary,
  },


  upgradeText: {
    fontSize: 13,
    color: agentColors.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 18,
  },
  upgradeButton: {
    paddingHorizontal: 16,
  },
});