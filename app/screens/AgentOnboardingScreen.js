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
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Card,
  Chip,
  ProgressBar,
  IconButton,
  Checkbox,
  Divider,
  ActivityIndicator,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../contexts/LocationContext';
import { getCategories } from '../services/categoryService';
// import { getSubCategories } from '../services/subCategoryService'; // Removed - using cached data
import { submitAgentOnboarding } from '../services/agentOnboardingService';
import { colors } from '../theme';

// Import components
import PhoneInput from '../components/PhoneInput';
import AddressAutocomplete from '../components/AddressAutocomplete';
import PhotoCapture from '../components/PhotoCapture';

const ONBOARDING_STEPS = [
  { id: 1, title: 'Basic Info', icon: 'account' },
  { id: 2, title: 'Profile Photo', icon: 'camera' },
  { id: 3, title: 'Identity Verification', icon: 'card-account-details' },
  { id: 4, title: 'Selfie Verification', icon: 'face-recognition' },
  { id: 5, title: 'Location Setup', icon: 'map-marker' },
  { id: 6, title: 'Terms & Agreement', icon: 'file-document' },
  { id: 7, title: 'Final Submission', icon: 'check-circle' }
];

// Cached sub-categories data (matches backend database)
const CACHED_SUB_CATEGORIES = {
  2: [ // Home Appliances
    { id: 13, name: 'Washing Machine Repair', description: 'Repair and servicing of washing machines' },
    { id: 14, name: 'Refrigerator Repair', description: 'Fridge and freezer repair services' },
    { id: 15, name: 'Microwave Repair', description: 'Microwave oven repair and maintenance' },
    { id: 16, name: 'TV Repair', description: 'Television and display repair services' },
    { id: 17, name: 'Water Purifier Service', description: 'RO and water purifier maintenance' },
    { id: 18, name: 'Dishwasher Repair', description: 'Dishwasher repair and maintenance' },
    { id: 19, name: 'Geyser Repair', description: 'Water heater and geyser repair services' }
  ],
  12: [ // Photographer
    { id: 7, name: 'Wedding Photography', description: 'Complete wedding event photography and videography' },
    { id: 8, name: 'Portrait Photography', description: 'Individual and family portrait sessions' },
    { id: 9, name: 'Event Photography', description: 'Birthday parties, anniversaries, and celebrations' },
    { id: 10, name: 'Product Photography', description: 'Commercial product shoots for businesses' },
    { id: 11, name: 'Baby Photography', description: 'Newborn and baby photoshoot sessions' },
    { id: 12, name: 'Pre-Wedding Shoot', description: 'Couple photography sessions before wedding' }
  ],
  14: [ // Spa & Massage
    { id: 1, name: 'Full Body Massage', description: 'Complete body relaxation massage therapy' },
    { id: 2, name: 'Head & Neck Massage', description: 'Focused massage for head, neck and shoulder areas' },
    { id: 3, name: 'Foot Massage', description: 'Relaxing foot and leg massage service' },
    { id: 4, name: 'Aromatherapy', description: 'Essential oil-based therapeutic massage' },
    { id: 5, name: 'Deep Tissue Massage', description: 'Therapeutic deep muscle massage for pain relief' },
    { id: 6, name: 'Couple Massage', description: 'Relaxing massage sessions for couples' }
  ]
};

const KYC_DOCUMENT_TYPES = [
  { value: 'aadhar', label: 'Aadhar Card', icon: 'card-account-details' },
  { value: 'pan', label: 'PAN Card', icon: 'credit-card' },
  { value: 'driving_license', label: 'Driving License', icon: 'car' },
  { value: 'passport', label: 'Passport', icon: 'passport' },
];

const CACHE_KEYS = {
  ONBOARDING_DATA: 'agent_onboarding_cache',
  CURRENT_STEP: 'agent_onboarding_step',
};

