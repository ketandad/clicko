import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ScrollView,
  StatusBar,
  RefreshControl,
  Dimensions
} from 'react-native';
import {
  Text,
  Searchbar,
  Card,
  Title,
  ActivityIndicator,
  Surface,
  Chip
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../contexts/LocationContext';
import { getCategories, getFeaturedCategories } from '../services/categoryService';
import { searchAgents } from '../services/searchService';
import LocationDisplay from '../components/LocationDisplay';
import LocationPickerModal from '../components/LocationPickerModal';
import { colors } from '../theme';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { selectedLocation } = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState([]);
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [featuredCategories, setFeaturedCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (categories.length > 0) {
      if (searchQuery.trim()) {
        performSearch();
      } else {
        filterCategories();
        setSearchResults([]);
      }
    }
  }, [searchQuery, categories, selectedLocation]);

  const loadData = async () => {
    try {
      setLoading(true);
      const categoriesData = await getCategories();
      const featuredData = await getFeaturedCategories();
      
      setCategories(categoriesData);
      setFeaturedCategories(featuredData);
      setFilteredCategories(categoriesData);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const filterCategories = () => {
    if (!searchQuery.trim()) {
      setFilteredCategories(categories);
      return;
    }
    
    const filtered = categories.filter(category => 
      category.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredCategories(filtered);
  };

  const performSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      
      let userLat = null;
      let userLng = null;
      
      if (selectedLocation?.coordinates) {
        userLat = selectedLocation.coordinates.latitude;
        userLng = selectedLocation.coordinates.longitude;
      }
      
      const results = await searchAgents(searchQuery, userLat, userLng);
      setSearchResults(results);
      
      // Also filter categories
      filterCategories();
    } catch (error) {
      console.error('Error performing search:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleCategorySelect = (category) => {
    navigation.navigate('AgentList', { 
      categoryId: category.id,
      categoryName: category.name 
    });
  };

  const renderFeaturedCategory = ({ item }) => (
    <TouchableOpacity
      style={styles.featuredItem}
      onPress={() => handleCategorySelect(item)}
    >
      <LinearGradient
        colors={[colors.primary, '#3f51b5']}
        style={styles.featuredGradient}
      >
        <Image 
          source={{ uri: item.icon_url || 'https://via.placeholder.com/100' }} 
          style={styles.featuredImage}
        />
        <Text style={styles.featuredTitle}>{item.name}</Text>
        <Text style={styles.featuredSubtitle}>
          {item.agent_count} Agents Available
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderCategory = ({ item }) => (
    <TouchableOpacity
      style={styles.categoryItem}
      onPress={() => handleCategorySelect(item)}
    >
      <Surface style={styles.categorySurface}>
        <Image
          source={{ uri: item.icon_url || 'https://via.placeholder.com/60' }}
          style={styles.categoryImage}
        />
        <Text style={styles.categoryName}>{item.name}</Text>
      </Surface>
    </TouchableOpacity>
  );

  const renderPopularSearch = (tag) => (
    <Chip 
      key={tag} 
      style={styles.chip} 
      onPress={() => setSearchQuery(tag)}
      mode="outlined"
    >
      {tag}
    </Chip>
  );

  const renderSearchResult = ({ item }) => (
    <TouchableOpacity
      style={styles.searchResultCard}
      onPress={() => navigation.navigate('AgentProfile', { agentId: item.id })}
    >
      <View style={styles.searchResultContent}>
        <View style={styles.searchResultHeader}>
          <Text style={styles.searchResultName}>{item.name}</Text>
          <View style={styles.searchResultRating}>
            <MaterialCommunityIcons name="star" size={14} color="#FFA726" />
            <Text style={styles.searchResultRatingText}>{item.avg_rating}</Text>
          </View>
        </View>
        
        <Text style={styles.searchResultCategories}>
          {item.categories.join(' • ')}
        </Text>
        
        <View style={styles.searchResultFooter}>
          <Text style={styles.searchResultRate}>₹{item.rate_per_km}/km</Text>
          {item.distance_km && (
            <Text style={styles.searchResultDistance}>
              {item.distance_km < 1 ? `${Math.round(item.distance_km * 1000)}m away` : `${item.distance_km.toFixed(1)}km away`}
            </Text>
          )}
          <View style={[styles.searchResultStatus, { 
            backgroundColor: item.is_online ? '#4CAF50' : '#9E9E9E' 
          }]}>
            <Text style={styles.searchResultStatusText}>
              {item.is_online ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading services...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      <View style={styles.header}>
        <View style={styles.topSection}>
          <View style={styles.locationSection}>
            <LocationDisplay onLocationPress={() => setLocationPickerVisible(true)} />
          </View>
        </View>
      </View>
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Searchbar
          placeholder="Search services..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
          iconColor={colors.primary}
        />
        
        {searchQuery.length > 0 && (
          <View style={styles.searchResultsSection}>
            <View style={styles.searchResultsHeader}>
              <Text style={styles.sectionTitle}>
                Search Results {searchLoading ? '' : `(${searchResults.length})`}
              </Text>
              {searchLoading && (
                <ActivityIndicator size="small" color={colors.primary} />
              )}
            </View>
            
            {searchResults.length > 0 && (
              <FlatList
                data={searchResults}
                renderItem={renderSearchResult}
                keyExtractor={(item) => item.id.toString()}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
              />
            )}
            
            {searchResults.length === 0 && !searchLoading && (
              <View style={styles.noSearchResults}>
                <MaterialCommunityIcons name="magnify" size={48} color="#9E9E9E" />
                <Text style={styles.noSearchResultsText}>No agents found</Text>
                <Text style={styles.noSearchResultsSubtext}>
                  Try different keywords or check your location
                </Text>
              </View>
            )}
            
            {filteredCategories.length > 0 && (
              <View style={styles.searchCategoriesSection}>
                <Text style={styles.sectionTitle}>Matching Categories</Text>
                <FlatList
                  data={filteredCategories}
                  renderItem={renderCategory}
                  numColumns={3}
                  keyExtractor={(item) => item.id.toString()}
                  scrollEnabled={false}
                  contentContainerStyle={styles.categoriesList}
                />
              </View>
            )}
          </View>
        )}
        
        {searchQuery.length === 0 && (
          <View style={styles.popularSearches}>
            <Text style={styles.sectionTitle}>Popular Searches</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagsContainer}>
              {['Electrician', 'Plumber', 'Cleaning', 'AC Repair', 'Carpenter'].map(renderPopularSearch)}
            </ScrollView>
          </View>
        )}
        
        {searchQuery.length === 0 && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Featured Services</Text>
              <FlatList
                data={featuredCategories}
                renderItem={renderFeaturedCategory}
                keyExtractor={(item) => item.id.toString()}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.featuredList}
              />
            </View>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>All Services</Text>
            </View>
          </>
        )}
        
        {filteredCategories.length > 0 ? (
          <FlatList
            data={filteredCategories}
            renderItem={renderCategory}
            keyExtractor={(item) => item.id.toString()}
            numColumns={3}
            scrollEnabled={false}
            contentContainerStyle={styles.categoriesList}
          />
        ) : (
          <View style={styles.noResults}>
            <MaterialCommunityIcons name="magnify-close" size={60} color={colors.textSecondary} />
            <Text style={styles.noResultsText}>No services found for "{searchQuery}"</Text>
          </View>
        )}
      </ScrollView>
      
      <LocationPickerModal
        visible={locationPickerVisible}
        onClose={() => setLocationPickerVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 10,
    color: colors.textSecondary,
  },
  header: {
    flexDirection: 'column',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e8e8e8',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  topSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  locationSection: {
    flex: 1,
    alignItems: 'flex-start',
  },
  searchbar: {
    margin: 16,
    elevation: 2,
    backgroundColor: '#ffffff',
    borderRadius: 12,
  },
  popularSearches: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    marginTop: 8,
    paddingBottom: 8,
  },
  chip: {
    marginRight: 8,
    backgroundColor: '#f0f4ff',
  },
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  featuredList: {
    paddingVertical: 8,
  },
  featuredItem: {
    width: width * 0.8,
    height: 160,
    marginRight: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  featuredGradient: {
    flex: 1,
    padding: 16,
    justifyContent: 'flex-end',
  },
  featuredImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.2,
  },
  featuredTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  featuredSubtitle: {
    color: '#ffffff',
    fontSize: 14,
    marginTop: 4,
  },
  categoriesList: {
    padding: 8,
  },
  categoryItem: {
    width: width / 3 - 16,
    margin: 8,
  },
  categorySurface: {
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    elevation: 1,
    backgroundColor: '#ffffff',
    height: 120,
  },
  categoryImage: {
    width: 50,
    height: 50,
    marginBottom: 8,
  },
  categoryName: {
    textAlign: 'center',
    fontSize: 13,
    color: colors.textPrimary,
  },
  noResults: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  noResultsText: {
    marginTop: 16,
    color: colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
  searchResultsSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  searchResultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchResultCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    flex: 1,
  },
  searchResultRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchResultRatingText: {
    marginLeft: 4,
    fontSize: 14,
    color: colors.textSecondary,
  },
  searchResultCategories: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  searchResultFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchResultRate: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  searchResultDistance: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  searchResultStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  searchResultStatusText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '500',
  },
  noSearchResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noSearchResultsText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textSecondary,
    marginTop: 12,
  },
  noSearchResultsSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  searchCategoriesSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
});
