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
  Chip,
  ActivityIndicator,
  TextInput,
  Modal,
  Portal,
  Divider,
  SegmentedButtons,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { getAgentSubCategories, getAvailableSubCategories, addAgentSubCategory, removeAgentSubCategory, getAgentCategories, getAvailableCategories, addAgentCategory, removeAgentCategory } from '../services/agentSubCategoryService';
import { getAgentServicePricing, createServicePricing, updateServicePricing, deleteServicePricing } from '../services/agentPricingService';
import { colors } from '../theme';

// Professional agent color scheme
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

export default function AgentServiceCRUD() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  
  // Tab state
  const [activeTab, setActiveTab] = useState('subcategories');
  
  // Data states
  const [agentSubCategories, setAgentSubCategories] = useState([]);
  const [agentCategories, setAgentCategories] = useState([]);
  const [availableSubCategories, setAvailableSubCategories] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  
  // Pricing form states
  const [priceType, setPriceType] = useState('fixed');
  const [basePrice, setBasePrice] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [priceDescription, setPriceDescription] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!user?.isAgent || !user?.authToken) return;
    
    setLoading(true);
    try {
      // Load agent's current subcategories
      const subCategories = await getAgentSubCategories(user.authToken);
      
      // Load pricing data
      const pricingData = await getAgentServicePricing(user.authToken);
      
      // Merge pricing info with subcategories
      const subcategoriesWithPricing = subCategories.map(subcat => {
        const pricing = pricingData.find(p => p.sub_category_id === subcat.id);
        return {
          ...subcat,
          pricing: pricing || null,
          has_pricing: !!pricing
        };
      });
      
      setAgentSubCategories(subcategoriesWithPricing);
      
      // Load agent's categories 
      const categories = await getAgentCategories(user.authToken);
      setAgentCategories(categories);
      
    } catch (error) {
      console.error('❌ Error loading service data:', error);
      Alert.alert('Error', 'Failed to load service data');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableSubCategories = async () => {
    if (!user?.authToken) return;
    
    try {
      const available = await getAvailableSubCategories(user.authToken);
      setAvailableSubCategories(available);
    } catch (error) {
      console.error('❌ Error loading available subcategories:', error);
      Alert.alert('Error', 'Failed to load available services');
    }
  };

  const loadAvailableCategories = async () => {
    if (!user?.authToken) return;
    
    try {
      const available = await getAvailableCategories(user.authToken);
      setAvailableCategories(available);
    } catch (error) {
      console.error('❌ Error loading available categories:', error);
      Alert.alert('Error', 'Failed to load available categories');
    }
  };

  const handleAddSubCategory = async (subCategoryId) => {
    if (!user?.authToken) return;
    
    try {
      await addAgentSubCategory(subCategoryId, user.authToken);
      Alert.alert('Success', 'Service added successfully');
      setShowAddModal(false);
      loadData(); // Refresh data
    } catch (error) {
      console.error('❌ Error adding subcategory:', error);
      Alert.alert('Error', error.message || 'Failed to add service');
    }
  };

  const handleAddCategory = async (categoryId) => {
    if (!user?.authToken) return;
    
    try {
      await addAgentCategory(categoryId, user.authToken);
      Alert.alert('Success', 'Category added successfully');
      setShowAddModal(false);
      loadData(); // Refresh data
    } catch (error) {
      console.error('❌ Error adding category:', error);
      Alert.alert('Error', error.message || 'Failed to add category');
    }
  };

  const handleRemoveCategory = async (categoryId, categoryName) => {
    Alert.alert(
      'Remove Category',
      `Are you sure you want to remove "${categoryName}" from your services?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeAgentCategory(categoryId, user.authToken);
              Alert.alert('Success', 'Category removed successfully');
              loadData(); // Refresh data
            } catch (error) {
              console.error('❌ Error removing category:', error);
              Alert.alert('Error', error.message || 'Failed to remove category');
            }
          }
        }
      ]
    );
  };

  const handleRemoveSubCategory = async (subCategoryId, serviceName) => {
    Alert.alert(
      'Remove Service',
      `Are you sure you want to remove "${serviceName}" from your services?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeAgentSubCategory(subCategoryId, user.authToken);
              Alert.alert('Success', 'Service removed successfully');
              loadData(); // Refresh data
            } catch (error) {
              console.error('❌ Error removing subcategory:', error);
              Alert.alert('Error', error.message || 'Failed to remove service');
            }
          }
        }
      ]
    );
  };

  const handleEditPricing = (service) => {
    setSelectedService(service);
    // Pre-fill existing pricing if available
    if (service.pricing) {
      setPriceType(service.pricing.price_type || 'fixed');
      setBasePrice(service.pricing.base_price?.toString() || '');
      setMinPrice(service.pricing.min_price?.toString() || '');
      setMaxPrice(service.pricing.max_price?.toString() || '');
      setPriceDescription(service.pricing.description || '');
    } else {
      // Reset form for new pricing
      setPriceType('fixed');
      setBasePrice('');
      setMinPrice('');
      setMaxPrice('');
      setPriceDescription('');
    }
    setShowPricingModal(true);
  };

  const handleDeletePricing = async (service) => {
    if (!service.pricing) return;
    
    Alert.alert(
      'Delete Pricing',
      `Are you sure you want to delete pricing for "${service.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteServicePricing(service.pricing.id, user.authToken);
              Alert.alert('Success', 'Pricing deleted successfully');
              loadData(); // Refresh data
            } catch (error) {
              console.error('❌ Error deleting pricing:', error);
              Alert.alert('Error', error.message || 'Failed to delete pricing');
            }
          }
        }
      ]
    );
  };

  const handleSavePricing = async () => {
    if (!selectedService || !basePrice) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }
    
    try {
      const pricingData = {
        sub_category_id: selectedService.id,
        price_type: priceType,
        base_price: parseFloat(basePrice),
        min_price: minPrice ? parseFloat(minPrice) : null,
        max_price: maxPrice ? parseFloat(maxPrice) : null,
        description: priceDescription || null,
      };
      
      if (selectedService.pricing) {
        // Update existing pricing
        await updateServicePricing(selectedService.pricing.id, {
          price_type: priceType,
          base_price: parseFloat(basePrice),
          min_price: minPrice ? parseFloat(minPrice) : null,
          max_price: maxPrice ? parseFloat(maxPrice) : null,
          description: priceDescription || null,
        }, user.authToken);
      } else {
        // Create new pricing
        await createServicePricing(pricingData, user.authToken);
      }
      
      Alert.alert('Success', 'Pricing saved successfully');
      setShowPricingModal(false);
      setSelectedService(null);
      loadData(); // Refresh data
    } catch (error) {
      console.error('❌ Error saving pricing:', error);
      Alert.alert('Error', error.message || 'Failed to save pricing');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const renderSubCategoriesTab = () => (
    <View style={styles.tabContent}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={agentColors.primary} />
          <Text style={styles.loadingText}>Loading services...</Text>
        </View>
      ) : agentSubCategories.length > 0 ? (
        <View style={styles.servicesList}>
          {agentSubCategories.map((service) => (
            <Card key={service.id} style={styles.serviceCard}>
              <Card.Content>
                <View style={styles.serviceHeader}>
                  <View style={styles.serviceInfo}>
                    <Text style={styles.serviceName}>{service.name}</Text>
                    <Text style={styles.categoryName}>{service.category_name}</Text>
                    {service.has_pricing ? (
                      <View style={styles.pricingTag}>
                        <Icon name="currency-usd" size={12} color={agentColors.success} />
                        <Text style={styles.pricingText}>
                          {service.pricing.price_type === 'range' 
                            ? `₹${service.pricing.min_price}-${service.pricing.max_price}`
                            : `₹${service.pricing.base_price}${service.pricing.price_type === 'hourly' ? '/hr' : ''}`
                          }
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.noPricingTag}>
                        <Text style={styles.noPricingText}>No pricing set</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.serviceActions}>
                    <TouchableOpacity 
                      onPress={() => handleEditPricing(service)}
                      style={[styles.actionButton, styles.editButton]}
                    >
                      <Icon name="currency-usd" size={16} color="white" />
                    </TouchableOpacity>
                    {service.has_pricing && (
                      <TouchableOpacity 
                        onPress={() => handleDeletePricing(service)}
                        style={[styles.actionButton, styles.warningButton]}
                      >
                        <Icon name="currency-remove" size={16} color="white" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity 
                      onPress={() => handleRemoveSubCategory(service.id, service.name)}
                      style={[styles.actionButton, styles.removeButton]}
                    >
                      <Icon name="close" size={16} color="white" />
                    </TouchableOpacity>
                  </View>
                </View>
              </Card.Content>
            </Card>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Icon name="briefcase-outline" size={64} color={agentColors.textSecondary} />
          <Text style={styles.emptyStateTitle}>No Specific Services</Text>
          <Text style={styles.emptyStateText}>
            Add specific services to enable pricing and detailed management
          </Text>
        </View>
      )}
    </View>
  );

  const renderCategoriesTab = () => (
    <View style={styles.tabContent}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={agentColors.primary} />
          <Text style={styles.loadingText}>Loading categories...</Text>
        </View>
      ) : agentCategories.length > 0 ? (
        <View style={styles.servicesList}>
          {agentCategories.map((category) => (
            <Card key={category.id} style={styles.serviceCard}>
              <Card.Content>
                <View style={styles.serviceHeader}>
                  <View style={styles.serviceInfo}>
                    <Text style={styles.serviceName}>{category.name}</Text>
                    <Text style={styles.categoryName}>Main Category</Text>
                    <View style={styles.categoryTag}>
                      <Icon name="folder" size={12} color={agentColors.primary} />
                      <Text style={styles.categoryTagText}>General Service Area</Text>
                    </View>
                  </View>
                  <View style={styles.serviceActions}>
                    <TouchableOpacity 
                      onPress={() => handleRemoveCategory(category.id, category.name)}
                      style={[styles.actionButton, styles.removeButton]}
                    >
                      <Icon name="close" size={16} color="white" />
                    </TouchableOpacity>
                  </View>
                </View>
              </Card.Content>
            </Card>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Icon name="folder-outline" size={64} color={agentColors.textSecondary} />
          <Text style={styles.emptyStateTitle}>No Categories Assigned</Text>
          <Text style={styles.emptyStateText}>
            Add main service categories to establish your general service areas
          </Text>
        </View>
      )}
    </View>
  );

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
          <Text style={styles.headerTitle}>Manage Services</Text>
          <TouchableOpacity 
            onPress={() => {
              if (activeTab === 'subcategories') {
                loadAvailableSubCategories();
              } else {
                loadAvailableCategories();
              }
              setShowAddModal(true);
            }}
            style={styles.addButton}
          >
            <Icon name="plus" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Tab Selector */}
        <Card style={styles.tabCard}>
          <Card.Content>
            <SegmentedButtons
              value={activeTab}
              onValueChange={setActiveTab}
              buttons={[
                {
                  value: 'subcategories',
                  label: 'My Services',
                  icon: 'tools',
                },
                {
                  value: 'categories', 
                  label: 'Categories',
                  icon: 'folder',
                },
              ]}
              style={styles.segmentedButtons}
            />
          </Card.Content>
        </Card>

        {/* Tab Content */}
        {activeTab === 'subcategories' ? renderSubCategoriesTab() : renderCategoriesTab()}
      </ScrollView>

      {/* Add Service Modal */}
      <Portal>
        <Modal 
          visible={showAddModal} 
          onDismiss={() => setShowAddModal(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Text style={styles.modalTitle}>
            {activeTab === 'subcategories' ? 'Add New Service' : 'Add New Category'}
          </Text>
          <ScrollView style={styles.modalContent}>
            {activeTab === 'subcategories' ? (
              availableSubCategories.map((subCategory) => (
                <TouchableOpacity
                  key={subCategory.id}
                  style={styles.availableServiceItem}
                  onPress={() => handleAddSubCategory(subCategory.id)}
                >
                  <View style={styles.serviceDetails}>
                    <Text style={styles.subCategoryName}>{subCategory.name}</Text>
                    <Text style={styles.subCategoryCategory}>
                      Category: {subCategory.category.name}
                    </Text>
                  </View>
                  <Icon name="plus-circle" size={24} color={agentColors.primary} />
                </TouchableOpacity>
              ))
            ) : (
              availableCategories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={styles.availableServiceItem}
                  onPress={() => handleAddCategory(category.id)}
                >
                  <View style={styles.serviceDetails}>
                    <Text style={styles.subCategoryName}>{category.name}</Text>
                    <Text style={styles.subCategoryCategory}>
                      {category.description || 'Main category'}
                    </Text>
                  </View>
                  <Icon name="plus-circle" size={24} color={agentColors.primary} />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
          <Button 
            mode="outlined" 
            onPress={() => setShowAddModal(false)}
            style={styles.modalCloseButton}
          >
            Close
          </Button>
        </Modal>
      </Portal>

      {/* Pricing Modal */}
      <Portal>
        <Modal 
          visible={showPricingModal} 
          onDismiss={() => setShowPricingModal(false)}
          contentContainerStyle={styles.pricingModalContainer}
        >
          <Text style={styles.modalTitle}>
            Set Pricing: {selectedService?.name}
          </Text>
          <ScrollView style={styles.pricingContent}>
            {/* Price Type Selection */}
            <Text style={styles.fieldLabel}>Price Type</Text>
            <SegmentedButtons
              value={priceType}
              onValueChange={setPriceType}
              buttons={[
                { value: 'fixed', label: 'Fixed' },
                { value: 'hourly', label: 'Hourly' },
                { value: 'range', label: 'Range' },
              ]}
              style={styles.priceTypeButtons}
            />

            {/* Base Price */}
            <TextInput
              label={priceType === 'hourly' ? 'Price per Hour (₹)' : 'Base Price (₹)'}
              value={basePrice}
              onChangeText={setBasePrice}
              keyboardType="numeric"
              style={styles.priceInput}
              mode="outlined"
            />

            {/* Range Prices (only for range type) */}
            {priceType === 'range' && (
              <>
                <TextInput
                  label="Minimum Price (₹)"
                  value={minPrice}
                  onChangeText={setMinPrice}
                  keyboardType="numeric"
                  style={styles.priceInput}
                  mode="outlined"
                />
                <TextInput
                  label="Maximum Price (₹)"
                  value={maxPrice}
                  onChangeText={setMaxPrice}
                  keyboardType="numeric"
                  style={styles.priceInput}
                  mode="outlined"
                />
              </>
            )}

            {/* Description */}
            <TextInput
              label="Pricing Notes (Optional)"
              value={priceDescription}
              onChangeText={setPriceDescription}
              multiline
              numberOfLines={3}
              style={styles.priceInput}
              mode="outlined"
            />
          </ScrollView>

          <View style={styles.pricingActions}>
            <Button 
              mode="outlined" 
              onPress={() => setShowPricingModal(false)}
              style={styles.pricingButton}
            >
              Cancel
            </Button>
            <Button 
              mode="contained" 
              onPress={handleSavePricing}
              style={[styles.pricingButton, { backgroundColor: agentColors.primary }]}
            >
              Save Pricing
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
    backgroundColor: agentColors.background,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
    textAlign: 'center',
    marginRight: 40, // Balance for add button
  },
  addButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  tabCard: {
    marginBottom: 16,
  },
  segmentedButtons: {
    backgroundColor: agentColors.surface,
  },
  tabContent: {
    minHeight: 400,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: agentColors.textSecondary,
  },
  servicesList: {
    gap: 12,
  },
  serviceCard: {
    backgroundColor: agentColors.surface,
    borderRadius: 12,
    elevation: 2,
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: agentColors.text,
    marginBottom: 4,
  },
  categoryName: {
    fontSize: 14,
    color: agentColors.textSecondary,
    marginBottom: 8,
  },
  pricingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: agentColors.success + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  pricingText: {
    fontSize: 12,
    color: agentColors.success,
    marginLeft: 4,
    fontWeight: '500',
  },
  noPricingTag: {
    backgroundColor: agentColors.warning + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  noPricingText: {
    fontSize: 12,
    color: agentColors.warning,
    fontWeight: '500',
  },
  serviceActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    backgroundColor: agentColors.primary,
  },
  warningButton: {
    backgroundColor: agentColors.warning,
  },
  removeButton: {
    backgroundColor: agentColors.error,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
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
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  comingSoonText: {
    fontSize: 16,
    color: agentColors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
  },
  // Modal Styles
  modalContainer: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: agentColors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalContent: {
    maxHeight: 400,
  },
  modalCloseButton: {
    marginTop: 16,
  },
  availableServiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: agentColors.border,
  },
  serviceDetails: {
    flex: 1,
  },
  subCategoryName: {
    fontSize: 16,
    fontWeight: '500',
    color: agentColors.text,
    marginBottom: 4,
  },
  subCategoryCategory: {
    fontSize: 14,
    color: agentColors.textSecondary,
  },
  // Pricing Modal Styles
  pricingModalContainer: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 16,
    padding: 20,
    maxHeight: '90%',
  },
  pricingContent: {
    maxHeight: 400,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: agentColors.text,
    marginBottom: 8,
    marginTop: 16,
  },
  priceTypeButtons: {
    marginBottom: 16,
  },
  priceInput: {
    marginBottom: 16,
  },
  pricingActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  pricingButton: {
    flex: 1,
  },
  // Category specific styles
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: agentColors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  categoryTagText: {
    fontSize: 12,
    color: agentColors.primary,
    marginLeft: 4,
    fontWeight: '500',
  },
});