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
import agentPricingService from '../services/agentPricingService';

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
          city: selectedLocation.city || '',
          state: selectedLocation.state || '',
          latitude: selectedLocation.coordinates?.latitude,
          longitude: selectedLocation.coordinates?.longitude
        });
      }
      
      // Load agent's available services
      if (agent && agent.id) {
        const services = await loadAgentServices(agent.id, selectedCategory);
        setAvailableServices(services);
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
      // Get agent's service pricing for the selected category
      const servicePricing = await agentPricingService.getAgentServicePricing(agentId, categoryId);
      return servicePricing.map(service => ({
        id: service.id,
        name: service.service_name,
        description: service.description,
        price: service.price || service.min_price,
        maxPrice: service.max_price,
        unit: service.unit || 'per service',
        category: service.category_name
      }));
    } catch (error) {
      console.error('Error loading agent services:', error);
      // Return default service structure if no specific pricing
      return [{
        id: 'default',
        name: selectedCategory || 'Service Request',
        description: 'General service consultation and work',
        price: 0, // Will be discussed with agent
        category: selectedCategory
      }];
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
    if (!addressDetails.full_address.trim()) {
      Alert.alert('Error', 'Please enter service address');
      return false;
    }
    
    if (!addressDetails.city.trim()) {
      Alert.alert('Error', 'Please enter city');
      return false;
    }
    
    if (selectedServices.length === 0) {
      Alert.alert('Error', 'Please select at least one service');
      return false;
    }
    
    if (!isEmergency && !selectedTimeSlot) {
      Alert.alert('Error', 'Please select a time slot');
      return false;
    }
    
    if (!agreeToTerms) {
      Alert.alert('Error', 'Please agree to terms and conditions');
      return false;
    }
    
    return true;
  };

  const handleConfirmBooking = async () => {
    if (!validateBookingData()) return;
    
    try {
      setSubmittingBooking(true);
      
      // Prepare booking data
      const bookingData = {
        agent_id: agent.id,
        service_category: selectedCategory,
        service_subcategory: selectedSubcategory,
        service_description: selectedServices.map(s => `${s.name} (${s.quantity})`).join(', '),
        
        // Location data
        service_latitude: addressDetails.latitude,
        service_longitude: addressDetails.longitude,
        service_address: addressDetails.full_address,
        service_landmark: addressDetails.landmark,
        service_city: addressDetails.city,
        service_state: addressDetails.state,
        service_pincode: addressDetails.pincode,
        
        // Pricing data
        visit_charge: pricing.visitCharge,
        service_charge: pricing.serviceCharges,
        total_amount: pricing.total,
        
        // Scheduling
        requested_date: selectedDate.toISOString().split('T')[0],
        requested_time_slot: selectedTimeSlot,
        
        // Additional info
        special_instructions: specialInstructions,
        is_emergency: isEmergency
      };
      
      // Validate booking data
      bookingService.validateBookingData(bookingData);
      
      // Create booking
      const result = await bookingService.createBooking(bookingData);
      
      if (result.success) {
        Alert.alert(
          'Booking Confirmed!', 
          `Your booking has been created successfully. The agent has been notified and will respond within 30 seconds.\\n\\nBooking ID: ${result.booking_uuid}`,
          [
            {
              text: 'Track Booking',
              onPress: () => navigation.navigate('BookingTracking', { 
                bookingUuid: result.booking_uuid 
              })
            }
          ]
        );
      }
      
    } catch (error) {
      console.error('Booking creation error:', error);
      Alert.alert('Error', error.message || 'Failed to create booking. Please try again.');
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
          <Text style={styles.headerTitle}>Confirm Booking</Text>
          <Text style={styles.headerSubtitle}>
            Review details and confirm your service request
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
        <Button
          mode="contained"
          onPress={handleConfirmBooking}
          loading={submittingBooking}
          disabled={!agreeToTerms || submittingBooking}
          style={styles.confirmButton}
          contentStyle={styles.confirmButtonContent}
        >
          {submittingBooking ? 'Creating Booking...' : `Confirm Booking - ₹${pricing.total}`}
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