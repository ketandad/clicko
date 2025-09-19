import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Text, ActivityIndicator, Menu, Button } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useLocation } from '../contexts/LocationContext';
import { colors } from '../theme';

export default function LocationDisplay({ onLocationPress }) {
  const { 
    selectedLocation, 
    currentLocation, 
    loading, 
    error, 
    locationPermission,
    refreshLocation, 
    requestLocationPermission,
  } = useLocation();
  
  const [menuVisible, setMenuVisible] = useState(false);

  // Debug: Log the selected location whenever it changes
  React.useEffect(() => {
    if (selectedLocation) {
      console.log('🗺️ LocationDisplay: selectedLocation updated:', selectedLocation);
    }
  }, [selectedLocation]);

  const handleLocationPress = () => {
    if (onLocationPress) {
      onLocationPress();
    } else {
      setMenuVisible(true);
    }
  };

  const handleRefreshLocation = async () => {
    setMenuVisible(false);
    try {
      await refreshLocation();
    } catch (error) {
      Alert.alert('Error', 'Failed to refresh location. Please try again.');
    }
  };

  const handleEnableLocation = async () => {
    setMenuVisible(false);
    try {
      const granted = await requestLocationPermission();
      if (granted) {
        await refreshLocation();
      } else {
        Alert.alert(
          'Location Permission Required',
          'To provide better service recommendations, please enable location access in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => {
              // On real device, this would open settings
              console.log('Open device settings for location permission');
            }}
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to enable location. Please try again.');
    }
  };

  const renderLocationContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Getting location...</Text>
        </View>
      );
    }

    if (error && !selectedLocation) {
      return (
        <View style={styles.errorContainer}>
          <Icon name="map-marker-alert" size={16} color={colors.error} />
          <Text style={styles.errorText}>Location unavailable</Text>
        </View>
      );
    }

    if (selectedLocation) {
      console.log('🗺️ LocationDisplay: Rendering location:', {
        area: selectedLocation.area,
        city: selectedLocation.city,
        address: selectedLocation.address,
        formattedAddress: selectedLocation.formattedAddress,
        fullLocation: selectedLocation
      });
      
      // Get the best display text for the area
      const areaText = selectedLocation.area || selectedLocation.formattedAddress || selectedLocation.address || 'Current Location';
      const cityText = selectedLocation.city || '';
      
      console.log('🗺️ LocationDisplay: Final display text:', { areaText, cityText });
      
      return (
        <View style={styles.locationContainer}>
          <Icon 
            name="map-marker" 
            size={18} 
            color={selectedLocation === currentLocation ? colors.primary : colors.secondary} 
          />
          <View style={styles.locationTextContainer}>
            <Text style={styles.areaText} numberOfLines={1}>
              {areaText}
            </Text>
          </View>
          <Icon name="chevron-down" size={16} color={colors.textSecondary} />
        </View>
      );
    }

    // Fallback when no location is available
    return (
      <View style={styles.noLocationContainer}>
        <Icon name="map-marker-plus" size={16} color={colors.textSecondary} />
        <Text style={styles.noLocationText}>Tap to set location</Text>
      </View>
    );
  };

  return (
    <Menu
      visible={menuVisible}
      onDismiss={() => setMenuVisible(false)}
      anchor={
        <TouchableOpacity 
          style={styles.container} 
          onPress={handleLocationPress}
          activeOpacity={0.7}
        >
          {renderLocationContent()}
        </TouchableOpacity>
      }
      contentStyle={styles.menuContent}
    >
      {locationPermission !== 'granted' && (
        <Menu.Item
          onPress={handleEnableLocation}
          title="Enable Location"
          leadingIcon="map-marker-check"
        />
      )}
      
      {locationPermission === 'granted' && (
        <Menu.Item
          onPress={handleRefreshLocation}
          title="Refresh Location"
          leadingIcon="refresh"
        />
      )}
      
      <Menu.Item
        onPress={() => {
          setMenuVisible(false);
          if (onLocationPress) onLocationPress();
        }}
        title="Change Location"
        leadingIcon="map-marker-plus"
      />
      
      {currentLocation && selectedLocation !== currentLocation && (
        <Menu.Item
          onPress={() => {
            setMenuVisible(false);
            // TODO: Implement use current location
          }}
          title="Use Current Location"
          leadingIcon="crosshairs-gps"
        />
      )}
    </Menu>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    minWidth: 240,
    maxWidth: 320,
    borderWidth: 1,
    borderColor: '#e9ecef',
    alignSelf: 'flex-start',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginLeft: 6,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationTextContainer: {
    flex: 1,
    marginLeft: 8,
    marginRight: 8,
    minWidth: 100,
    justifyContent: 'center',
  },
  areaText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 16,
    letterSpacing: 0.1,
    flexShrink: 1,
  },
  cityText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 14,
    marginTop: 2,
    fontWeight: '500',
  },
  noLocationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noLocationText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 8,
    fontWeight: '600',
  },
  menuContent: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginTop: 4,
  },
});