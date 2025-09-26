import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
  Dimensions,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  ActivityIndicator,
  FAB,
  IconButton,
  Chip,
  Dialog,
  Portal,
  TextInput,
  RadioButton,
  Divider,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { getAgentSubCategories } from '../services/agentSubCategoryService';
import { colors } from '../theme';

const { width } = Dimensions.get('window');

const AgentPricingScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pricingList, setPricingList] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingPricing, setEditingPricing] = useState(null);
  const [subcategories, setSubcategories] = useState([]);

  // Form state
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [priceType, setPriceType] = useState('fixed');
  const [basePrice, setBasePrice] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadPricingData();
    loadSubcategories();
  }, []);

  const loadPricingData = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      // const response = await fetch(`${API_BASE_URL}/agents/service-pricing`, {
      //   headers: { 'Authorization': `Bearer ${user.token}` }
      // });
      // const data = await response.json();

      // Mock data for now
      const mockPricing = [
        {
          id: 1,
          sub_category_id: 1,
          sub_category_name: 'AC Installation',
          category_name: 'Home Appliances',
          price_type: 'fixed',
          base_price: 500,
          description: 'Standard window AC installation',
          is_active: true,
        },
        {
          id: 2,
          sub_category_id: 2,
          sub_category_name: 'AC Repair',
          category_name: 'Home Appliances',
          price_type: 'range',
          base_price: 200,
          min_price: 150,
          max_price: 800,
          description: 'Depends on issue complexity',
          is_active: true,
        },
        {
          id: 3,
          sub_category_id: 3,
          sub_category_name: 'Washing Machine Installation',
          category_name: 'Home Appliances',
          price_type: 'hourly',
          base_price: 100,
          description: 'Per hour rate',
          is_active: true,
        },
      ];

      setPricingList(mockPricing);
    } catch (error) {
      console.error('Error loading pricing data:', error);
      Alert.alert('Error', 'Failed to load pricing data');
    } finally {
      setLoading(false);
    }
  };

  const loadSubcategories = async () => {
    try {
      if (!user?.authToken) return;
      
      // Load agent's subcategories that don't have pricing yet
      const agentSubcategories = await getAgentSubCategories(user.authToken);
      
      // Filter out subcategories that already have pricing
      const subcategoriesWithoutPricing = agentSubcategories.filter(
        subcat => !subcat.has_pricing
      );
      
      setSubcategories(subcategoriesWithoutPricing);
    } catch (error) {
      console.error('Error loading subcategories:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPricingData();
    await loadSubcategories();
    setRefreshing(false);
  };

  const resetForm = () => {
    setSelectedSubcategory('');
    setPriceType('fixed');
    setBasePrice('');
    setMinPrice('');
    setMaxPrice('');
    setDescription('');
    setEditingPricing(null);
  };

  const openAddPricingDialog = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEditPricingDialog = (pricing) => {
    setEditingPricing(pricing);
    setSelectedSubcategory(pricing.sub_category_id.toString());
    setPriceType(pricing.price_type);
    setBasePrice(pricing.base_price.toString());
    setMinPrice(pricing.min_price ? pricing.min_price.toString() : '');
    setMaxPrice(pricing.max_price ? pricing.max_price.toString() : '');
    setDescription(pricing.description || '');
    setShowDialog(true);
  };

  const savePricing = async () => {
    if (!selectedSubcategory || !basePrice) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (priceType === 'range' && (!minPrice || !maxPrice)) {
      Alert.alert('Error', 'Range pricing requires both minimum and maximum prices');
      return;
    }

    if (priceType === 'range' && parseFloat(minPrice) >= parseFloat(maxPrice)) {
      Alert.alert('Error', 'Minimum price must be less than maximum price');
      return;
    }

    try {
      // TODO: Implement API call
      const pricingData = {
        sub_category_id: parseInt(selectedSubcategory),
        price_type: priceType,
        base_price: parseFloat(basePrice),
        min_price: priceType === 'range' ? parseFloat(minPrice) : null,
        max_price: priceType === 'range' ? parseFloat(maxPrice) : null,
        description,
      };

      if (editingPricing) {
        // Update existing pricing
        console.log('Update pricing:', pricingData);
      } else {
        // Create new pricing
        console.log('Create pricing:', pricingData);
      }

      setShowDialog(false);
      await loadPricingData();
      await loadSubcategories();
      
      Alert.alert(
        'Success',
        editingPricing ? 'Pricing updated successfully' : 'Pricing added successfully'
      );
    } catch (error) {
      console.error('Error saving pricing:', error);
      Alert.alert('Error', 'Failed to save pricing');
    }
  };

  const deletePricing = (pricingId) => {
    Alert.alert(
      'Delete Pricing',
      'Are you sure you want to delete this pricing?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // TODO: Implement API call
              console.log('Delete pricing:', pricingId);
              await loadPricingData();
              await loadSubcategories();
              Alert.alert('Success', 'Pricing deleted successfully');
            } catch (error) {
              console.error('Error deleting pricing:', error);
              Alert.alert('Error', 'Failed to delete pricing');
            }
          },
        },
      ]
    );
  };

  const togglePricingActive = async (pricingId, currentStatus) => {
    try {
      // TODO: Implement API call
      console.log('Toggle pricing active:', pricingId, !currentStatus);
      await loadPricingData();
    } catch (error) {
      console.error('Error toggling pricing status:', error);
      Alert.alert('Error', 'Failed to update pricing status');
    }
  };

  const renderPriceDisplay = (pricing) => {
    switch (pricing.price_type) {
      case 'fixed':
        return `₹${pricing.base_price}`;
      case 'hourly':
        return `₹${pricing.base_price}/hour`;
      case 'per_visit':
        return `₹${pricing.base_price}/visit`;
      case 'range':
        return `₹${pricing.min_price} - ₹${pricing.max_price}`;
      default:
        return `₹${pricing.base_price}`;
    }
  };

  const getPriceTypeLabel = (type) => {
    switch (type) {
      case 'fixed': return 'Fixed Price';
      case 'hourly': return 'Hourly Rate';
      case 'per_visit': return 'Per Visit';
      case 'range': return 'Price Range';
      default: return type;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading pricing data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <IconButton
            icon="arrow-left"
            iconColor="white"
            size={24}
            onPress={() => navigation.goBack()}
          />
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Service Pricing</Text>
            <Text style={styles.headerSubtitle}>
              Manage your service rates
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {pricingList.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <MaterialCommunityIcons
                name="currency-usd"
                size={64}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyTitle}>No Pricing Set</Text>
              <Text style={styles.emptySubtitle}>
                Add pricing for your services to help customers understand your rates
              </Text>
              <Button
                mode="contained"
                onPress={openAddPricingDialog}
                style={styles.emptyButton}
              >
                Add First Pricing
              </Button>
            </Card.Content>
          </Card>
        ) : (
          pricingList.map((pricing) => (
            <Card key={pricing.id} style={styles.pricingCard}>
              <Card.Content>
                <View style={styles.pricingHeader}>
                  <View style={styles.serviceInfo}>
                    <Text style={styles.serviceName}>
                      {pricing.sub_category_name}
                    </Text>
                    <Text style={styles.categoryName}>
                      {pricing.category_name}
                    </Text>
                  </View>
                  <View style={styles.pricingActions}>
                    <Chip
                      style={[
                        styles.statusChip,
                        !pricing.is_active && styles.inactiveChip,
                      ]}
                      textStyle={[
                        styles.statusText,
                        !pricing.is_active && styles.inactiveText,
                      ]}
                      onPress={() => togglePricingActive(pricing.id, pricing.is_active)}
                    >
                      {pricing.is_active ? 'Active' : 'Inactive'}
                    </Chip>
                  </View>
                </View>

                <View style={styles.priceContainer}>
                  <Text style={styles.priceAmount}>
                    {renderPriceDisplay(pricing)}
                  </Text>
                  <Chip style={styles.priceTypeChip}>
                    {getPriceTypeLabel(pricing.price_type)}
                  </Chip>
                </View>

                {pricing.description && (
                  <Text style={styles.description}>
                    {pricing.description}
                  </Text>
                )}

                <Divider style={styles.divider} />

                <View style={styles.actionButtons}>
                  <Button
                    mode="outlined"
                    onPress={() => openEditPricingDialog(pricing)}
                    style={styles.actionButton}
                    contentStyle={styles.buttonContent}
                  >
                    Edit
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={() => deletePricing(pricing.id)}
                    style={[styles.actionButton, styles.deleteButton]}
                    contentStyle={styles.buttonContent}
                    textColor={colors.error}
                  >
                    Delete
                  </Button>
                </View>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={openAddPricingDialog}
      />

      {/* Add/Edit Pricing Dialog */}
      <Portal>
        <Dialog visible={showDialog} onDismiss={() => setShowDialog(false)}>
          <Dialog.Title>
            {editingPricing ? 'Edit Pricing' : 'Add New Pricing'}
          </Dialog.Title>
          <Dialog.Content>
            <ScrollView style={styles.dialogContent}>
              {!editingPricing && (
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Service *</Text>
                  {/* TODO: Replace with proper dropdown */}
                  <TextInput
                    mode="outlined"
                    placeholder="Select service"
                    value={selectedSubcategory}
                    onChangeText={setSelectedSubcategory}
                    style={styles.input}
                  />
                </View>
              )}

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Price Type *</Text>
                <RadioButton.Group
                  onValueChange={setPriceType}
                  value={priceType}
                >
                  <View style={styles.radioOption}>
                    <RadioButton value="fixed" />
                    <Text style={styles.radioLabel}>Fixed Price</Text>
                  </View>
                  <View style={styles.radioOption}>
                    <RadioButton value="hourly" />
                    <Text style={styles.radioLabel}>Hourly Rate</Text>
                  </View>
                  <View style={styles.radioOption}>
                    <RadioButton value="per_visit" />
                    <Text style={styles.radioLabel}>Per Visit</Text>
                  </View>
                  <View style={styles.radioOption}>
                    <RadioButton value="range" />
                    <Text style={styles.radioLabel}>Price Range</Text>
                  </View>
                </RadioButton.Group>
              </View>

              {priceType === 'range' ? (
                <View style={styles.priceRangeContainer}>
                  <View style={styles.priceInputHalf}>
                    <Text style={styles.inputLabel}>Min Price *</Text>
                    <TextInput
                      mode="outlined"
                      placeholder="0"
                      value={minPrice}
                      onChangeText={setMinPrice}
                      keyboardType="numeric"
                      left={<TextInput.Icon icon={() => <Text>₹</Text>} />}
                      style={styles.input}
                    />
                  </View>
                  <View style={styles.priceInputHalf}>
                    <Text style={styles.inputLabel}>Max Price *</Text>
                    <TextInput
                      mode="outlined"
                      placeholder="0"
                      value={maxPrice}
                      onChangeText={setMaxPrice}
                      keyboardType="numeric"
                      left={<TextInput.Icon icon={() => <Text>₹</Text>} />}
                      style={styles.input}
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>
                    {priceType === 'hourly' ? 'Hourly Rate *' : 
                     priceType === 'per_visit' ? 'Per Visit Price *' : 'Price *'}
                  </Text>
                  <TextInput
                    mode="outlined"
                    placeholder="0"
                    value={basePrice}
                    onChangeText={setBasePrice}
                    keyboardType="numeric"
                    left={<TextInput.Icon icon={() => <Text>₹</Text>} />}
                    style={styles.input}
                  />
                </View>
              )}

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Description (Optional)</Text>
                <TextInput
                  mode="outlined"
                  placeholder="Add pricing details or notes..."
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  style={styles.input}
                />
              </View>
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDialog(false)}>Cancel</Button>
            <Button mode="contained" onPress={savePricing}>
              {editingPricing ? 'Update' : 'Add'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  header: {
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'white',
    opacity: 0.9,
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyCard: {
    marginTop: 40,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  emptyButton: {
    marginTop: 16,
  },
  pricingCard: {
    marginVertical: 8,
    elevation: 2,
  },
  pricingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  categoryName: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  pricingActions: {
    alignItems: 'flex-end',
  },
  statusChip: {
    backgroundColor: colors.success + '20',
  },
  statusText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: 'bold',
  },
  inactiveChip: {
    backgroundColor: colors.textSecondary + '20',
  },
  inactiveText: {
    color: colors.textSecondary,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  priceAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  priceTypeChip: {
    backgroundColor: colors.primary + '10',
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  divider: {
    marginVertical: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  buttonContent: {
    height: 36,
  },
  deleteButton: {
    borderColor: colors.error,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: colors.primary,
  },
  dialogContent: {
    maxHeight: 400,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surface,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  radioLabel: {
    marginLeft: 8,
    fontSize: 14,
    color: colors.text,
  },
  priceRangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priceInputHalf: {
    flex: 0.48,
  },
});

export default AgentPricingScreen;