import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Card, Text, Button, ActivityIndicator, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useLocation } from '../contexts/LocationContext';
import { getAgentsByCategorySorted, getNearbyAgents } from '../services/agentListService';
import { colors } from '../theme';

export default function AgentListScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { selectedLocation } = useLocation();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Get category from route params (if navigated from category selection)
  const categoryId = route.params?.categoryId;
  const categoryName = route.params?.categoryName;

  useEffect(() => {
    loadAgents();
  }, [selectedLocation, categoryId]);

  const loadAgents = async () => {
    try {
      setLoading(true);
      
      let agentData = [];
      
      if (selectedLocation?.coordinates) {
        const { latitude, longitude } = selectedLocation.coordinates;
        
        if (categoryId) {
          // Get agents for specific category
          agentData = await getAgentsByCategorySorted(categoryId, latitude, longitude);
        } else {
          // Get nearby agents (general search)
          agentData = await getNearbyAgents(latitude, longitude, 25); // 25km radius
        }
      } else {
        // No location, get agents without location filtering
        agentData = await getAgentsByCategorySorted(categoryId);
      }
      
      setAgents(agentData);
    } catch (error) {
      console.error('Error loading agents:', error);
      // Keep existing agents or set empty array
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAgents();
  };

  const formatDistance = (distance) => {
    if (!distance) return 'Distance unknown';
    
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m away`;
    } else {
      return `${distance.toFixed(1)}km away`;
    }
  };

  const renderAgent = ({ item }) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={styles.agentInfo}>
            <Text style={styles.agentName}>{item.name}</Text>
            <View style={styles.ratingContainer}>
              <MaterialCommunityIcons name="star" size={16} color="#FFA726" />
              <Text style={styles.rating}>
                {item.avg_rating.toFixed(1)} ({item.total_ratings})
              </Text>
            </View>
          </View>
          <View style={styles.statusContainer}>
            <View style={[styles.statusIndicator, { 
              backgroundColor: item.is_online ? '#4CAF50' : '#9E9E9E' 
            }]} />
            <Text style={styles.statusText}>
              {item.is_online ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>
        
        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="currency-inr" size={16} color={colors.primary} />
            <Text style={styles.detailText}>₹{item.rate_per_km}/km</Text>
          </View>
          
          {item.distance_km && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="map-marker-distance" size={16} color={colors.primary} />
              <Text style={styles.detailText}>{formatDistance(item.distance_km)}</Text>
            </View>
          )}
        </View>
        
        {item.categories && item.categories.length > 0 && (
          <View style={styles.categoriesContainer}>
            {item.categories.slice(0, 3).map((category, index) => (
              <Chip key={index} style={styles.categoryChip} textStyle={styles.categoryText}>
                {category}
              </Chip>
            ))}
            {item.categories.length > 3 && (
              <Text style={styles.moreCategoriesText}>
                +{item.categories.length - 3} more
              </Text>
            )}
          </View>
        )}
      </Card.Content>
      
      <Card.Actions style={styles.cardActions}>
        <Button 
          mode="outlined" 
          onPress={() => navigation.navigate('AgentProfile', { agentId: item.id })}
          style={styles.profileButton}
        >
          View Profile
        </Button>
        <Button 
          mode="contained" 
          onPress={() => navigation.navigate('Booking', { 
            agentId: item.id, 
            agentName: item.name,
            categoryId: categoryId 
          })}
          style={styles.bookButton}
          disabled={!item.is_online}
        >
          {item.is_online ? 'Book Now' : 'Unavailable'}
        </Button>
      </Card.Actions>
    </Card>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>
          {categoryName ? `Finding ${categoryName} agents...` : 'Finding agents...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {categoryName && (
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>{categoryName} Agents</Text>
          {selectedLocation?.area && (
            <Text style={styles.headerSubtitle}>Near {selectedLocation.area}</Text>
          )}
        </View>
      )}
      
      <FlatList
        data={agents}
        keyExtractor={item => item.id.toString()}
        renderItem={renderAgent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="account-search" size={64} color="#9E9E9E" />
            <Text style={styles.emptyText}>No agents found</Text>
            <Text style={styles.emptySubtext}>
              Try adjusting your location or category filter
            </Text>
          </View>
        }
      />
    </View>
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
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  headerContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  listContainer: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
    backgroundColor: '#ffffff',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  agentInfo: {
    flex: 1,
  },
  agentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    marginLeft: 4,
    fontSize: 14,
    color: colors.textSecondary,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  detailsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    marginLeft: 4,
    fontSize: 14,
    color: colors.textPrimary,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryChip: {
    marginRight: 8,
    marginBottom: 4,
    backgroundColor: '#e3f2fd',
  },
  categoryText: {
    fontSize: 12,
    color: colors.primary,
  },
  moreCategoriesText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  cardActions: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  profileButton: {
    flex: 0.45,
  },
  bookButton: {
    flex: 0.45,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textSecondary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
});
