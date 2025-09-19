import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  Modal, 
  ScrollView, 
  TouchableOpacity,
  Alert,
  FlatList 
} from 'react-native';
import { 
  Text, 
  Searchbar, 
  Button, 
  ActivityIndicator, 
  Card,
  Divider,
  IconButton
} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useLocation } from '../contexts/LocationContext';
import { colors } from '../theme';
import * as Location from 'expo-location';

export default function LocationPickerModal({ visible, onClose, onLocationSelect }) {
  const { 
    currentLocation, 
    selectedLocation, 
    selectLocation,
    getCurrentLocation,
    requestLocationPermission 
  } = useLocation();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [recentLocations, setRecentLocations] = useState([]);

  useEffect(() => {
    if (visible) {
      loadRecentLocations();
    }
  }, [visible]);

  const loadRecentLocations = () => {
    // Mock recent locations for now
    // TODO: Load from storage
    const mockRecent = [
      {
        id: 'home',
        name: 'Home',
        area: 'Downtown',
        city: 'San Francisco',
        address: '123 Main St, Downtown, San Francisco',
        coordinates: { latitude: 37.7749, longitude: -122.4194 },
        type: 'saved'
      },
      {
        id: 'work',
        name: 'Work',
        area: 'Financial District',
        city: 'San Francisco',
        address: '456 Business Ave, Financial District, San Francisco',
        coordinates: { latitude: 37.7849, longitude: -122.4094 },
        type: 'saved'
      }
    ];
    setRecentLocations(mockRecent);
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      // Use Expo Location geocoding for search
      const results = await Location.geocodeAsync(query);
      
      const formattedResults = await Promise.all(
        results.slice(0, 5).map(async (result, index) => {
          try {
            // Reverse geocode to get readable address
            const address = await Location.reverseGeocodeAsync({
              latitude: result.latitude,
              longitude: result.longitude,
            });
            
            const place = address[0];
            const area = place?.district || place?.subregion || place?.street || 'Unknown Area';
            const city = place?.city || place?.region || 'Unknown City';
            const formattedAddress = [
              place?.name,
              place?.street,
              place?.district,
              place?.city
            ].filter(Boolean).join(', ');

            return {
              id: `search_${index}`,
              name: query,
              area,
              city,
              address: formattedAddress,
              coordinates: {
                latitude: result.latitude,
                longitude: result.longitude
              },
              type: 'search'
            };
          } catch (error) {
            console.error('Error processing search result:', error);
            return {
              id: `search_${index}`,
              name: query,
              area: 'Unknown Area',
              city: 'Unknown City',
              address: 'Unknown Address',
              coordinates: {
                latitude: result.latitude,
                longitude: result.longitude
              },
              type: 'search'
            };
          }
        })
      );
      
      setSearchResults(formattedResults);
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Search Error', 'Failed to search locations. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    try {
      const location = await getCurrentLocation();
      if (location) {
        await selectLocation(location);
        if (onLocationSelect) {
          onLocationSelect(location);
        }
        onClose();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to get current location. Please try again.');
    }
  };

  const handleLocationSelect = async (location) => {
    try {
      const locationData = {
        coordinates: location.coordinates,
        area: location.area,
        city: location.city,
        address: location.address,
        timestamp: new Date().toISOString(),
      };
      
      await selectLocation(locationData);
      if (onLocationSelect) {
        onLocationSelect(locationData);
      }
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to select location. Please try again.');
    }
  };

  const renderLocationItem = ({ item }) => (
    <TouchableOpacity
      style={styles.locationItem}
      onPress={() => handleLocationSelect(item)}
    >
      <View style={styles.locationIcon}>
        {item.type === 'saved' ? (
          <Icon 
            name={item.id === 'home' ? 'home' : 'briefcase'} 
            size={20} 
            color={colors.primary} 
          />
        ) : (
          <Icon name="map-marker" size={20} color={colors.textSecondary} />
        )}
      </View>
      
      <View style={styles.locationDetails}>
        <Text style={styles.locationName}>{item.name}</Text>
        <Text style={styles.locationArea}>{item.area}, {item.city}</Text>
        {item.address && (
          <Text style={styles.locationAddress} numberOfLines={1}>
            {item.address}
          </Text>
        )}
      </View>
      
      {selectedLocation?.coordinates?.latitude === item.coordinates?.latitude &&
       selectedLocation?.coordinates?.longitude === item.coordinates?.longitude && (
        <Icon name="check-circle" size={20} color={colors.primary} />
      )}
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton 
            icon="close" 
            size={24} 
            onPress={onClose}
            iconColor={colors.text}
          />
          <Text style={styles.headerTitle}>Select Location</Text>
          <View style={{ width: 48 }} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Searchbar
            placeholder="Search for area, landmark..."
            onChangeText={handleSearch}
            value={searchQuery}
            style={styles.searchBar}
            loading={searching}
          />
        </View>

        {/* Current Location Button */}
        <TouchableOpacity 
          style={styles.currentLocationButton}
          onPress={handleUseCurrentLocation}
        >
          <Icon name="crosshairs-gps" size={20} color={colors.primary} />
          <Text style={styles.currentLocationText}>Use current location</Text>
          {currentLocation && (
            <Text style={styles.currentLocationSubtext}>
              {currentLocation.area}, {currentLocation.city}
            </Text>
          )}
        </TouchableOpacity>

        <Divider style={styles.divider} />

        {/* Results */}
        <ScrollView style={styles.scrollView}>
          {searchQuery.length >= 3 && searchResults.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Search Results</Text>
              <FlatList
                data={searchResults}
                renderItem={renderLocationItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            </View>
          )}

          {searchQuery.length < 3 && recentLocations.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Saved Locations</Text>
              <FlatList
                data={recentLocations}
                renderItem={renderLocationItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            </View>
          )}

          {searchQuery.length >= 3 && searchResults.length === 0 && !searching && (
            <View style={styles.noResults}>
              <Icon name="map-marker-off" size={48} color={colors.textSecondary} />
              <Text style={styles.noResultsText}>No locations found</Text>
              <Text style={styles.noResultsSubtext}>
                Try searching with a different keyword
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: colors.surface,
  },
  searchBar: {
    elevation: 0,
    backgroundColor: colors.background,
  },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  currentLocationText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primary,
    marginLeft: 12,
    flex: 1,
  },
  currentLocationSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 12,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    paddingHorizontal: 16,
    paddingBottom: 8,
    textTransform: 'uppercase',
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  locationIcon: {
    width: 40,
    alignItems: 'center',
  },
  locationDetails: {
    flex: 1,
    marginLeft: 8,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  locationArea: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  locationAddress: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.text,
    marginTop: 16,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
});