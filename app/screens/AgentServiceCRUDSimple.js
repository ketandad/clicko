import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Button,
  Card,
  ActivityIndicator,
  TextInput,
  Modal,
  Portal,
  Divider,
  FAB,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import * as SecureStore from 'expo-secure-store';
import { 
  getAgentSubCategories, 
  getAvailableSubCategories, 
  addAgentSubCategory, 
  removeAgentSubCategory 
} from '../services/agentSubCategoryService';
import { 
  getAgentServicePricing, 
  createServicePricing, 
  updateServicePricing 
} from '../services/agentPricingService';

// Clean, modern color scheme
const theme = {
  primary: '#2563EB',
  surface: '#FFFFFF',
  background: '#F8FAFC',
  text: '#1E293B',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  shadow: '#00000010',
};

export default function AgentServiceCRUD() {
  const navigation = useNavigation();
  const { user } = useAuth();
  
  // Main data
  const [services, setServices] = useState([]);
  const [availableServices, setAvailableServices] = useState([]);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Inline editing
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [editingPrice, setEditingPrice] = useState('');

  useEffect(() => {
    console.log('🔄 useEffect triggered - calling loadServices');
    loadServices();
  }, []);

  const loadServices = async () => {
    console.log('🔄 loadServices called');
    console.log('👤 User:', user?.id ? 'Logged in' : 'Not logged in');
    
    // Get token directly from SecureStore like other services do
    const authToken = await SecureStore.getItemAsync('userToken');
    console.log('🔑 Auth token:', authToken ? 'Available' : 'Missing');
    
    if (!authToken) {
      console.log('❌ No auth token, showing sample data');
      setServices([
        {
          id: 1,
          name: 'Sample Service - No Auth',
          category_name: 'Demo Category',
          pricing: { base_price: 299, description: 'Demo pricing (no auth)' }
        }
      ]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      console.log('🔄 Loading agent services...');
      
      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 8000)
      );
      
      // Load current services with timeout
      console.log('📞 Calling getAgentSubCategories...');
      const agentServices = await Promise.race([
        getAgentSubCategories(authToken),
        timeoutPromise
      ]);
      
      // Load pricing data with timeout (but don't fail if pricing fails)
      console.log('📞 Calling getAgentServicePricing...');
      let pricingData = [];
      try {
        pricingData = await Promise.race([
          getAgentServicePricing(authToken),
          timeoutPromise
        ]);
        console.log('✅ Pricing data loaded:', pricingData.length);
      } catch (pricingError) {
        console.log('⚠️ Pricing failed, continuing with services only:', pricingError.message);
        // Don't fail the whole operation if pricing fails
        pricingData = [];
      }
      
      // Merge pricing with services (default to ₹0 if no pricing)
      const servicesWithPricing = agentServices.map(service => ({
        ...service,
        pricing: pricingData.find(p => p.sub_category_id === service.id) || {
          base_price: 0,
          description: 'Default pricing - click to update'
        }
      }));
      
      setServices(servicesWithPricing);
      console.log('✅ Services loaded:', servicesWithPricing.length);
      
    } catch (error) {
      console.error('❌ Error loading services:', error);
      console.error('❌ Error details:', error.message);
      
      // Always show sample data when there's an error in development
      console.log('🔧 Using sample data due to error');
      setServices([
        {
          id: 1,
          name: 'Washing Machine Repair',
          category_name: 'Appliance Repair',
          pricing: { base_price: 500, description: 'Basic repair service' }
        },
        {
          id: 2, 
          name: 'TV Repair',
          category_name: 'Electronics Repair',
          pricing: { base_price: 800, description: 'TV diagnostic and repair' }
        },
        {
          id: 3, 
          name: 'Microwave Service',
          category_name: 'Appliance Repair', 
          pricing: null
        }
      ]);
      
      if (error.message.includes('timeout') || error.message === 'Request timeout') {
        Alert.alert('Using Demo Data', 'Server timeout - showing sample services for testing.');
      } else if (error.message.includes('Network')) {
        Alert.alert('Using Demo Data', 'Network error - showing sample services for testing.');
      } else {
        Alert.alert('Using Demo Data', 'API error - showing sample services for testing.');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableServices = async () => {
    const authToken = await SecureStore.getItemAsync('userToken');
    if (!authToken) return;
    
    try {
      const available = await getAvailableSubCategories(authToken);
      setAvailableServices(available);
    } catch (error) {
      console.error('❌ Error loading available services:', error);
      Alert.alert('Error', 'Failed to load available services');
    }
  };

  const handleAddService = async (serviceId) => {
    const authToken = await SecureStore.getItemAsync('userToken');
    if (!authToken) return;
    
    try {
      await addAgentSubCategory(serviceId, authToken);
      setShowAddModal(false);
      loadServices();
      Alert.alert('Success', 'Service added successfully');
    } catch (error) {
      console.error('❌ Error adding service:', error);
      Alert.alert('Error', error.message || 'Failed to add service');
    }
  };

  const handleRemoveService = (service) => {
    Alert.alert(
      'Remove Service',
      `Remove "${service.name}" from your services?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const authToken = await SecureStore.getItemAsync('userToken');
              if (!authToken) return;
              
              await removeAgentSubCategory(service.id, authToken);
              loadServices();
              Alert.alert('Success', 'Service removed successfully');
            } catch (error) {
              console.error('❌ Error removing service:', error);
              Alert.alert('Error', error.message || 'Failed to remove service');
            }
          }
        }
      ]
    );
  };



  // Inline price editing functions
  const handleStartPriceEdit = (service) => {
    setEditingPriceId(service.id);
    setEditingPrice((service.pricing?.base_price || 0).toString());
  };

  const handleSaveInlinePrice = async (service) => {
    const authToken = await SecureStore.getItemAsync('userToken');
    if (!authToken) return;

    try {
      const newPrice = parseFloat(editingPrice) || 0;
      const pricingData = {
        sub_category_id: service.id,
        base_price: newPrice
      };
      
      // Only include description if it exists
      if (service.pricing?.description) {
        pricingData.description = service.pricing.description;
      }

      if (service.pricing && service.pricing.id) {
        console.log('🔄 Updating price inline for service:', service.id);
        await updateServicePricing(service.pricing.id, pricingData, authToken);
      } else {
        console.log('➕ Creating price inline for service:', service.id);
        await createServicePricing(pricingData, authToken);
      }

      setEditingPriceId(null);
      setEditingPrice('');
      loadServices();
    } catch (error) {
      console.error('❌ Error saving inline price:', error);
      Alert.alert('Error', error.message || 'Failed to update price');
      setEditingPriceId(null);
    }
  };

  const handleCancelPriceEdit = () => {
    setEditingPriceId(null);
    setEditingPrice('');
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadServices().finally(() => setRefreshing(false));
  };

  const renderServiceItem = (service) => (
    <Card key={service.id} style={styles.serviceCard}>
      <Card.Content style={styles.serviceContent}>
        <View style={styles.serviceInfo}>
          <Text style={styles.serviceName}>{service.name}</Text>
          <Text style={styles.categoryName}>{service.category_name}</Text>
          
          <View style={styles.pricingContainer}>
            {editingPriceId === service.id ? (
              <View style={styles.inlineEditContainer}>
                <Icon name="currency-inr" size={16} color={theme.success} />
                <TextInput
                  value={editingPrice}
                  onChangeText={setEditingPrice}
                  keyboardType="numeric"
                  style={styles.inlineInput}
                  autoFocus
                  selectTextOnFocus
                  onBlur={() => handleSaveInlinePrice(service)}
                  onSubmitEditing={() => handleSaveInlinePrice(service)}
                />
                <TouchableOpacity onPress={handleCancelPriceEdit} style={styles.cancelEdit}>
                  <Icon name="close" size={16} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.priceDisplayContainer}>
                <Icon name="currency-inr" size={16} color={service.pricing?.base_price > 0 ? theme.success : theme.warning} />
                <TouchableOpacity onPress={() => handleStartPriceEdit(service)}>
                  <Text style={[styles.pricingText, { 
                    color: service.pricing?.base_price > 0 ? theme.success : theme.warning 
                  }]}>
                    {service.pricing?.base_price || 0}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleStartPriceEdit(service)} style={styles.editPriceIcon}>
                  <Icon name="pencil" size={14} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.removeButton]}
            onPress={() => handleRemoveService(service)}
            disabled={editingPriceId === service.id}
          >
            <Icon name="delete" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </Card.Content>
    </Card>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={[theme.primary, '#1E40AF']} style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Icon name="arrow-left" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Manage Services</Text>
            <View style={{ width: 24 }} />
          </View>
        </LinearGradient>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading services...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient colors={[theme.primary, '#1E40AF']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Manage Services</Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      {/* Services List */}
      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {services.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="tools" size={64} color={theme.textSecondary} />
            <Text style={styles.emptyTitle}>No Services Added</Text>
            <Text style={styles.emptyText}>
              Add services to start receiving bookings from customers
            </Text>
            <Button 
              mode="contained" 
              onPress={loadServices}
              style={{ marginTop: 20 }}
            >
              Retry Loading
            </Button>
          </View>
        ) : (
          <View style={styles.servicesList}>
            {services.map(renderServiceItem)}
          </View>
        )}
      </ScrollView>

      {/* Floating Add Button */}
      <FAB
        style={styles.fab}
        icon="plus"
        color="white"
        onPress={() => {
          loadAvailableServices();
          setShowAddModal(true);
        }}
      />

      {/* Add Service Modal */}
      <Portal>
        <Modal 
          visible={showAddModal} 
          onDismiss={() => setShowAddModal(false)}
          contentContainerStyle={styles.modal}
        >
          <Text style={styles.modalTitle}>Add Service</Text>
          <Divider style={styles.divider} />
          
          <ScrollView style={styles.modalContent}>
            {availableServices.length === 0 ? (
              <View style={styles.noServicesContainer}>
                <Icon name="check-circle" size={48} color={theme.success} />
                <Text style={styles.noServicesText}>
                  All available services have been added!
                </Text>
              </View>
            ) : (
              availableServices.map((service) => (
                <TouchableOpacity
                  key={service.id}
                  style={styles.availableServiceItem}
                  onPress={() => handleAddService(service.id)}
                >
                  <View style={styles.serviceDetails}>
                    <Text style={styles.availableServiceName}>{service.name}</Text>
                    <Text style={styles.availableServiceCategory}>{service.category_name}</Text>
                  </View>
                  <Icon name="plus-circle" size={24} color={theme.primary} />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
          
          <Button 
            mode="outlined" 
            onPress={() => setShowAddModal(false)}
            style={styles.modalButton}
          >
            Close
          </Button>
        </Modal>
      </Portal>


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  content: {
    flex: 1,
    padding: 20,
    backgroundColor: theme.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.textSecondary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 22,
  },
  servicesList: {
    gap: 12,
  },
  serviceCard: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    marginVertical: 6,
  },
  serviceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  categoryName: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: 12,
    fontWeight: '500',
  },
  pricingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary + '08', // 5% opacity
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.primary + '20', // 20% opacity
  },
  pricingText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.success,
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  defaultPricing: {
    fontSize: 11,
    color: theme.textSecondary,
    fontStyle: 'italic',
    marginLeft: 6,
    fontWeight: '500',
  },
  noPricing: {
    fontSize: 14,
    color: theme.warning,
    fontStyle: 'italic',
    backgroundColor: theme.warning + '10',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginLeft: 16,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  editButton: {
    backgroundColor: theme.primary,
  },
  removeButton: {
    backgroundColor: theme.error,
  },
  fab: {
    position: 'absolute',
    margin: 20,
    right: 0,
    bottom: 0,
    backgroundColor: theme.primary,
    borderRadius: 28,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modal: {
    backgroundColor: theme.surface,
    margin: 20,
    borderRadius: 20,
    padding: 24,
    maxHeight: '80%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.text,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  modalSubtitle: {
    fontSize: 16,
    color: theme.primary,
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600',
  },
  modalHint: {
    fontSize: 13,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  divider: {
    marginVertical: 20,
    height: 1,
    backgroundColor: theme.primary + '30',
  },
  modalContent: {
    maxHeight: 300,
  },
  modalButton: {
    marginTop: 16,
  },
  availableServiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginVertical: 4,
    borderRadius: 12,
    backgroundColor: theme.surface + 'F0',
    borderWidth: 1,
    borderColor: theme.border + '30',
  },
  serviceDetails: {
    flex: 1,
  },
  availableServiceName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.text,
    marginBottom: 4,
  },
  availableServiceCategory: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  noServicesContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noServicesText: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 16,
  },
  pricingForm: {
    gap: 20,
  },
  input: {
    backgroundColor: theme.surface,
    borderRadius: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 28,
    gap: 16,
  },
  modalActionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  inlineEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  inlineInput: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: theme.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 80,
    fontSize: 16,
    fontWeight: '700',
    color: theme.success,
    textAlign: 'center',
  },
  cancelEdit: {
    marginLeft: 8,
    padding: 6,
    borderRadius: 16,
    backgroundColor: theme.error + '15',
  },
  priceDisplayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editPriceIcon: {
    marginLeft: 8,
    padding: 4,
    borderRadius: 12,
    backgroundColor: theme.primary + '10',
  },
});