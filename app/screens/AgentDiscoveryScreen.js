import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  Alert,
  Dimensions
} from 'react-native';
import {
  Searchbar,
  FAB,
  Portal,
  Modal,
  Text,
  Button,
  Chip,
  Surface,
  ActivityIndicator
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme';
import AgentCard from '../components/AgentCard';
import { nearbyAgentsService } from '../services/nearbyAgentsService';
import { userLocationService } from '../services/userLocationService';
import { getSubCategories } from '../services/subCategoryService';

const { height: screenHeight } = Dimensions.get('window');

const SORT_OPTIONS = [
  { key: 'distance', label: 'Distance', icon: 'map-marker-distance' },
  { key: 'rating', label: 'Rating', icon: 'star' },
  { key: 'experience', label: 'Experience', icon: 'school' },
  { key: 'price', label: 'Price', icon: 'currency-inr' }
];

const RATING_FILTERS = [
  { key: 'all', label: 'All Ratings', minRating: 0 },
  { key: '4plus', label: '4.0+ Stars', minRating: 4.0 },
  { key: '4.5plus', label: '4.5+ Stars', minRating: 4.5 }
];

const DISTANCE_FILTERS = [
  { key: 'all', label: 'Any Distance', maxDistance: null },
  { key: '2km', label: 'Within 2 km', maxDistance: 2 },
  { key: '5km', label: 'Within 5 km', maxDistance: 5 },
  { key: '10km', label: 'Within 10 km', maxDistance: 10 }
];

const AgentDiscoveryScreen = ({ navigation, route }) => {
  const { serviceCategory, categoryId } = route?.params || {};

  const [agents, setAgents] = useState([]);
  const [filteredAgents, setFilteredAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  
  // Subcategory states
  const [subCategories, setSubCategories] = useState([]);
  const [selectedSubCategories, setSelectedSubCategories] = useState([]);
  const [loadingSubCategories, setLoadingSubCategories] = useState(false);
  
  // Filter and sort states
  const [sortBy, setSortBy] = useState('distance');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [distanceFilter, setDistanceFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Error states
  const [error, setError] = useState(null);
  const [locationError, setLocationError] = useState(null);

  const loadUserLocation = useCallback(async () => {
    try {
      const location = await userLocationService.getCurrentLocation();
      setUserLocation(location);
      setLocationError(null);
      return location;
    } catch (error) {
      console.error('Failed to get user location:', error);
      setLocationError(error.message);
      Alert.alert(
        'Location Required',
        'Please enable location services to find nearby agents.',
        [
          { text: 'Cancel' },
          { text: 'Retry', onPress: loadUserLocation }
        ]
      );
      return null;
    }
  }, []);

  const loadNearbyAgents = useCallback(async (location = null, forceRefresh = false) => {
    if (!location && !userLocation) {
      const newLocation = await loadUserLocation();
      if (!newLocation) return;
      location = newLocation;
    }

    const currentLocation = location || userLocation;
    
    try {
      setError(null);
      const nearbyAgents = await nearbyAgentsService.findNearbyAgents({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        radius: 10, // 10km default radius
        sortBy: sortBy,
        category: serviceCategory,
        forceRefresh
      });

      setAgents(nearbyAgents);
      setError(null);
    } catch (error) {
      console.error('Failed to load nearby agents:', error);
      setError(error.message);
      Alert.alert('Error', 'Failed to load nearby agents. Please try again.');
    }
  }, [userLocation, sortBy, serviceCategory, loadUserLocation]);

  const loadSubCategories = useCallback(async () => {
    if (!categoryId) return;
    
    try {
      setLoadingSubCategories(true);
      const subCategoriesData = await getSubCategories(categoryId);
      setSubCategories(subCategoriesData);
    } catch (error) {
      console.error('Failed to load subcategories:', error);
      // Don't show error alert for subcategories as it's not critical
    } finally {
      setLoadingSubCategories(false);
    }
  }, [categoryId]);

  const applyFilters = useCallback(() => {
    let filtered = [...agents];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(agent => 
        agent.name.toLowerCase().includes(query) ||
        (agent.bio && agent.bio.toLowerCase().includes(query)) ||
        (agent.categories && agent.categories.some(cat => 
          cat.toLowerCase().includes(query)
        ))
      );
    }

    // Apply rating filter
    const ratingConfig = RATING_FILTERS.find(r => r.key === ratingFilter);
    if (ratingConfig && ratingConfig.minRating > 0) {
      filtered = filtered.filter(agent => 
        agent.avg_rating >= ratingConfig.minRating
      );
    }

    // Apply distance filter
    const distanceConfig = DISTANCE_FILTERS.find(d => d.key === distanceFilter);
    if (distanceConfig && distanceConfig.maxDistance) {
      filtered = filtered.filter(agent => 
        agent.distance_km <= distanceConfig.maxDistance
      );
    }

    // Apply subcategory filter
    if (selectedSubCategories.length > 0) {
      filtered = filtered.filter(agent => 
        selectedSubCategories.some(subCatId => 
          agent.sub_categories?.some(agentSubCat => agentSubCat.id === subCatId)
        )
      );
    }

    setFilteredAgents(filtered);
  }, [agents, searchQuery, ratingFilter, distanceFilter, selectedSubCategories]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  useEffect(() => {
    const initializeScreen = async () => {
      setLoading(true);
      await Promise.all([
        loadNearbyAgents(null, false),
        loadSubCategories()
      ]);
      setLoading(false);
    };

    initializeScreen();
  }, [loadNearbyAgents, loadSubCategories]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNearbyAgents(null, true);
    setRefreshing(false);
  }, [loadNearbyAgents]);

  const toggleSubCategory = (subCategoryId) => {
    setSelectedSubCategories(prev => 
      prev.includes(subCategoryId)
        ? prev.filter(id => id !== subCategoryId)
        : [...prev, subCategoryId]
    );
  };

  const clearSubCategoryFilter = () => {
    setSelectedSubCategories([]);
  };

  const handleAgentPress = useCallback((agent) => {
    // Get the selected subcategory name if any
    const selectedSubcategoryName = selectedSubCategories.length > 0 
      ? subCategories.find(sub => sub.id === selectedSubCategories[0])?.name 
      : null;
      
    // Go directly to booking - skip unnecessary detail screen
    navigation.navigate('BookingConfirmation', { 
      agent,
      selectedCategory: serviceCategory,
      selectedSubcategory: selectedSubcategoryName
    });
  }, [navigation, serviceCategory, selectedSubCategories, subCategories]);

  const handleBookAgent = useCallback((agent) => {
    navigation.navigate('BookingEstimate', { agent });
  }, [navigation]);

  const handleCallAgent = useCallback((agent) => {
    // TODO: Implement call functionality
    Alert.alert('Call Agent', `Calling ${agent.name}...`);
  }, []);

  const handleSortChange = useCallback(async (newSortBy) => {
    setSortBy(newSortBy);
    setShowFilters(false);
    setLoading(true);
    await loadNearbyAgents(userLocation, true);
    setLoading(false);
  }, [loadNearbyAgents, userLocation]);

  const renderAgentItem = ({ item }) => (
    <AgentCard
      agent={item}
      onViewPricing={handleAgentPress}
      onBookNow={handleBookAgent}
      onCallAgent={handleCallAgent}
      showCallButton={true}
      style={styles.agentCard}
    />
  );

  const renderFilterModal = () => (
    <Portal>
      <Modal
        visible={showFilters}
        onDismiss={() => setShowFilters(false)}
        contentContainerStyle={styles.modalContainer}
      >
        <Surface style={styles.filterContent}>
          <Text style={styles.filterTitle}>Filter & Sort</Text>

          {/* Sort Options */}
          <Text style={styles.sectionTitle}>Sort By</Text>
          <View style={styles.chipContainer}>
            {SORT_OPTIONS.map((option) => (
              <Chip
                key={option.key}
                style={[
                  styles.filterChip,
                  sortBy === option.key && styles.selectedChip
                ]}
                textStyle={[
                  styles.chipText,
                  sortBy === option.key && styles.selectedChipText
                ]}
                selected={sortBy === option.key}
                onPress={() => handleSortChange(option.key)}
                icon={option.icon}
              >
                {option.label}
              </Chip>
            ))}
          </View>

          {/* Rating Filter */}
          <Text style={styles.sectionTitle}>Minimum Rating</Text>
          <View style={styles.chipContainer}>
            {RATING_FILTERS.map((option) => (
              <Chip
                key={option.key}
                style={[
                  styles.filterChip,
                  ratingFilter === option.key && styles.selectedChip
                ]}
                textStyle={[
                  styles.chipText,
                  ratingFilter === option.key && styles.selectedChipText
                ]}
                selected={ratingFilter === option.key}
                onPress={() => setRatingFilter(option.key)}
              >
                {option.label}
              </Chip>
            ))}
          </View>

          {/* Distance Filter */}
          <Text style={styles.sectionTitle}>Distance</Text>
          <View style={styles.chipContainer}>
            {DISTANCE_FILTERS.map((option) => (
              <Chip
                key={option.key}
                style={[
                  styles.filterChip,
                  distanceFilter === option.key && styles.selectedChip
                ]}
                textStyle={[
                  styles.chipText,
                  distanceFilter === option.key && styles.selectedChipText
                ]}
                selected={distanceFilter === option.key}
                onPress={() => setDistanceFilter(option.key)}
              >
                {option.label}
              </Chip>
            ))}
          </View>

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => {
                setSortBy('distance');
                setRatingFilter('all');
                setDistanceFilter('all');
              }}
              style={styles.resetButton}
            >
              Reset
            </Button>
            <Button
              mode="contained"
              onPress={() => setShowFilters(false)}
              style={styles.applyButton}
              buttonColor={colors.primary}
            >
              Apply
            </Button>
          </View>
        </Surface>
      </Modal>
    </Portal>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons
        name="account-search"
        size={64}
        color={colors.textSecondary}
        style={styles.emptyIcon}
      />
      <Text style={styles.emptyTitle}>No Agents Found</Text>
      <Text style={styles.emptyText}>
        {searchQuery
          ? 'Try adjusting your search or filters'
          : locationError
          ? 'Location services are required to find nearby agents'
          : 'No agents available in your area right now'}
      </Text>
      {locationError && (
        <Button
          mode="contained"
          onPress={loadUserLocation}
          style={styles.retryButton}
          buttonColor={colors.primary}
        >
          Enable Location
        </Button>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search agents by name or service..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
        />
      </View>

      {/* Subcategory Filters */}
      {subCategories.length > 0 && (
        <View style={styles.subCategoryContainer}>
          <View style={styles.subCategoryHeader}>
            <Text style={styles.subCategoryTitle}>Filter by Service Type:</Text>
            {selectedSubCategories.length > 0 && (
              <Button 
                mode="text" 
                compact 
                onPress={clearSubCategoryFilter}
                labelStyle={styles.clearFilterText}
              >
                Clear All
              </Button>
            )}
          </View>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={subCategories}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <Chip
                key={item.id}
                selected={selectedSubCategories.includes(item.id)}
                onPress={() => toggleSubCategory(item.id)}
                style={[
                  styles.subCategoryChip,
                  selectedSubCategories.includes(item.id) && styles.selectedSubCategoryChip
                ]}
                textStyle={[
                  styles.subCategoryChipText,
                  selectedSubCategories.includes(item.id) && styles.selectedSubCategoryChipText
                ]}
              >
                {item.name}
              </Chip>
            )}
            contentContainerStyle={styles.subCategoryList}
          />
        </View>
      )}

      {/* Results Header */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>
          {filteredAgents.length} agent{filteredAgents.length !== 1 ? 's' : ''} nearby
        </Text>
        {serviceCategory && (
          <Chip style={styles.categoryChip} compact>
            {serviceCategory}
          </Chip>
        )}
      </View>

      {/* Agents List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Finding nearby agents...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredAgents}
          renderItem={renderAgentItem}
          keyExtractor={(item) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={renderEmptyState}
        />
      )}

      {/* Filter FAB */}
      <FAB
        icon="filter-variant"
        style={styles.fab}
        onPress={() => setShowFilters(true)}
        label={sortBy !== 'distance' || ratingFilter !== 'all' || distanceFilter !== 'all' ? 'Filtered' : 'Filter'}
      />

      {/* Filter Modal */}
      {renderFilterModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    elevation: 2,
  },
  searchBar: {
    elevation: 0,
    backgroundColor: colors.background,
  },
  searchInput: {
    fontSize: 14,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  resultsCount: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  categoryChip: {
    backgroundColor: colors.primaryLight,
  },
  listContainer: {
    flexGrow: 1,
    paddingBottom: 80, // Space for FAB
  },
  agentCard: {
    marginVertical: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  retryButton: {
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: colors.primary,
  },
  modalContainer: {
    margin: 20,
  },
  filterContent: {
    padding: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  filterTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  filterChip: {
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: colors.background,
  },
  selectedChip: {
    backgroundColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    color: colors.text,
  },
  selectedChipText: {
    color: '#ffffff',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  resetButton: {
    flex: 1,
    marginRight: 8,
  },
  applyButton: {
    flex: 1,
    marginLeft: 8,
  },
  // Subcategory filter styles
  subCategoryContainer: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  subCategoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subCategoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  clearFilterText: {
    fontSize: 12,
    color: colors.primary,
  },
  subCategoryList: {
    paddingVertical: 4,
  },
  subCategoryChip: {
    marginRight: 8,
    backgroundColor: '#ffffff',
    borderColor: colors.primary,
    borderWidth: 1,
  },
  selectedSubCategoryChip: {
    backgroundColor: colors.primary,
  },
  subCategoryChipText: {
    fontSize: 12,
    color: colors.primary,
  },
  selectedSubCategoryChipText: {
    color: '#ffffff',
  },
});

export default AgentDiscoveryScreen;