import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert 
} from 'react-native';
import { TextInput, Text, Card, Chip, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';

// Mock Google Places API (replace with actual API key in production)
const GOOGLE_PLACES_API_KEY = 'YOUR_GOOGLE_PLACES_API_KEY';

export const AddressAutocomplete = ({ 
  value, 
  onAddressSelect,
  onAddressChange,
  label = 'Address',
  placeholder = 'Search for your address...',
  disabled = false,
  showCurrentLocation = true,
  style,
  ...props 
}) => {
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (value && typeof value === 'object') {
      setSelectedAddress(value);
      setQuery(value.formatted_address || value.address_line_1 || '');
    }
  }, [value]);

  // Debounced search function
  const searchPlaces = async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 3) {
      setPredictions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);
    
    try {
      // In production, use actual Google Places API
      // const response = await fetch(
      //   `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(searchQuery)}&key=${GOOGLE_PLACES_API_KEY}&components=country:in`
      // );
      // const data = await response.json();
      
      // Mock data for development
      const mockPredictions = [
        {
          place_id: '1',
          description: `${searchQuery}, Pune, Maharashtra, India`,
          structured_formatting: {
            main_text: searchQuery,
            secondary_text: 'Pune, Maharashtra, India'
          }
        },
        {
          place_id: '2', 
          description: `${searchQuery}, Mumbai, Maharashtra, India`,
          structured_formatting: {
            main_text: searchQuery,
            secondary_text: 'Mumbai, Maharashtra, India'
          }
        },
        {
          place_id: '3',
          description: `${searchQuery}, Bangalore, Karnataka, India`,
          structured_formatting: {
            main_text: searchQuery,
            secondary_text: 'Bangalore, Karnataka, India'
          }
        }
      ].filter(p => p.description.toLowerCase().includes(searchQuery.toLowerCase()));

      setPredictions(mockPredictions);
      setShowSuggestions(mockPredictions.length > 0);
    } catch (error) {
      console.error('Address search error:', error);
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (text) => {
    setQuery(text);
    setSelectedAddress(null);
    
    // Clear existing debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    // Set new debounce
    debounceRef.current = setTimeout(() => {
      searchPlaces(text);
    }, 300);
    
    onAddressChange && onAddressChange(text);
  };

  const getPlaceDetails = async (placeId, description) => {
    setLoading(true);
    
    try {
      // In production, use actual Google Places API
      // const response = await fetch(
      //   `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_address,geometry,address_components&key=${GOOGLE_PLACES_API_KEY}`
      // );
      // const data = await response.json();
      
      // Mock place details for development
      const parts = description.split(', ');
      const mockPlaceDetails = {
        result: {
          formatted_address: description,
          geometry: {
            location: {
              lat: 18.5204 + Math.random() * 0.1,
              lng: 73.8567 + Math.random() * 0.1
            }
          },
          address_components: [
            { long_name: parts[0] || '', short_name: parts[0] || '', types: ['premise'] },
            { long_name: parts[1] || '', short_name: parts[1] || '', types: ['locality'] },
            { long_name: parts[2] || '', short_name: parts[2] || '', types: ['administrative_area_level_1'] },
            { long_name: '411001', short_name: '411001', types: ['postal_code'] },
            { long_name: 'India', short_name: 'IN', types: ['country'] }
          ]
        }
      };

      const place = mockPlaceDetails.result;
      const addressComponents = place.address_components || [];
      
      // Parse address components
      const getComponent = (types) => {
        const component = addressComponents.find(comp => 
          comp.types.some(type => types.includes(type))
        );
        return component ? component.long_name : '';
      };

      const addressData = {
        google_place_id: placeId,
        formatted_address: place.formatted_address,
        address_line_1: getComponent(['street_number', 'route', 'premise']) || parts[0] || '',
        address_line_2: '',
        city: getComponent(['locality', 'administrative_area_level_2']) || parts[1] || '',
        state: getComponent(['administrative_area_level_1']) || parts[2] || '',
        postal_code: getComponent(['postal_code']) || '',
        country: getComponent(['country']) || 'India',
        coordinates: {
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng
        }
      };

      setSelectedAddress(addressData);
      setQuery(addressData.formatted_address);
      setShowSuggestions(false);
      onAddressSelect && onAddressSelect(addressData);
      
    } catch (error) {
      console.error('Place details error:', error);
      Alert.alert('Error', 'Failed to get address details');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      setLoading(true);
      
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to detect your current location.');
        return;
      }

      // Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Reverse geocode to get address
      const geocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (geocode && geocode.length > 0) {
        const address = geocode[0];
        const addressData = {
          google_place_id: `current_${Date.now()}`,
          formatted_address: `${address.street || ''} ${address.name || ''}, ${address.city || ''}, ${address.region || ''}, ${address.country || ''}`.trim(),
          address_line_1: `${address.street || ''} ${address.name || ''}`.trim(),
          address_line_2: '',
          city: address.city || address.subregion || '',
          state: address.region || '',
          postal_code: address.postalCode || '',
          country: address.country || 'India',
          coordinates: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude
          }
        };

        setSelectedAddress(addressData);
        setQuery(addressData.formatted_address);
        onAddressSelect && onAddressSelect(addressData);
      }
    } catch (error) {
      console.error('Current location error:', error);
      Alert.alert('Error', 'Failed to get current location');
    } finally {
      setLoading(false);
    }
  };

  const renderPrediction = ({ item }) => (
    <TouchableOpacity
      style={styles.predictionItem}
      onPress={() => getPlaceDetails(item.place_id, item.description)}
    >
      <MaterialCommunityIcons name="map-marker" size={20} color="#666" />
      <View style={styles.predictionText}>
        <Text style={styles.mainText}>{item.structured_formatting?.main_text || item.description}</Text>
        {item.structured_formatting?.secondary_text && (
          <Text style={styles.secondaryText}>{item.structured_formatting.secondary_text}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, style]}>
      <View style={styles.inputContainer}>
        <TextInput
          {...props}
          label={label}
          value={query}
          onChangeText={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          style={styles.input}
          right={
            loading ? (
              <TextInput.Icon icon={() => <ActivityIndicator size="small" />} />
            ) : (
              <TextInput.Icon 
                icon="magnify" 
                onPress={() => searchPlaces(query)}
              />
            )
          }
        />
        
        {showCurrentLocation && (
          <Button
            mode="outlined"
            icon="crosshairs-gps"
            onPress={getCurrentLocation}
            style={styles.locationButton}
            labelStyle={styles.locationButtonText}
            disabled={loading}
          >
            Use Current Location
          </Button>
        )}
      </View>

      {showSuggestions && predictions.length > 0 && (
        <Card style={styles.suggestionsCard}>
          <FlatList
            data={predictions}
            renderItem={renderPrediction}
            keyExtractor={(item) => item.place_id}
            style={styles.suggestionsList}
            keyboardShouldPersistTaps="always"
          />
        </Card>
      )}

      {selectedAddress && (
        <Card style={styles.selectedAddressCard}>
          <Card.Content>
            <View style={styles.selectedAddressHeader}>
              <MaterialCommunityIcons name="check-circle" size={20} color="#4CAF50" />
              <Text style={styles.selectedAddressTitle}>Selected Address</Text>
            </View>
            <Text style={styles.selectedAddressText}>{selectedAddress.formatted_address}</Text>
            
            <View style={styles.addressChips}>
              {selectedAddress.city && (
                <Chip style={styles.chip} textStyle={styles.chipText}>
                  {selectedAddress.city}
                </Chip>
              )}
              {selectedAddress.state && (
                <Chip style={styles.chip} textStyle={styles.chipText}>
                  {selectedAddress.state}
                </Chip>
              )}
              {selectedAddress.postal_code && (
                <Chip style={styles.chip} textStyle={styles.chipText}>
                  {selectedAddress.postal_code}
                </Chip>
              )}
            </View>
          </Card.Content>
        </Card>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'transparent',
  },
  locationButton: {
    marginTop: 8,
    borderColor: '#2196F3',
  },
  locationButtonText: {
    color: '#2196F3',
    fontSize: 12,
  },
  suggestionsCard: {
    maxHeight: 200,
    elevation: 4,
  },
  suggestionsList: {
    maxHeight: 200,
  },
  predictionItem: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  predictionText: {
    marginLeft: 12,
    flex: 1,
  },
  mainText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  secondaryText: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  selectedAddressCard: {
    marginTop: 8,
    backgroundColor: '#F8F9FA',
  },
  selectedAddressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectedAddressTitle: {
    marginLeft: 8,
    fontWeight: '600',
    color: '#4CAF50',
  },
  selectedAddressText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  addressChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  chip: {
    marginRight: 8,
    marginBottom: 4,
    backgroundColor: '#E3F2FD',
  },
  chipText: {
    fontSize: 12,
    color: '#1976D2',
  },
});

export default AddressAutocomplete;