export default function AgentOnboardingScreen() {
  const navigation = useNavigation();
  const { user, updateUserProfile } = useAuth();
  const { selectedLocation } = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Cached form data - everything stored locally until final submission
  const [cachedData, setCachedData] = useState({
    // Step 1: Basic Info
    phone: '',
    experienceYears: '',
    primaryCategory: '', // Main service category ID
    selectedSubCategories: [], // Sub-categories for primary category
    ratePerKm: '20',
    
    // Step 2: Profile Photo
    profilePhoto: null, // Will store base64 or local URI
    
    // Step 3: KYC Document
    kycDocumentType: '',
    kycDocument: null,
    
    // Step 4: Selfie
    selfiePhoto: null,
    
    // Step 5: Location
    address: '',
    coordinates: null,
    
    // Step 7: Agreement
    acceptedTerms: false,
    acceptedPrivacy: false,
  });

  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState({});

  useEffect(() => {
    loadCachedData();
    loadCategories();
  }, []);

  // Load sub-categories when categories are loaded and there's a cached primary category
  useEffect(() => {
    if (categories.length > 0 && cachedData.primaryCategory) {
      loadSubCategories(cachedData.primaryCategory);
    }
  }, [categories, cachedData.primaryCategory]);

  // Handle navigation focus to ensure clean state on re-entry
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Reload cached data when screen comes into focus
      // This ensures fresh state if user navigated away and back
      loadCachedData();
      console.log('🔄 Onboarding screen focused - reloaded cached data');
    });

    return unsubscribe;
  }, [navigation]);

  // Load cached data from storage
  const loadCachedData = async () => {
    try {
      const cached = await SecureStore.getItemAsync(CACHE_KEYS.ONBOARDING_DATA);
      const cachedStep = await SecureStore.getItemAsync(CACHE_KEYS.CURRENT_STEP);
      
      if (cached) {
        const parsedData = JSON.parse(cached);
        // Ensure arrays are always initialized
        setCachedData({
          ...parsedData,
          selectedSubCategories: parsedData.selectedSubCategories || []
        });
      }
      
      if (cachedStep) {
        setCurrentStep(parseInt(cachedStep));
      }
    } catch (error) {
      console.error('Error loading cached onboarding data:', error);
    }
  };

  // Save data to cache with validation
  const saveCachedData = async (newData) => {
    try {
      let updatedData = { ...cachedData, ...newData };
      
      // Validate selectedSubCategories belong to current primaryCategory
      if (newData.selectedSubCategories && updatedData.primaryCategory) {
        const validSubCategoryIds = CACHED_SUB_CATEGORIES[updatedData.primaryCategory]?.map(sub => sub.id) || [];
        const invalidIds = updatedData.selectedSubCategories.filter(id => !validSubCategoryIds.includes(id));
        
        if (invalidIds.length > 0) {
          console.warn(`⚠️ Removing invalid sub-category IDs [${invalidIds.join(', ')}] for category ${updatedData.primaryCategory}`);
          updatedData.selectedSubCategories = updatedData.selectedSubCategories.filter(id => validSubCategoryIds.includes(id));
        }
      }
      
      // Validate experience years is a number
      if (newData.experienceYears && isNaN(parseInt(newData.experienceYears))) {
        console.warn('⚠️ Invalid experience years value, converting to string');
        updatedData.experienceYears = String(newData.experienceYears);
      }
      
      setCachedData(updatedData);
      await SecureStore.setItemAsync(CACHE_KEYS.ONBOARDING_DATA, JSON.stringify(updatedData));
      console.log('✅ Onboarding data cached successfully');
    } catch (error) {
      console.error('❌ Error caching onboarding data:', error);
    }
  };

  // Save current step
  const saveCurrentStep = async (step) => {
    try {
      await SecureStore.setItemAsync(CACHE_KEYS.CURRENT_STEP, step.toString());
      setCurrentStep(step);
    } catch (error) {
      console.error('Error saving current step:', error);
    }
  };

  // Clear all onboarding cache and reset form state
  const clearOnboardingCache = async (showSuccessMessage = false) => {
    try {
      // Remove cached data from secure storage
      await SecureStore.deleteItemAsync(CACHE_KEYS.ONBOARDING_DATA);
      await SecureStore.deleteItemAsync(CACHE_KEYS.CURRENT_STEP);
      
      // Reset component state to initial values
      setCachedData({
        phone: '',
        experienceYears: '',
        primaryCategory: '',
        selectedSubCategories: [],
        ratePerKm: '20',
        profilePhoto: null,
        kycDocumentType: '',
        kycDocument: null,
        selfiePhoto: null,
        address: '',
        coordinates: null,
        acceptedTerms: false,
        acceptedPrivacy: false,
      });
      
      // Reset to first step
      setCurrentStep(1);
      
      // Clear sub-categories state
      setSubCategories({});
      
      console.log('✅ Onboarding cache cleared successfully');
      
      // Show brief success feedback if requested
      if (showSuccessMessage) {
        Alert.alert(
          'Form Reset',
          'Your onboarding form has been reset successfully.',
          [{ text: 'OK' }],
          { cancelable: true }
        );
      }
    } catch (error) {
      console.error('❌ Error clearing onboarding cache:', error);
      if (showSuccessMessage) {
        Alert.alert('Error', 'Failed to reset form. Please try again.');
      }
    }
  };

  const loadCategories = async () => {
    try {
      const categoriesData = await getCategories();
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  // Load sub-categories when primary category changes (using cached data)
  const loadSubCategories = (categoryId) => {
    if (!categoryId) {
      console.log('⚠️ No categoryId provided to loadSubCategories');
      return;
    }
    
    // Check if categories are loaded
    if (!categories || categories.length === 0) {
      console.log('⚠️ Categories not loaded yet, deferring sub-category load');
      return;
    }
    
    try {
      const category = categories.find(cat => cat.id === parseInt(categoryId));
      if (!category) {
        console.error(`❌ Category with ID ${categoryId} not found in loaded categories`);
        return;
      }
      
      if (category.has_sub_categories) {
        const cachedSubCategories = CACHED_SUB_CATEGORIES[categoryId] || [];
        console.log(`📋 Loading ${cachedSubCategories.length} cached sub-categories for category ${categoryId} (${category.name})`);
        setSubCategories(prev => ({
          ...prev,
          [categoryId]: cachedSubCategories
        }));
      } else {
        console.log(`📋 Category ${category.name} does not have sub-categories`);
        // Clear sub-categories for categories that don't have them
        setSubCategories(prev => {
          const updated = { ...prev };
          delete updated[categoryId];
          return updated;
        });
      }
    } catch (error) {
      console.error('❌ Failed to load cached sub-categories:', error);
    }
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      const nextStep = currentStep + 1;
      saveCurrentStep(nextStep);
    }
  };

  const handlePrevious = () => {
    const prevStep = currentStep - 1;
    if (prevStep >= 1) {
      saveCurrentStep(prevStep);
    }
  };

  const handleBackPress = () => {
    // Check if there's any cached data to lose
    const hasData = cachedData.phone || cachedData.primaryCategory || cachedData.profilePhoto || 
                   cachedData.kycDocument || cachedData.selfiePhoto || cachedData.address;
    
    if (hasData) {
      Alert.alert(
        'Exit Onboarding',
        'Are you sure you want to exit? All your progress will be lost and you\'ll need to start over.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Exit & Clear', 
            style: 'destructive',
            onPress: async () => {
              await clearOnboardingCache();
              navigation.goBack();
            }
          }
        ]
      );
    } else {
      // No data to lose, just go back
      navigation.goBack();
    }
  };

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 1:
        if (!cachedData.phone || !cachedData.primaryCategory || !cachedData.experienceYears) {
          Alert.alert('Missing Information', 'Please fill all required fields: phone number, experience years, and primary service category');
          return false;
        }
        // Validate sub-categories for categories that require them
        const category = categories.find(c => c.id === cachedData.primaryCategory);
        if (category && category.has_sub_categories) {
          if (!cachedData.selectedSubCategories || cachedData.selectedSubCategories.length === 0) {
            Alert.alert(
              'Missing Specializations', 
              `Please select at least one specialization within "${category.name}" category to continue.`
            );
            return false;
          }
          console.log(`✅ Selected ${cachedData.selectedSubCategories.length} specializations for ${category.name}`);
        } else if (category) {
          console.log(`✅ Category "${category.name}" does not require specializations`);
        }
        break;
      case 2:
        if (!cachedData.profilePhoto) {
          Alert.alert('Missing Photo', 'Please take or upload a profile photo');
          return false;
        }
        break;
      case 3:
        if (!cachedData.kycDocumentType || !cachedData.kycDocument) {
          Alert.alert('Missing Document', 'Please select and upload a KYC document');
          return false;
        }
        break;
      case 4:
        if (!cachedData.selfiePhoto) {
          Alert.alert('Missing Selfie', 'Please take a selfie for verification');
          return false;
        }
        break;
      case 5:
        if (!cachedData.address) {
          Alert.alert('Missing Address', 'Please provide your address');
          return false;
        }
        break;
      case 6:
        if (!cachedData.acceptedTerms || !cachedData.acceptedPrivacy) {
          Alert.alert('Agreement Required', 'Please accept the terms and privacy policy');
          return false;
        }
        break;
    }
    return true;
  };

  // Final submission - uploads all data and creates agent profile
  const handleFinalSubmit = async () => {
    try {
      setSubmitting(true);
      
      Alert.alert(
        'Submit Application',
        'Are you ready to submit your agent application? This will create your agent profile.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Submit', 
            style: 'default',
            onPress: async () => {
              try {
                console.log('📤 Submitting agent onboarding data:', {
                  ...cachedData,
                  profilePhoto: cachedData.profilePhoto ? 'Present' : 'Missing',
                  kycDocument: cachedData.kycDocument ? 'Present' : 'Missing',
                  selfiePhoto: cachedData.selfiePhoto ? 'Present' : 'Missing',
                });

                // Prepare submission data
                const submissionData = {
                  // Personal details
                  phone: cachedData.phone,
                  experienceYears: cachedData.experienceYears || 0,
                  bio: cachedData.bio || '',
                  
                  // Address details
                  addressLine1: cachedData.address,
                  addressLine2: '',
                  city: cachedData.city || '',
                  state: cachedData.state || '',
                  postalCode: cachedData.postalCode || '',
                  location: cachedData.location || '', // "lat,lng"
                  
                  // Category selections
                  primaryCategoryId: cachedData.primaryCategory,
                  subCategoryIds: cachedData.selectedSubCategories || [],
                  
                  // KYC details
                  kycDocumentType: cachedData.kycDocumentType,
                  
                  // Image files (URIs)
                  profilePhoto: cachedData.profilePhoto,
                  selfiePhoto: cachedData.selfiePhoto,
                  kycDocument: cachedData.kycDocument,
                };

                // Submit to backend
                const result = await submitAgentOnboarding(submissionData);
                
                // Clear cache after successful submission
                await SecureStore.deleteItemAsync(CACHE_KEYS.ONBOARDING_DATA);
                await SecureStore.deleteItemAsync(CACHE_KEYS.CURRENT_STEP);
                
                if (result.alreadyExists) {
                  // User already has agent profile - update local state to match backend
                  console.log('🎯 Syncing local state: User already has agent profile');
                  await updateUserProfile({ 
                    agentOnboardingCompleted: true,
                    isAgent: true
                    // Don't force currentMode - let user choose their preferred mode
                  });
                  
                  Alert.alert(
                    'Agent Profile Found!', 
                    'You already have an agent profile. Your account has been updated to reflect this.',
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                  );
                } else {
                  // New agent profile created - switch to agent mode since they just completed onboarding
                  await updateUserProfile({ 
                    agentOnboardingCompleted: true,
                    isAgent: true,
                    currentMode: 'agent' // OK to set agent mode for new onboarding completion
                  });
                  
                  Alert.alert(
                    'Success!', 
                    `Your agent profile has been created successfully! Agent ID: ${result.agent_id}. Your application is ${result.status}.`,
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                  );
                }
                
              } catch (error) {
                console.error('❌ Submission error:', error);
                Alert.alert(
                  'Submission Failed', 
                  `Failed to submit application: ${error.message}. Please check your connection and try again.`
                );
              } finally {
                setSubmitting(false);
              }
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('Error in final submit:', error);
    }
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <Text style={styles.progressText}>
        Step {currentStep} of {ONBOARDING_STEPS.length}
      </Text>
      <ProgressBar 
        progress={currentStep / ONBOARDING_STEPS.length} 
        color={colors.primary}
        style={styles.progressBar}
      />
      <Text style={styles.stepTitle}>
        {ONBOARDING_STEPS[currentStep - 1]?.title}
      </Text>
    </View>
  );

  const renderStep1BasicInfo = () => (
    <Card style={styles.card}>
      <Card.Content>
        <Text style={styles.sectionTitle}>Basic Information</Text>
        
        <PhoneInput
          label="Phone Number *"
          value={cachedData.phone}
          onChangeText={(phone) => saveCachedData({ phone })}
          style={styles.input}
        />

        <TextInput
          label="Years of Experience *"
          value={cachedData.experienceYears}
          onChangeText={(experienceYears) => saveCachedData({ experienceYears })}
          keyboardType="numeric"
          style={styles.input}
        />

        <View style={styles.categorySection}>
          <Text style={styles.sectionTitle}>Primary Service Category *</Text>
          <Text style={styles.sectionDescription}>
            Select your main area of expertise
          </Text>
          
          <View style={styles.categoriesContainer}>
            {categories.map((category) => (
              <Chip
                key={category.id}
                style={[
                  styles.categoryChip,
                  cachedData.primaryCategory === category.id && styles.selectedCategoryChip
                ]}
                selected={cachedData.primaryCategory === category.id}
                onPress={() => {
                  // Clear sub-categories when changing primary category
                  saveCachedData({ 
                    primaryCategory: category.id,
                    selectedSubCategories: [] // Reset sub-categories for new category
                  });
                  loadSubCategories(category.id);
                }}
                mode={cachedData.primaryCategory === category.id ? 'flat' : 'outlined'}
              >
                {category.name}
              </Chip>
            ))}
          </View>
          
          {cachedData.primaryCategory && (
            <Text style={styles.selectedCategoryText}>
              Primary: {categories.find(c => c.id === cachedData.primaryCategory)?.name}
            </Text>
          )}

          {/* Sub-categories selection for primary category */}
          {cachedData.primaryCategory && subCategories[cachedData.primaryCategory] && (
            <View style={styles.categorySection}>
              <Text style={styles.sectionTitle}>Select Your Specializations</Text>
              <Text style={styles.sectionDescription}>
                Choose specific services you provide within {categories.find(c => c.id === cachedData.primaryCategory)?.name}
              </Text>
              
              <View style={styles.categoriesContainer}>
                {subCategories[cachedData.primaryCategory].map((subCategory) => (
                  <Chip
                    key={subCategory.id}
                    style={[
                      styles.categoryChip,
                      (cachedData.selectedSubCategories || []).includes(subCategory.id) && styles.selectedCategoryChip
                    ]}
                    selected={(cachedData.selectedSubCategories || []).includes(subCategory.id)}
                    onPress={() => {
                      const currentSelection = cachedData.selectedSubCategories || [];
                      const newSelection = currentSelection.includes(subCategory.id)
                        ? currentSelection.filter(id => id !== subCategory.id)
                        : [...currentSelection, subCategory.id];
                      saveCachedData({ selectedSubCategories: newSelection });
                    }}
                    mode={(cachedData.selectedSubCategories || []).includes(subCategory.id) ? 'flat' : 'outlined'}
                  >
                    {subCategory.name}
                  </Chip>
                ))}
              </View>
              
              {(cachedData.selectedSubCategories || []).length > 0 && (
                <Text style={styles.selectionCount}>
                  {(cachedData.selectedSubCategories || []).length} specializations selected
                </Text>
              )}
            </View>
          )}
        </View>
      </Card.Content>
    </Card>
  );

  const renderStep2ProfilePhoto = () => (
    <Card style={styles.card}>
      <Card.Content>
        <Text style={styles.sectionTitle}>Profile Photo</Text>
        <Text style={styles.sectionDescription}>
          Upload a clear photo of yourself. This will be shown to users.
        </Text>
        
        <PhotoCapture
          value={cachedData.profilePhoto}
          onImageTaken={(uri) => saveCachedData({ profilePhoto: uri })}
          placeholder="Take Profile Photo"
          type="profile"
          cacheOnly={true}
        />
      </Card.Content>
    </Card>
  );

  const renderStep3KYCDocument = () => (
    <Card style={styles.card}>
      <Card.Content>
        <Text style={styles.sectionTitle}>Identity Verification</Text>
        <Text style={styles.sectionDescription}>
          Upload a government-issued ID for verification.
        </Text>

        <View style={styles.documentTypeContainer}>
          {KYC_DOCUMENT_TYPES.map((docType) => (
            <Chip
              key={docType.value}
              mode={cachedData.kycDocumentType === docType.value ? 'flat' : 'outlined'}
              selected={cachedData.kycDocumentType === docType.value}
              onPress={() => saveCachedData({ kycDocumentType: docType.value })}
              icon={docType.icon}
              style={styles.documentTypeChip}
            >
              {docType.label}
            </Chip>
          ))}
        </View>

        {cachedData.kycDocumentType && (
          <PhotoCapture
            value={cachedData.kycDocument}
            onImageTaken={(uri) => saveCachedData({ kycDocument: uri })}
            placeholder={`Upload ${KYC_DOCUMENT_TYPES.find(d => d.value === cachedData.kycDocumentType)?.label}`}
            type="document"
            cacheOnly={true}
          />
        )}
      </Card.Content>
    </Card>
  );

  const renderStep4SelfieVerification = () => (
    <Card style={styles.card}>
      <Card.Content>
        <Text style={styles.sectionTitle}>Selfie Verification</Text>
        <Text style={styles.sectionDescription}>
          Take a clear selfie for identity verification. Make sure your face is clearly visible.
        </Text>
        
        <PhotoCapture
          value={cachedData.selfiePhoto}
          onImageTaken={(uri) => saveCachedData({ selfiePhoto: uri })}
          placeholder="Take Selfie"
          type="selfie"
          cacheOnly={true}
        />
      </Card.Content>
    </Card>
  );

  const renderStep5LocationSetup = () => (
    <Card style={styles.card}>
      <Card.Content>
        <Text style={styles.sectionTitle}>Service Location</Text>
        <Text style={styles.sectionDescription}>
          Set your base location where you provide services.
        </Text>

        <AddressAutocomplete
          label="Service Address *"
          value={cachedData.address}
          onAddressSelect={(address, coordinates) => {
            saveCachedData({ 
              address: address,
              coordinates: coordinates 
            });
          }}
          style={styles.input}
        />

        {selectedLocation && (
          <Button
            mode="outlined"
            onPress={() => {
              saveCachedData({
                address: selectedLocation.address,
                coordinates: selectedLocation.coordinates
              });
            }}
            style={styles.useCurrentLocationButton}
          >
            Use Current Location: {selectedLocation.area}
          </Button>
        )}
      </Card.Content>
    </Card>
  );



  const renderStep7TermsAgreement = () => (
    <Card style={styles.card}>
      <Card.Content>
        <Text style={styles.sectionTitle}>Terms & Agreement</Text>
        
        <View style={styles.agreementContainer}>
          <View style={styles.checkboxRow}>
            <Checkbox
              status={cachedData.acceptedTerms ? 'checked' : 'unchecked'}
              onPress={() => saveCachedData({ acceptedTerms: !cachedData.acceptedTerms })}
              color={colors.primary}
              uncheckedColor={colors.primary}
            />
            <Text style={styles.agreementText}>
              I accept the{' '}
              <Text 
                style={styles.linkText}
                onPress={() => navigation.navigate('TermsOfService')}
              >
                Terms of Service
              </Text>
            </Text>
          </View>

          <View style={styles.checkboxRow}>
            <Checkbox
              status={cachedData.acceptedPrivacy ? 'checked' : 'unchecked'}
              onPress={() => saveCachedData({ acceptedPrivacy: !cachedData.acceptedPrivacy })}
              color={colors.primary}
              uncheckedColor={colors.primary}
            />
            <Text style={styles.agreementText}>
              I accept the{' '}
              <Text 
                style={styles.linkText}
                onPress={() => navigation.navigate('PrivacyPolicy')}
              >
                Privacy Policy
              </Text>
            </Text>
          </View>
        </View>

        <View style={styles.agreementNotice}>
          <MaterialCommunityIcons name="information" size={24} color={colors.primary} />
          <Text style={styles.agreementNoticeText}>
            By accepting these terms, you agree to provide services as an independent contractor 
            through the ClickO platform. All service pricing will be negotiated directly with customers.
          </Text>
        </View>
      </Card.Content>
    </Card>
  );

  const renderStep8FinalSubmission = () => (
    <Card style={styles.card}>
      <Card.Content>
        <Text style={styles.sectionTitle}>Review & Submit</Text>
        <Text style={styles.sectionDescription}>
          Please review your information before final submission.
        </Text>

        <View style={styles.reviewContainer}>
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>Phone:</Text>
            <Text style={styles.reviewValue}>{cachedData.phone}</Text>
          </View>
          
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>Experience:</Text>
            <Text style={styles.reviewValue}>{cachedData.experienceYears} years</Text>
          </View>
          
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>Primary Category:</Text>
            <Text style={styles.reviewValue}>
              {categories.find(c => c.id === cachedData.primaryCategory)?.name || 'Not selected'}
            </Text>
          </View>
          
          {cachedData.selectedSubCategories && cachedData.selectedSubCategories.length > 0 && (
            <View style={styles.reviewItem}>
              <Text style={styles.reviewLabel}>Specializations:</Text>
              <Text style={styles.reviewValue}>
                {cachedData.selectedSubCategories.length} selected
              </Text>
            </View>
          )}
          
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>Documents:</Text>
            <Text style={styles.reviewValue}>
              {(cachedData.profilePhoto && cachedData.profilePhoto !== null) ? '✅' : '❌'} Profile Photo{'\n'}
              {(cachedData.kycDocument && cachedData.kycDocument !== null) ? '✅' : '❌'} KYC Document{'\n'}
              {(cachedData.selfiePhoto && cachedData.selfiePhoto !== null) ? '✅' : '❌'} Selfie
            </Text>
          </View>
        </View>

        <Button
          mode="contained"
          onPress={handleFinalSubmit}
          disabled={submitting}
          loading={submitting}
          style={styles.submitButton}
        >
          {submitting ? 'Submitting Application...' : 'Submit Agent Application'}
        </Button>
      </Card.Content>
    </Card>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1: return renderStep1BasicInfo();
      case 2: return renderStep2ProfilePhoto();
      case 3: return renderStep3KYCDocument();
      case 4: return renderStep4SelfieVerification();
      case 5: return renderStep5LocationSetup();
      case 6: return renderStep7TermsAgreement();
      case 7: return renderStep8FinalSubmission();
      default: return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <IconButton
            icon="arrow-left"
            iconColor="#fff"
            size={24}
            onPress={handleBackPress}
          />
          <Text style={styles.headerTitle}>Agent Onboarding</Text>
        </View>
        {renderProgressBar()}
      </LinearGradient>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {renderCurrentStep()}
        </ScrollView>

        <View style={styles.navigationButtons}>
          {currentStep > 1 && (
            <Button
              mode="outlined"
              onPress={handlePrevious}
              style={styles.navButton}
            >
              Previous
            </Button>
          )}
          
          {currentStep < ONBOARDING_STEPS.length && (
            <Button
              mode="contained"
              onPress={handleNext}
              style={styles.navButton}
            >
              Next
            </Button>
          )}
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
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 16,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  progressText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginBottom: 8,
  },
  stepTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  input: {
    marginBottom: 12,
  },
  documentTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  documentTypeChip: {
    margin: 4,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  categoryChip: {
    margin: 4,
  },
  useCurrentLocationButton: {
    marginTop: 12,
  },
  agreementContainer: {
    marginBottom: 20,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  agreementText: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
  },
  linkText: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  agreementNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 8,
  },
  agreementNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    lineHeight: 18,
  },
  reviewContainer: {
    marginBottom: 20,
  },
  reviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  reviewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  reviewValue: {
    fontSize: 14,
    color: '#666',
    flex: 2,
    textAlign: 'right',
  },
  submitButton: {
    marginTop: 16,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  categorySection: {
    marginVertical: 16,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 8,
  },
  categoryChip: {
    marginBottom: 8,
  },
  selectedCategoryChip: {
    backgroundColor: colors.primary,
  },
  selectedCategoryText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: 'bold',
    marginTop: 8,
  },
  selectionCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    backgroundColor: '#fff',
    elevation: 4,
  },
  navButton: {
    flex: 1,
    marginHorizontal: 8,
  },
});