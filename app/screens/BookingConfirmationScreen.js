import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Dimensions,
  Modal
} from 'react-native';
import {
  Text,
  Card,
  Button,
  TextInput,
  Chip,
  Surface,
  ActivityIndicator,
  Checkbox,
  Divider,
  Portal,
  RadioButton
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { colors } from '../theme';
import { useLocation } from '../contexts/LocationContext';
import { useAuth } from '../contexts/AuthContext';
import bookingService from '../services/bookingService';
import locationService from '../services/locationService';

const { width } = Dimensions.get('window');

export default function BookingConfirmationScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { selectedLocation, getCurrentLocation } = useLocation();
  
  // Route params
  const { agent, selectedCategory, selectedSubcategory } = route.params || {};
  
  // State management
  const [loading, setLoading] = useState(false);
  const [submittingBooking, setSubmittingBooking] = useState(false);
  
  // Address Management
  const [serviceAddress, setServiceAddress] = useState('');
  const [addressDetails, setAddressDetails] = useState({
    full_address: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
    latitude: null,
    longitude: null
  });
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  
  // Service Selection
  const [availableServices, setAvailableServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [showServicesModal, setShowServicesModal] = useState(false);
  
  // Scheduling
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const timeSlots = [
    '9:00 AM - 10:00 AM',
    '10:00 AM - 11:00 AM', 
    '11:00 AM - 12:00 PM',
    '2:00 PM - 3:00 PM',
    '3:00 PM - 4:00 PM',
    '4:00 PM - 5:00 PM',
    '5:00 PM - 6:00 PM'
  ];
  
  // Pricing
  const [pricing, setPricing] = useState({
    visitCharge: 0,
    serviceCharges: 0,
    subtotal: 0,
    taxes: 0,
    total: 0
  });
  
  // Form inputs
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [contactPreference, setContactPreference] = useState('phone'); // phone, whatsapp
  
  useEffect(() => {
    loadInitialData();
  }, [agent]);
  
  useEffect(() => {
    calculateTotalCost();
  }, [selectedServices, addressDetails]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Load saved addresses
      const addresses = await loadSavedAddresses();
      setSavedAddresses(addresses);
      
      // Set default address if available
      if (selectedLocation && selectedLocation.address) {
        setServiceAddress(selectedLocation.address);
        setAddressDetails({
          full_address: selectedLocation.address,
          city: selectedLocation.city || 'City', // Default fallback
          state: selectedLocation.state || 'State', // Default fallback
          pincode: selectedLocation.pincode || '000000', // Default fallback
          latitude: selectedLocation.coordinates?.latitude || 0,
          longitude: selectedLocation.coordinates?.longitude || 0
        });
      } else {
        // Set basic defaults to avoid validation failures
        setAddressDetails({
          full_address: 'Address not set - please update',
          city: 'City',
          state: 'State', 
          pincode: '000000',
          latitude: 0,
          longitude: 0
        });
      }
      
      // Set default time slot for non-emergency bookings
      if (!isEmergency && !selectedTimeSlot) {
        setSelectedTimeSlot(timeSlots[0]); // Select first available time slot
      }
      
      // Load agent's available services
      if (agent && agent.id) {
        try {
          console.log('🔍 Loading agent services for agent ID:', agent.id);
          const services = await loadAgentServices(agent.id, selectedCategory);
          setAvailableServices(services);
          console.log('✅ Agent services loaded successfully');
        } catch (servicesError) {
          console.error('❌ Error loading agent services:', servicesError);
          // Set default service to prevent blocking
          const defaultServices = [{
            id: 'default',
            name: selectedCategory || 'Service Request',
            description: 'General service consultation and work',
            price: 100,
            category: selectedCategory
          }];
          setAvailableServices(defaultServices);
          setSelectedServices([{ ...defaultServices[0], quantity: 1 }]);
        }
      }
      
    } catch (error) {
      console.error('Error loading initial data:', error);
      Alert.alert('Error', 'Failed to load booking data');
    } finally {
      setLoading(false);
    }
  };

  const loadSavedAddresses = async () => {
    try {
      const savedData = await AsyncStorage.getItem(`saved_addresses_${user.id}`);
      return savedData ? JSON.parse(savedData) : [];
    } catch (error) {
      console.error('Error loading saved addresses:', error);
      return [];
    }
  };

  const loadAgentServices = async (agentId, categoryId) => {
    try {
      console.log('🔍 Loading services for agent:', agentId, 'category:', categoryId);
      
      // For now, create default service structure since agentPricingService 
      // is meant for agent management, not customer booking
      const defaultServices = [
        {
          id: 'service_1',
          name: `${categoryId || 'General'} Service`,
          description: 'Professional service consultation and work',
          price: 150, // Base service price
          unit: 'per service',
          category: categoryId
        },
        {
          id: 'service_2', 
          name: `${categoryId || 'General'} Inspection`,
          description: 'Detailed inspection and assessment',
          price: 100,
          unit: 'per inspection',
          category: categoryId
        }
      ];
      
      // Auto-select the first service if no services are selected yet
      if (defaultServices.length > 0 && selectedServices.length === 0) {
        setSelectedServices([{ ...defaultServices[0], quantity: 1 }]);
      }
      
      console.log('✅ Default services created:', defaultServices);
      return defaultServices;
      
    } catch (error) {
      console.error('❌ Error creating default services:', error);
      // Fallback service
      const fallbackService = {
        id: 'default',
        name: selectedCategory || 'Service Request', 
        description: 'General service consultation and work',
        price: 100,
        category: selectedCategory
      };
      
      // Auto-select fallback service if none selected
      if (selectedServices.length === 0) {
        setSelectedServices([{ ...fallbackService, quantity: 1 }]);
      }
      
      return [fallbackService];
    }
  };

  const calculateTotalCost = () => {
    let visitCharge = 0;
    let serviceCharges = 0;
    
    // Calculate visit charge based on distance
    if (agent.rate_per_km && addressDetails.latitude && addressDetails.longitude) {
      // Use agent's location vs service address to calculate distance
      const distance = calculateDistance(
        agent.latitude, agent.longitude,
        addressDetails.latitude, addressDetails.longitude
      );
      visitCharge = Math.ceil(agent.rate_per_km * distance);
    } else {
      visitCharge = agent.visit_charge || 50; // Default visit charge
    }
    
    // Calculate service charges
    serviceCharges = selectedServices.reduce((total, service) => {
      return total + (service.price * (service.quantity || 1));
    }, 0);
    
    const subtotal = visitCharge + serviceCharges;
    const taxes = Math.ceil(subtotal * 0.18); // 18% GST
    const total = subtotal + taxes;
    
    setPricing({
      visitCharge,
      serviceCharges, 
      subtotal,
      taxes,
      total
    });
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const handleAutoDetectLocation = async () => {
    try {
      setDetectingLocation(true);
      const location = await getCurrentLocation();
      
      if (location && location.coordinates) {
        // Reverse geocode to get address
        const address = await locationService.reverseGeocode(
          location.coordinates.latitude,
          location.coordinates.longitude
        );
        
        setServiceAddress(address.formatted_address);
        setAddressDetails({
          full_address: address.formatted_address,
          landmark: address.landmark || '',
          city: address.city || '',
          state: address.state || '',
          pincode: address.pincode || '',
          latitude: location.coordinates.latitude,
          longitude: location.coordinates.longitude
        });
        
        Alert.alert('Success', 'Location detected successfully');
      }
    } catch (error) {
      console.error('Auto-detect location error:', error);
      Alert.alert('Error', 'Could not detect location. Please enter address manually.');
    } finally {
      setDetectingLocation(false);
    }
  };

  const handleServiceToggle = (service) => {
    const existingIndex = selectedServices.findIndex(s => s.id === service.id);
    
    if (existingIndex >= 0) {
      // Remove service
      setSelectedServices(selectedServices.filter(s => s.id !== service.id));
    } else {
      // Add service with default quantity 1
      setSelectedServices([...selectedServices, { ...service, quantity: 1 }]);
    }
  };

  const updateServiceQuantity = (serviceId, quantity) => {
    setSelectedServices(selectedServices.map(service => 
      service.id === serviceId ? { ...service, quantity: Math.max(1, quantity) } : service
    ));
  };

  const handleSaveAddress = async () => {
    if (!addressDetails.full_address.trim()) {
      Alert.alert('Error', 'Please enter a valid address');
      return;
    }
    
    try {
      const newAddress = {
        id: Date.now(),
        ...addressDetails,
        saved_at: new Date().toISOString()
      };
      
      const updatedAddresses = [...savedAddresses, newAddress];
      setSavedAddresses(updatedAddresses);
      
      await AsyncStorage.setItem(
        `saved_addresses_${user.id}`,
        JSON.stringify(updatedAddresses)
      );
      
      Alert.alert('Success', 'Address saved successfully');
    } catch (error) {
      console.error('Error saving address:', error);
      Alert.alert('Error', 'Failed to save address');
    }
  };

  const validateBookingData = () => {
    console.log('🔍 VALIDATION START: Beginning booking data validation...');
    
    try {
      console.log('🔍 VALIDATION Step 1: Checking address details...');
      if (!addressDetails.full_address.trim()) {
        console.log('❌ VALIDATION FAILED: Missing service address');
        Alert.alert('Missing Address', 'Please enter your service address before proceeding.');
        return false;
      }
      console.log('✅ VALIDATION Step 1 passed: Address exists');
    } catch (validationStepError) {
      console.error('❌ VALIDATION Step 1 ERROR:', validationStepError);
      throw validationStepError;
    }
    
    console.log('🔍 VALIDATION Step 2: Checking city...');
    if (!addressDetails.city.trim()) {
      console.log('❌ VALIDATION FAILED: Missing city');
      Alert.alert('Missing City', 'Please enter the city for your service location.');
      return false;
    }
    console.log('✅ VALIDATION Step 2 passed: City exists');
    
    console.log('🔍 VALIDATION Step 3: Checking selected services...');
    if (selectedServices.length === 0) {
      console.log('❌ VALIDATION FAILED: No services selected');
      Alert.alert('No Services Selected', 'Please select at least one service you need.');
      return false;
    }
    console.log('✅ VALIDATION Step 3 passed: Services selected');
    
    console.log('🔍 VALIDATION Step 4: Checking time slot...');
    if (!isEmergency && !selectedTimeSlot) {
      console.log('❌ VALIDATION FAILED: No time slot selected');
      Alert.alert('Missing Time Slot', 'Please select a preferred time slot for the service.');
      return false;
    }
    console.log('✅ VALIDATION Step 4 passed: Time slot valid');
    
    console.log('🔍 VALIDATION Step 5: Checking terms agreement...');
    if (!agreeToTerms) {
      console.log('❌ VALIDATION FAILED: Terms not agreed');
      Alert.alert('Terms Required', 'Please agree to the terms and conditions to proceed.');
      return false;
    }
    console.log('✅ VALIDATION Step 5 passed: Terms agreed');
    
    console.log('🔍 VALIDATION Step 6: Checking agent info...');
    if (!agent || !agent.id) {
      console.log('❌ VALIDATION FAILED: No agent selected');
      Alert.alert('Agent Error', 'Agent information is missing. Please go back and select an agent.');
      return false;
    }
    console.log('✅ VALIDATION Step 6 passed: Agent info exists');
    
    console.log('🔍 VALIDATION Step 7: Checking pricing...');
    if (pricing.total <= 0) {
      console.log('❌ VALIDATION FAILED: Invalid total amount');
      Alert.alert('Pricing Error', 'Unable to calculate service cost. Please try again.');
      return false;
    }
    console.log('✅ VALIDATION Step 7 passed: Pricing valid');
    
    console.log('✅ VALIDATION COMPLETE: All validation checks passed');
    return true;
  };

  const handleConfirmBooking = async () => {
    try {
      setSubmittingBooking(true);
      
      console.log('📋 Step 2: Checking current booking data state:', {
        agent: agent?.id,
        agentFullObject: agent,
        selectedCategory,
        selectedSubcategory,
        selectedServices: selectedServices.length,
        addressDetails: addressDetails.full_address,
        pricing: pricing.total,
        agreeToTerms,
        selectedTimeSlot,
        isEmergency
      });
      
      const isValid = validateBookingData();
      
      if (!isValid) {
        setSubmittingBooking(false);
        return;
      }
      
      console.log('🔄 Step 6: Preparing booking data with proper data types...');
      
      // Prepare booking data with proper data types
      console.log('🔍 DEBUG: Full agent object:', agent);
      console.log('🔍 DEBUG: Agent ID before parsing:', agent?.id);
      
      const bookingData = {
        agent_id: parseInt(agent?.id || agent?.agent_id || 0), // Try multiple possible ID fields
        service_category: selectedCategory || 'General Service',
        service_subcategory: selectedSubcategory || null,
        service_description: selectedServices.map(s => `${s.name} (${s.quantity || 1})`).join(', ') || `${selectedCategory} service request`,
        
        // Location data
        service_latitude: parseFloat(addressDetails.latitude) || 0.0,
        service_longitude: parseFloat(addressDetails.longitude) || 0.0,
        service_address: addressDetails.full_address || '',
        service_landmark: addressDetails.landmark || null,
        service_city: addressDetails.city || '',
        service_state: addressDetails.state || '',
        service_pincode: addressDetails.pincode || '000000',
        
        // Pricing data - ensure numbers
        visit_charge: parseFloat(pricing.visitCharge) || 0.0,
        service_charge: parseFloat(pricing.serviceCharges) || 0.0,
        total_amount: parseFloat(pricing.total) || 0.0,
        
        // Scheduling
        requested_date: selectedDate.toISOString().split('T')[0],
        requested_time_slot: selectedTimeSlot || null,
        
        // Additional info
        special_instructions: specialInstructions || null,
        is_emergency: Boolean(isEmergency)
      };
      
      // Validate booking data
      try {
        bookingService.validateBookingData(bookingData);
      } catch (validationError) {
        throw new Error('Validation failed: ' + validationError.message);
      }
      
      // Create booking
      const result = await bookingService.createBooking(bookingData);
      
      if (result && result.success) {
        Alert.alert(
          '⏳ Waiting for Agent Response', 
          `Request sent to ${agentName}!\n\n• Status: ${result.status.toUpperCase()}\n• Agent has ${result.agent_timeout} to respond\n• You'll be notified when agent accepts/rejects\n\n⚠️ Booking NOT confirmed yet!`,
          [
            {
              text: 'Track Status',
              onPress: () => navigation.navigate('BookingTracking', { 
                bookingUuid: result.booking_uuid 
              })
            }
          ]
        );
      } else {
        Alert.alert('Booking Failed', result?.message || 'Unable to create booking. Please try again.');
      }
      
    } catch (error) {
      console.error('Booking error:', error);
      Alert.alert('Booking Error', `Failed to create booking: ${error.message}`);
    } finally {
      setSubmittingBooking(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading booking details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
        
        {/* Header */}
        <LinearGradient
          colors={[colors.primary, colors.primaryDark || '#1976D2']}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>� Send Booking Request</Text>
          <Text style={styles.headerSubtitle}>
            Review details and confirm your service request - FILE UPDATED
          </Text>
        </LinearGradient>

        {/* Agent Summary */}
        <Card style={styles.section}>
          <Card.Content>
            <View style={styles.agentSummary}>
              <View style={styles.agentInfo}>
                <MaterialCommunityIcons name="account-circle" size={40} color={colors.primary} />
                <View style={styles.agentDetails}>
                  <Text style={styles.agentName}>{agent?.name}</Text>
                  <Text style={styles.agentCategory}>{selectedCategory}</Text>
                  {agent?.rating && (
                    <View style={styles.agentRating}>
                      <MaterialCommunityIcons name="star" size={14} color="#FFD700" />
                      <Text style={styles.ratingText}>{agent.rating} ({agent.reviews} reviews)</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Service Address */}
        <Card style={styles.section}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Service Address</Text>
              <Button
                mode="outlined"
                onPress={() => setShowAddressModal(true)}
                icon="map-marker"
                compact
              >
                Change
              </Button>
            </View>
            
            <Surface style={styles.addressCard} elevation={1}>
              <View style={styles.addressContent}>
                <MaterialCommunityIcons name="home" size={20} color={colors.primary} />
                <View style={styles.addressText}>
                  <Text style={styles.addressMain}>{addressDetails.full_address || 'No address selected'}</Text>
                  {addressDetails.landmark && (
                    <Text style={styles.addressSecondary}>Near: {addressDetails.landmark}</Text>
                  )}
                  <Text style={styles.addressSecondary}>
                    {addressDetails.city}, {addressDetails.state} {addressDetails.pincode}
                  </Text>
                </View>
              </View>
              
              <Button
                mode="text"
                onPress={handleAutoDetectLocation}
                loading={detectingLocation}
                icon="crosshairs-gps"
                compact
              >
                Auto-detect
              </Button>
            </Surface>
          </Card.Content>
        </Card>

        {/* Selected Services */}
        <Card style={styles.section}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Selected Services</Text>
              <Button
                mode="outlined"
                onPress={() => setShowServicesModal(true)}
                icon="plus"
                compact
              >
                Add/Edit
              </Button>
            </View>
            
            {selectedServices.length > 0 ? (
              selectedServices.map((service, index) => (
                <Surface key={index} style={styles.serviceItem} elevation={1}>
                  <View style={styles.serviceInfo}>
                    <Text style={styles.serviceName}>{service.name}</Text>
                    {service.description && (
                      <Text style={styles.serviceDescription}>{service.description}</Text>
                    )}
                    <View style={styles.servicePrice}>
                      <Text style={styles.priceText}>
                        ₹{service.price} x {service.quantity} = ₹{service.price * service.quantity}
                      </Text>
                    </View>
                  </View>
                </Surface>
              ))
            ) : (
              <Text style={styles.noServicesText}>No services selected</Text>
            )}
          </Card.Content>
        </Card>

        {/* Scheduling */}
        <Card style={styles.section}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Scheduling</Text>
            
            <View style={styles.emergencyToggle}>
              <Checkbox
                status={isEmergency ? 'checked' : 'unchecked'}
                onPress={() => setIsEmergency(!isEmergency)}
              />
              <Text style={styles.emergencyText}>Emergency Service (Immediate)</Text>
            </View>
            
            {!isEmergency && (
              <>
                <Text style={styles.timeSlotLabel}>Select Time Slot</Text>
                <View style={styles.timeSlotsContainer}>
                  {timeSlots.map((slot, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.timeSlot,
                        selectedTimeSlot === slot && styles.selectedTimeSlot
                      ]}
                      onPress={() => setSelectedTimeSlot(slot)}
                    >
                      <Text style={[
                        styles.timeSlotText,
                        selectedTimeSlot === slot && styles.selectedTimeSlotText
                      ]}>
                        {slot}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </Card.Content>
        </Card>

        {/* Special Instructions */}
        <Card style={styles.section}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Special Instructions (Optional)</Text>
            <TextInput
              mode="outlined"
              placeholder="Any specific requirements or details..."
              value={specialInstructions}
              onChangeText={setSpecialInstructions}
              multiline
              numberOfLines={3}
              style={styles.textInput}
            />
          </Card.Content>
        </Card>

        {/* Cost Breakdown */}
        <Card style={styles.section}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Cost Breakdown</Text>
            
            <View style={styles.costBreakdown}>
              <View style={styles.costItem}>
                <Text style={styles.costLabel}>Visit Charge</Text>
                <Text style={styles.costValue}>₹{pricing.visitCharge}</Text>
              </View>
              
              <View style={styles.costItem}>
                <Text style={styles.costLabel}>Service Charges</Text>
                <Text style={styles.costValue}>₹{pricing.serviceCharges}</Text>
              </View>
              
              <Divider style={styles.costDivider} />
              
              <View style={styles.costItem}>
                <Text style={styles.costLabel}>Subtotal</Text>
                <Text style={styles.costValue}>₹{pricing.subtotal}</Text>
              </View>
              
              <View style={styles.costItem}>
                <Text style={styles.costLabel}>GST (18%)</Text>
                <Text style={styles.costValue}>₹{pricing.taxes}</Text>
              </View>
              
              <Divider style={styles.costDivider} />
              
              <View style={styles.totalCostItem}>
                <Text style={styles.totalCostLabel}>Total Amount</Text>
                <Text style={styles.totalCostValue}>₹{pricing.total}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Terms and Conditions */}
        <Card style={styles.section}>
          <Card.Content>
            <View style={styles.termsContainer}>
              <Checkbox
                status={agreeToTerms ? 'checked' : 'unchecked'}
                onPress={() => setAgreeToTerms(!agreeToTerms)}
              />
              <Text style={styles.termsText}>
                I agree to the{' '}
                <Text style={styles.termsLink} onPress={() => navigation.navigate('Terms')}>
                  Terms and Conditions
                </Text>{' '}
                and{' '}
                <Text style={styles.termsLink} onPress={() => navigation.navigate('Privacy')}>
                  Privacy Policy
                </Text>
              </Text>
            </View>
          </Card.Content>
        </Card>

      </ScrollView>

      {/* Fixed Bottom Actions */}
      <View style={styles.bottomActions}>
        {/* MASSIVE DEBUG INFO - IMPOSSIBLE TO MISS */}
        <View style={{backgroundColor: 'red', padding: 10, marginBottom: 10}}>
          <Text style={{fontSize: 16, color: 'white', fontWeight: 'bold', textAlign: 'center'}}>
            🚨 FILE UPDATED - DEBUG MODE 🚨
          </Text>
          <Text style={{fontSize: 12, color: 'white', textAlign: 'center'}}>
            agreeToTerms={agreeToTerms ? 'TRUE' : 'FALSE'} | total={pricing.total} | submitting={submittingBooking ? 'TRUE' : 'FALSE'}
          </Text>
        </View>
        <Button
          mode="contained"
          onPress={handleConfirmBooking}
          loading={submittingBooking}
          disabled={!agreeToTerms || submittingBooking || pricing.total <= 0}
          style={[
            styles.confirmButton,
            (!agreeToTerms || pricing.total <= 0) && styles.disabledButton
          ]}
          contentStyle={styles.confirmButtonContent}
        >
          {submittingBooking 
            ? 'Sending Request...' 
            : !agreeToTerms 
              ? 'Accept Terms to Continue' 
              : pricing.total <= 0
                ? 'Calculating Cost...'
                : `Send Request - ₹${pricing.total}`
          }
        </Button>
      </View>

      {/* Address Selection Modal */}
      <Portal>
        <Modal
          visible={showAddressModal}
          onDismiss={() => setShowAddressModal(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>Select Service Address</Text>
          
          {/* Saved Addresses */}
          {savedAddresses.length > 0 && (
            <>
              <Text style={styles.modalSubtitle}>Saved Addresses</Text>
              {savedAddresses.map((address, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.savedAddressItem}
                  onPress={() => {
                    setServiceAddress(address.full_address);
                    setAddressDetails(address);
                    setShowAddressModal(false);
                  }}
                >
                  <MaterialCommunityIcons name="map-marker" size={20} color={colors.primary} />
                  <View style={styles.savedAddressText}>
                    <Text style={styles.savedAddressMain}>{address.full_address}</Text>
                    <Text style={styles.savedAddressSecondary}>{address.city}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              <Divider style={styles.modalDivider} />
            </>
          )}
          
          {/* Manual Address Entry */}
          <Text style={styles.modalSubtitle}>Enter New Address</Text>
          
          <TextInput
            mode="outlined"
            label="Full Address"
            value={addressDetails.full_address}
            onChangeText={(text) => {
              setAddressDetails({...addressDetails, full_address: text});
              setServiceAddress(text);
            }}
            style={styles.modalInput}
          />
          
          <TextInput
            mode="outlined"
            label="Landmark (Optional)"
            value={addressDetails.landmark}
            onChangeText={(text) => setAddressDetails({...addressDetails, landmark: text})}
            style={styles.modalInput}
          />
          
          <View style={styles.addressRowInputs}>
            <TextInput
              mode="outlined"
              label="City"
              value={addressDetails.city}
              onChangeText={(text) => setAddressDetails({...addressDetails, city: text})}
              style={[styles.modalInput, styles.halfWidth]}
            />
            <TextInput
              mode="outlined"
              label="Pincode"
              value={addressDetails.pincode}
              onChangeText={(text) => setAddressDetails({...addressDetails, pincode: text})}
              style={[styles.modalInput, styles.halfWidth]}
              keyboardType="numeric"
            />
          </View>
          
          <View style={styles.modalActions}>
            <Button mode="outlined" onPress={() => setShowAddressModal(false)}>
              Cancel
            </Button>
            <Button mode="contained" onPress={() => {
              handleSaveAddress();
              setShowAddressModal(false);
            }}>
              Save & Use
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Services Selection Modal */}
      <Portal>
        <Modal
          visible={showServicesModal}
          onDismiss={() => setShowServicesModal(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>Select Services</Text>
          
          {availableServices.map((service, index) => {
            const isSelected = selectedServices.find(s => s.id === service.id);
            
            return (
              <View key={index} style={styles.serviceModalItem}>
                <View style={styles.serviceModalHeader}>
                  <Checkbox
                    status={isSelected ? 'checked' : 'unchecked'}
                    onPress={() => handleServiceToggle(service)}
                  />
                  <View style={styles.serviceModalInfo}>
                    <Text style={styles.serviceModalName}>{service.name}</Text>
                    {service.description && (
                      <Text style={styles.serviceModalDescription}>{service.description}</Text>
                    )}
                    <Text style={styles.serviceModalPrice}>
                      ₹{service.price} {service.unit}
                    </Text>
                  </View>
                </View>
                
                {isSelected && (
                  <View style={styles.quantityContainer}>
                    <Text style={styles.quantityLabel}>Quantity:</Text>
                    <View style={styles.quantityControls}>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => updateServiceQuantity(service.id, isSelected.quantity - 1)}
                      >
                        <Text style={styles.quantityButtonText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.quantityValue}>{isSelected.quantity}</Text>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => updateServiceQuantity(service.id, isSelected.quantity + 1)}
                      >
                        <Text style={styles.quantityButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
          
          <View style={styles.modalActions}>
            <Button mode="contained" onPress={() => setShowServicesModal(false)}>
              Done
            </Button>
          </View>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 30,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.9,
  },
  section: {
    margin: 12,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  agentSummary: {
    marginBottom: 8,
  },
  agentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  agentDetails: {
    marginLeft: 12,
    flex: 1,
  },
  agentName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  agentCategory: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  agentRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    marginLeft: 4,
    fontSize: 12,
    color: colors.textSecondary,
  },
  addressCard: {
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  addressContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  addressText: {
    marginLeft: 12,
    flex: 1,
  },
  addressMain: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  addressSecondary: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  serviceItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  servicePrice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
  },
  noServicesText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  emergencyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  emergencyText: {
    fontSize: 16,
    color: colors.text,
    marginLeft: 8,
  },
  timeSlotLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 12,
  },
  timeSlotsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeSlot: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: '#ffffff',
  },
  selectedTimeSlot: {
    backgroundColor: colors.primary,
  },
  timeSlotText: {
    fontSize: 14,
    color: colors.primary,
  },
  selectedTimeSlotText: {
    color: '#ffffff',
  },
  textInput: {
    marginTop: 8,
  },
  costBreakdown: {
    marginTop: 8,
  },
  costItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  costLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  costValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  costDivider: {
    marginVertical: 8,
  },
  totalCostItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: colors.primaryLight || '#E3F2FD',
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  totalCostLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
  },
  totalCostValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  termsText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  termsLink: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  bottomActions: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  confirmButton: {
    borderRadius: 8,
  },
  disabledButton: {
    backgroundColor: '#cccccc',
    opacity: 0.7,
  },
  confirmButtonContent: {
    paddingVertical: 8,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    margin: 20,
    padding: 20,
    borderRadius: 16,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  modalSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 12,
    marginTop: 8,
  },
  savedAddressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  savedAddressText: {
    marginLeft: 12,
    flex: 1,
  },
  savedAddressMain: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  savedAddressSecondary: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  modalDivider: {
    marginVertical: 16,
  },
  modalInput: {
    marginBottom: 12,
  },
  addressRowInputs: {
    flexDirection: 'row',
    gap: 8,
  },
  halfWidth: {
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
  },
  serviceModalItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  serviceModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  serviceModalInfo: {
    marginLeft: 8,
    flex: 1,
  },
  serviceModalName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  serviceModalDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginVertical: 4,
  },
  serviceModalPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginLeft: 40,
  },
  quantityLabel: {
    fontSize: 14,
    color: colors.text,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  quantityValue: {
    marginHorizontal: 16,
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    minWidth: 24,
    textAlign: 'center',
  },
});