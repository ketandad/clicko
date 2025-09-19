import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Card,
  ActivityIndicator,
  Surface,
  Chip,
  ProgressBar,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { getCategories } from '../services/categoryService';

const { width } = Dimensions.get('window');

const ONBOARDING_STEPS = [
  { id: 1, title: 'Basic Info', icon: 'account' },
  { id: 2, title: 'Identity Verification', icon: 'card-account-details' },
  { id: 3, title: 'Location Setup', icon: 'map-marker' },
  { id: 4, title: 'Service Categories', icon: 'view-grid' },
  { id: 5, title: 'Complete', icon: 'check-circle' },
];

export default function AgentOnboardingScreen() {
  const navigation = useNavigation();
  const { user, toggleAgentMode } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  
  // Form data
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    experience: '',
    aadhaarDocument: null,
    location: null,
    selectedCategories: [],
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const categoriesData = await getCategories();
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = async () => {
    if (!validateCurrentStep()) return;
    
    if (currentStep < ONBOARDING_STEPS.length) {
      setCurrentStep(prev => prev + 1);
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
      setLoading(true);
      
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required for agents');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      updateFormData('location', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      
      Alert.alert('Success', 'Location access granted!');
    } catch (error) {
      Alert.alert('Error', 'Failed to get location');
    } finally {
      setLoading(false);
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
      
      // Auto-approve for now (as requested)
      const agentData = {
        ...formData,
        isVerified: true,
        isApproved: true,
        status: 'active',
      };
      
      // TODO: Submit to backend API
      console.log('Agent onboarding data:', agentData);
      
      // Switch user to agent mode if not already
      if (!user?.isAgent) {
        await toggleAgentMode();
      }
      
      Alert.alert(
        'Welcome to ClickO!',
        'Your agent profile has been created and approved. You can now start accepting bookings!',
        [{ 
          text: 'Continue', 
          onPress: () => {
            // Navigate back to home, which will now show AgentHomeScreen
            navigation.reset({
              index: 0,
              routes: [{ name: 'Home' }],
            });
          }
        }]
      );
    } catch (error) {
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
      />
      
      <TextInput
        label="Phone Number *"
        value={formData.phone}
        onChangeText={(text) => updateFormData('phone', text)}
        mode="outlined"
        keyboardType="phone-pad"
        style={styles.input}
      />
      
      <TextInput
        label="Email Address *"
        value={formData.email}
        onChangeText={(text) => updateFormData('email', text)}
        mode="outlined"
        keyboardType="email-address"
        style={styles.input}
      />
      
      <TextInput
        label="Address"
        value={formData.address}
        onChangeText={(text) => updateFormData('address', text)}
        mode="outlined"
        multiline
        numberOfLines={3}
        style={styles.input}
      />
      
      <TextInput
        label="Years of Experience"
        value={formData.experience}
        onChangeText={(text) => updateFormData('experience', text)}
        mode="outlined"
        keyboardType="numeric"
        style={styles.input}
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
          
          {formData.aadhaarDocument ? (
            <View style={styles.documentInfo}>
              <MaterialCommunityIcons name="check-circle" size={24} color="#4CAF50" />
              <Text style={styles.documentName}>
                {formData.aadhaarDocument.name}
              </Text>
            </View>
          ) : null}
          
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
            We need your location to show you nearby booking requests
          </Text>
          
          {formData.location ? (
            <View style={styles.locationInfo}>
              <MaterialCommunityIcons name="check-circle" size={24} color="#4CAF50" />
              <Text style={styles.locationText}>
                Location access granted
              </Text>
            </View>
          ) : null}
          
          <Button 
            mode="contained" 
            onPress={requestLocationPermission}
            icon="map-marker"
            loading={loading}
            style={styles.locationButton}
          >
            {formData.location ? 'Update Location' : 'Enable Location'}
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
      <LinearGradient
        colors={['#1976D2', '#2196F3']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Agent Onboarding</Text>
        <Text style={styles.headerSubtitle}>Join ClickO as a Service Provider</Text>
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
            >
              Back
            </Button>
          )}
          
          <Button 
            mode="contained" 
            onPress={handleNext}
            loading={loading}
            style={styles.nextButton}
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    alignItems: 'center',
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
    backgroundColor: 'white',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  progressText: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
    color: '#666',
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
    color: '#333',
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  input: {
    marginBottom: 16,
  },
  uploadCard: {
    marginTop: 16,
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
  },
  uploadSubtitle: {
    fontSize: 14,
    color: '#666',
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
  },
  locationCard: {
    marginTop: 16,
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
  },
  locationSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#4CAF50',
  },
  locationButton: {
    marginTop: 8,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
  },
  categoryChip: {
    margin: 4,
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
    color: '#666',
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
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  summaryContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    width: '100%',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  summaryItem: {
    fontSize: 14,
    marginBottom: 6,
    color: '#666',
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  backButton: {
    flex: 1,
    marginRight: 8,
  },
  nextButton: {
    flex: 2,
    marginLeft: 8,
  },
});