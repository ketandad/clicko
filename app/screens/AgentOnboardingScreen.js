import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  Linking,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Card,
  Chip,
  ProgressBar,
  IconButton,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../contexts/LocationContext';
import { getCategories } from '../services/categoryService';
import { getUserProfile } from '../services/userService';
import * as SecureStore from 'expo-secure-store';
import config from '../config';

// Use config API URL instead of hardcoded
const API_BASE_URL = config.API_URL;

const ONBOARDING_STEPS = [
  { id: 1, title: 'Basic Info', icon: 'account' },
  { id: 2, title: 'Identity Verification', icon: 'card-account-details' },
  { id: 3, title: 'Location Setup', icon: 'map-marker' },
  { id: 4, title: 'Service Categories', icon: 'view-grid' },
  { id: 5, title: 'Complete', icon: 'check-circle' },
];

export default function AgentOnboardingScreen() {
  const navigation = useNavigation();
  const { user, toggleAgentMode, completeAgentOnboarding, setCurrentMode } = useAuth();
  const { selectedLocation } = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    experience: '',
    aadhaarDocument: null,
    location: null,
    detectedAddress: '',
    selectedCategories: [],
  });

  useEffect(() => {
    loadCategories();
    loadUserProfile();
    autoDetectLocation();
  }, []);

  // Auto-detect location from LocationContext
  useEffect(() => {
    if (selectedLocation && selectedLocation.coordinates && !formData.location) {
      console.log('📍 Auto-filling location from LocationContext:', selectedLocation.coordinates);
      updateFormData('location', {
        latitude: selectedLocation.coordinates.latitude,
        longitude: selectedLocation.coordinates.longitude,
      });
    }
  }, [selectedLocation]);

  const loadCategories = async () => {
    try {
      const categoriesData = await getCategories();
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadUserProfile = async () => {
    try {
      if (user?.id) {
        const profile = await getUserProfile(user.id);
        setFormData(prev => ({
          ...prev,
          name: profile.name || user.name || '',
          email: profile.email || '',
          phone: profile.phone || '',
          address: profile.address || '',
        }));
        console.log('✅ Pre-filled user data from profile');
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      // Still pre-fill with available user data
      setFormData(prev => ({
        ...prev,
        name: user?.name || '',
        email: user?.email || '',
      }));
    }
  };

  const autoDetectLocation = async () => {
    try {
      console.log('📍 Auto-detecting location for onboarding...');
      
      // First check if we already have location in selectedLocation
      if (selectedLocation && selectedLocation.coordinates) {
        console.log('📍 Using existing location from LocationContext');
        updateFormData('location', {
          latitude: selectedLocation.coordinates.latitude,
          longitude: selectedLocation.coordinates.longitude,
        });
        return;
      }
      
      // If no existing location, try to get current location
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('📍 Location permission not granted for auto-detection');
        return;
      }

      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      console.log('📍 Auto-detected location coordinates:', location.coords);
      updateFormData('location', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      
    } catch (error) {
      console.log('📍 Auto-location detection failed (will use manual method):', error.message);
      // Don't show error to user, they can still use manual location button
    }
  };

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleClose = () => {
    Alert.alert(
      'Exit Onboarding',
      'Are you sure you want to exit the onboarding process? Your progress will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Exit', 
          style: 'destructive',
          onPress: () => navigation.goBack()
        }
      ]
    );
  };

  const handleNext = async () => {
    if (!validateCurrentStep()) return;
    
    if (currentStep < ONBOARDING_STEPS.length) {
      setCurrentStep(prev => prev + 1);
    } else {
      await completeOnboarding();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 1:
        if (!formData.name || !formData.phone || !formData.email) {
          Alert.alert('Error', 'Please fill all required fields');
          return false;
        }
        return true;
      case 2:
        if (!formData.aadhaarDocument) {
          Alert.alert('Error', 'Please upload your Aadhaar card');
          return false;
        }
        return true;
      case 3:
        if (!formData.location) {
          Alert.alert('Error', 'Please enable location access');
          return false;
        }
        return true;
      case 4:
        if (formData.selectedCategories.length === 0) {
          Alert.alert('Error', 'Please select at least one service category');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      
      if (!result.canceled) {
        updateFormData('aadhaarDocument', result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const requestLocationPermission = async () => {
    try {
      setLocationLoading(true);
      
      // Request permission
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required', 
          'We need access to your location to show you nearby booking requests. Please enable location services in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }

      // Check if location services are enabled
      const locationEnabled = await Location.hasServicesEnabledAsync();
      if (!locationEnabled) {
        Alert.alert(
          'Location Services Disabled',
          'Please enable location services in your device settings to detect your location.',
          [
            { text: 'OK' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }

      // Get current position
      let location;
      try {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          timeout: 15000, // 15 second timeout
        });
      } catch (locationError) {
        console.error('Failed to get location:', locationError);
        Alert.alert(
          'Location Detection Failed',
          'Unable to detect your current location. This could be due to poor GPS signal or network issues. Please try again or move to an area with better signal.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      
      // Get human-readable address
      let detectedAddress = 'Location detected';
      try {
        const geocodeResult = await Location.reverseGeocodeAsync(coords);
        if (geocodeResult && geocodeResult.length > 0) {
          const address = geocodeResult[0];
          const area = address.sublocality || address.district || address.city || 'Unknown Area';
          const city = address.city || address.region || '';
          detectedAddress = city ? `${area}, ${city}` : area;
        }
      } catch (geocodeError) {
        console.error('Geocoding error:', geocodeError);
        detectedAddress = `Location: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
        // Show a warning but don't fail the process
        Alert.alert(
          'Address Lookup Failed',
          'We detected your location but couldn\'t get the address details. Your coordinates have been saved successfully.',
          [{ text: 'OK' }]
        );
      }
      
      // Update form data with both coordinates and address
      updateFormData('location', coords);
      updateFormData('detectedAddress', detectedAddress);
      
      Alert.alert('Success', `Location detected: ${detectedAddress}`);
    } catch (error) {
      console.error('Location error:', error);
      let errorMessage = 'An unexpected error occurred while detecting your location.';
      
      // Check for specific error types
      if (error.message.includes('Network')) {
        errorMessage = 'Network error: Please check your internet connection and try again.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Location detection timed out. Please try again or move to an area with better GPS signal.';
      } else if (error.message.includes('permission')) {
        errorMessage = 'Location permission was denied. Please enable location services in your device settings.';
      }
      
      Alert.alert('Location Error', errorMessage, [{ text: 'OK' }]);
    } finally {
      setLocationLoading(false);
    }
  };

  const toggleCategory = (categoryId) => {
    const selected = formData.selectedCategories;
    if (selected.includes(categoryId)) {
      updateFormData('selectedCategories', selected.filter(id => id !== categoryId));
    } else {
      updateFormData('selectedCategories', [...selected, categoryId]);
    }
  };

  const completeOnboarding = async () => {
    try {
      setLoading(true);
      
      const agentData = {
        ...formData,
        isVerified: true,
        isApproved: true,
        status: 'active',
      };
      
      console.log('Agent onboarding data:', agentData);
      
      // Get authentication token
      const token = await SecureStore.getItemAsync('userToken');
      console.log('🔐 Token retrieved for onboarding:', token ? `Present (${token.substring(0, 20)}...)` : 'Missing');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      // Validate token format
      if (!token.startsWith('eyJ')) {
        console.warn('⚠️ Token does not appear to be a valid JWT:', token.substring(0, 50));
      }
      
      console.log('📡 Making POST request to:', `${API_BASE_URL}/agents/create`);
      
      // Function to make request with retry
      const makeRequestWithRetry = async (retries = 3) => {
        for (let i = 0; i < retries; i++) {
          try {
            console.log(`🔄 Attempt ${i + 1} of ${retries}`);
            
            const requestPayload = {
              name: agentData.name,
              phone: agentData.phone,
              address: agentData.address || 'Not specified',
              experience: agentData.experience || '0-1 years',
              selectedCategories: agentData.selectedCategories,
              location: agentData.location,
              rate_per_km: 20.0
            };
            
            console.log('📤 Request payload:', JSON.stringify(requestPayload, null, 2));
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
            
            const response = await fetch(`${API_BASE_URL}/agents/create`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify(requestPayload),
              signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            console.log('📡 Agent creation response status:', response.status);
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error('❌ Agent creation failed - Raw response:', errorText);
              
              let errorData;
              try {
                errorData = JSON.parse(errorText);
              } catch (parseError) {
                console.error('❌ Failed to parse error response:', parseError);
                throw new Error(`Server error: ${response.status} - ${errorText}`);
              }
              
              console.error('❌ Agent creation failed - Parsed error:', errorData);
              
              // Handle specific error cases
              if (errorData.detail && errorData.detail.includes('already has an agent profile')) {
                // User already has an agent profile - this means onboarding was successful before
                console.log('✅ User already has agent profile, completing onboarding locally');
                return { message: 'Agent profile already exists' };
              }
              
              throw new Error(errorData.detail || 'Failed to create agent profile');
            }
            
            const agentProfile = await response.json();
            console.log('✅ Agent profile created:', agentProfile);
            return agentProfile;
            
          } catch (fetchError) {
            console.log(`❌ Attempt ${i + 1} failed:`, fetchError.message);
            
            if (i === retries - 1) {
              // Last retry failed
              throw fetchError;
            }
            
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1))); // Increasing delay
          }
        }
      };
      
      // Try to create agent profile with retries
      try {
        await makeRequestWithRetry();
        console.log('✅ Agent profile created successfully in backend');
        
        // Only complete onboarding if backend creation succeeds
        await completeAgentOnboarding();
        setCurrentMode('agent'); // Ensure agent mode is active after onboarding
        
        Alert.alert(
          '🎉 Welcome to ClickO!',
          'Congratulations! Your agent profile is ready.\n\n✅ Welcome bonus of ₹1000 added to your wallet!\n🎯 You can now start accepting bookings!',
          [{ 
            text: 'Start Earning', 
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
              });
            }
          }]
        );
        
      } catch (backendError) {
        console.error('❌ Backend agent creation failed:', backendError.message);
        
        Alert.alert(
          'Connection Error',
          'Unable to complete agent registration due to network issues.\n\nPlease check your internet connection and try again.',
          [
            { 
              text: 'Try Again', 
              onPress: () => completeOnboarding() // Retry the whole process
            },
            {
              text: 'Go Back',
              style: 'cancel',
              onPress: () => setCurrentStep(1) // Go back to first step
            }
          ]
        );
        return; // Don't proceed with local onboarding
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
      Alert.alert('Error', 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <ProgressBar 
        progress={currentStep / ONBOARDING_STEPS.length} 
        color="#2196F3" 
        style={styles.progressBar}
      />
      <Text style={styles.progressText}>
        Step {currentStep} of {ONBOARDING_STEPS.length}
      </Text>
    </View>
  );

  const renderBasicInfo = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Basic Information</Text>
      <Text style={styles.stepSubtitle}>Tell us about yourself</Text>
      
      <TextInput
        label="Full Name *"
        value={formData.name}
        onChangeText={(text) => updateFormData('name', text)}
        mode="outlined"
        style={styles.input}
        theme={{ colors: { primary: '#2196F3', text: '#FFFFFF', placeholder: '#888888', background: '#1E1E1E' }}}
        textColor="#FFFFFF"
        outlineColor="#555555"
        activeOutlineColor="#2196F3"
      />
      
      <TextInput
        label="Phone Number *"
        value={formData.phone}
        onChangeText={(text) => updateFormData('phone', text)}
        mode="outlined"
        keyboardType="phone-pad"
        style={styles.input}
        theme={{ colors: { primary: '#2196F3', text: '#FFFFFF', placeholder: '#888888', background: '#1E1E1E' }}}
        textColor="#FFFFFF"
        outlineColor="#555555"
        activeOutlineColor="#2196F3"
      />
      
      <TextInput
        label="Email Address *"
        value={formData.email}
        onChangeText={(text) => updateFormData('email', text)}
        mode="outlined"
        keyboardType="email-address"
        style={styles.input}
        theme={{ colors: { primary: '#2196F3', text: '#FFFFFF', placeholder: '#888888', background: '#1E1E1E' }}}
        textColor="#FFFFFF"
        outlineColor="#555555"
        activeOutlineColor="#2196F3"
      />
      
      <TextInput
        label="Address"
        value={formData.address}
        onChangeText={(text) => updateFormData('address', text)}
        mode="outlined"
        multiline
        numberOfLines={3}
        style={styles.input}
        theme={{ colors: { primary: '#2196F3', text: '#FFFFFF', placeholder: '#888888', background: '#1E1E1E' }}}
        textColor="#FFFFFF"
        outlineColor="#555555"
        activeOutlineColor="#2196F3"
      />
      
      <TextInput
        label="Years of Experience"
        value={formData.experience}
        onChangeText={(text) => updateFormData('experience', text)}
        mode="outlined"
        keyboardType="numeric"
        style={styles.input}
        theme={{ colors: { primary: '#2196F3', text: '#FFFFFF', placeholder: '#888888', background: '#1E1E1E' }}}
        textColor="#FFFFFF"
        outlineColor="#555555"
        activeOutlineColor="#2196F3"
      />
    </View>
  );

  const renderIdentityVerification = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Identity Verification</Text>
      <Text style={styles.stepSubtitle}>Upload your Aadhaar card for verification</Text>
      
      <Card style={styles.uploadCard}>
        <Card.Content style={styles.uploadContent}>
          <MaterialCommunityIcons 
            name="card-account-details" 
            size={48} 
            color="#2196F3" 
          />
          <Text style={styles.uploadTitle}>Aadhaar Card Upload</Text>
          <Text style={styles.uploadSubtitle}>
            Upload a clear photo or PDF of your Aadhaar card
          </Text>
          
          {formData.aadhaarDocument && (
            <View style={styles.documentInfo}>
              <MaterialCommunityIcons name="check-circle" size={24} color="#4CAF50" />
              <Text style={styles.documentName}>
                {formData.aadhaarDocument.name}
              </Text>
            </View>
          )}
          
          <Button 
            mode="contained" 
            onPress={pickDocument}
            icon="upload"
            style={styles.uploadButton}
          >
            {formData.aadhaarDocument ? 'Change Document' : 'Upload Document'}
          </Button>
        </Card.Content>
      </Card>
    </View>
  );

  const renderLocationSetup = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Location Setup</Text>
      <Text style={styles.stepSubtitle}>Enable location for nearby bookings</Text>
      
      <Card style={styles.locationCard}>
        <Card.Content style={styles.locationContent}>
          <MaterialCommunityIcons 
            name="map-marker" 
            size={48} 
            color="#FF5722" 
          />
          <Text style={styles.locationTitle}>Location Access</Text>
          <Text style={styles.locationSubtitle}>
            {formData.location 
              ? "Location detected successfully! You can update it if needed." 
              : "We need your location to show you nearby booking requests"}
          </Text>
          
          {locationLoading && (
            <View style={styles.locationInfo}>
              <ActivityIndicator size={20} color="#2196F3" />
              <Text style={styles.locationText}>
                🔍 Detecting your location...
              </Text>
            </View>
          )}
          
          {formData.location && !locationLoading && (
            <View style={styles.locationInfo}>
              <MaterialCommunityIcons name="check-circle" size={20} color="#4CAF50" />
              <View style={styles.locationTextContainer}>
                <Text style={styles.locationText}>
                  📍 {formData.detectedAddress || 'Location coordinates saved'}
                </Text>
                <Text style={styles.locationHint}>
                  Tap "Update Location" below to re-detect if this is incorrect
                </Text>
              </View>
            </View>
          )}
          
          {!formData.location && !locationLoading && (
            <View style={styles.locationInfo}>
              <MaterialCommunityIcons name="information" size={20} color="#2196F3" />
              <Text style={styles.locationHint}>
                Tap the button below to detect your current location
              </Text>
            </View>
          )}
          
          <Button 
            mode={formData.location ? "outlined" : "contained"}
            onPress={requestLocationPermission}
            icon={locationLoading ? undefined : formData.location ? "refresh" : "map-marker"}
            loading={locationLoading}
            disabled={locationLoading}
            style={styles.locationButton}
          >
            {locationLoading 
              ? 'Detecting Location...' 
              : formData.location 
                ? 'Re-detect Location' 
                : 'Detect My Location'
            }
          </Button>
        </Card.Content>
      </Card>
    </View>
  );

  const renderCategorySelection = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Service Categories</Text>
      <Text style={styles.stepSubtitle}>Select the services you provide</Text>
      
      <View style={styles.categoriesContainer}>
        {categories.map((category) => (
          <Chip
            key={category.id}
            selected={formData.selectedCategories.includes(category.id)}
            onPress={() => toggleCategory(category.id)}
            style={[
              styles.categoryChip,
              formData.selectedCategories.includes(category.id) && styles.selectedChip
            ]}
            textStyle={formData.selectedCategories.includes(category.id) && styles.selectedChipText}
          >
            {category.name}
          </Chip>
        ))}
      </View>
      
      <Text style={styles.selectionCount}>
        {formData.selectedCategories.length} categories selected
      </Text>
    </View>
  );

  const renderComplete = () => (
    <View style={styles.stepContainer}>
      <View style={styles.completeContainer}>
        <MaterialCommunityIcons name="check-circle" size={80} color="#4CAF50" />
        <Text style={styles.completeTitle}>All Set!</Text>
        <Text style={styles.completeSubtitle}>
          Your agent profile is ready. You can now start accepting bookings and earning money!
        </Text>
        
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryTitle}>Profile Summary:</Text>
          <Text style={styles.summaryItem}>• Name: {formData.name}</Text>
          <Text style={styles.summaryItem}>• Phone: {formData.phone}</Text>
          <Text style={styles.summaryItem}>• Categories: {formData.selectedCategories.length} selected</Text>
          <Text style={styles.summaryItem}>• Location: {formData.location ? 'Enabled' : 'Disabled'}</Text>
          <Text style={styles.summaryItem}>• Identity: Verified ✓</Text>
        </View>
      </View>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1: return renderBasicInfo();
      case 2: return renderIdentityVerification();
      case 3: return renderLocationSetup();
      case 4: return renderCategorySelection();
      case 5: return renderComplete();
      default: return renderBasicInfo();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      <LinearGradient
        colors={['#121212', '#1E1E1E']}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <IconButton
            icon="close"
            iconColor="#FFFFFF"
            size={24}
            onPress={handleClose}
            style={styles.closeButton}
          />
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Agent Onboarding</Text>
            <Text style={styles.headerSubtitle}>Join ClickO as a Service Provider</Text>
          </View>
          <View style={styles.placeholder} />
        </View>
      </LinearGradient>
      
      {renderProgressBar()}
      
      <KeyboardAvoidingView 
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {renderCurrentStep()}
        </ScrollView>
        
        <View style={styles.buttonContainer}>
          {currentStep > 1 && (
            <Button 
              mode="outlined" 
              onPress={handleBack}
              style={styles.backButton}
              labelStyle={{ color: '#CCCCCC' }}
              theme={{ colors: { outline: '#555555' }}}
            >
              Back
            </Button>
          )}
          
          <Button 
            mode="contained" 
            onPress={handleNext}
            loading={loading}
            style={styles.nextButton}
            labelStyle={{ color: '#FFFFFF' }}
            theme={{ colors: { primary: '#2196F3' }}}
          >
            {currentStep === ONBOARDING_STEPS.length ? 'Complete' : 'Next'}
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    padding: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  closeButton: {
    margin: 0,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  placeholder: {
    width: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  progressContainer: {
    padding: 20,
    backgroundColor: '#1E1E1E',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333333',
  },
  progressText: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
    color: '#CCCCCC',
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  stepContainer: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#FFFFFF',
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#CCCCCC',
    marginBottom: 24,
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#1E1E1E',
  },
  uploadCard: {
    marginTop: 16,
    backgroundColor: '#1E1E1E',
  },
  uploadContent: {
    alignItems: 'center',
    padding: 20,
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
    color: '#FFFFFF',
  },
  uploadSubtitle: {
    fontSize: 14,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 20,
  },
  documentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  documentName: {
    marginLeft: 8,
    fontSize: 14,
    color: '#4CAF50',
  },
  uploadButton: {
    marginTop: 8,
    backgroundColor: '#2196F3',
  },
  locationCard: {
    marginTop: 16,
    backgroundColor: '#1E1E1E',
  },
  locationContent: {
    alignItems: 'center',
    padding: 20,
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
    color: '#FFFFFF',
  },
  locationSubtitle: {
    fontSize: 14,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 20,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  locationTextContainer: {
    marginLeft: 8,
    flex: 1,
  },
  locationHint: {
    marginTop: 4,
    fontSize: 12,
    color: '#CCCCCC',
    fontStyle: 'italic',
  },
  locationButton: {
    marginTop: 8,
    backgroundColor: '#FF5722',
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
  },
  categoryChip: {
    margin: 4,
    backgroundColor: '#333333',
  },
  selectedChip: {
    backgroundColor: '#2196F3',
  },
  selectedChipText: {
    color: 'white',
  },
  selectionCount: {
    textAlign: 'center',
    marginTop: 16,
    fontSize: 14,
    color: '#CCCCCC',
  },
  completeContainer: {
    alignItems: 'center',
    padding: 20,
  },
  completeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    color: '#4CAF50',
  },
  completeSubtitle: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 24,
  },
  summaryContainer: {
    backgroundColor: '#1E1E1E',
    padding: 20,
    borderRadius: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: '#333333',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#FFFFFF',
  },
  summaryItem: {
    fontSize: 14,
    marginBottom: 6,
    color: '#CCCCCC',
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#1E1E1E',
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  backButton: {
    flex: 1,
    marginRight: 8,
    borderColor: '#555555',
  },
  nextButton: {
    flex: 2,
    marginLeft: 8,
    backgroundColor: '#2196F3',
  },
});