import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Image, Dimensions } from 'react-native';
import { Card, Text, Chip, Button, Surface, Divider, Avatar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme';

const { width } = Dimensions.get('window');

// Enhanced sample data with more realistic booking information
const bookings = [
  { 
    id: '1', 
    agent: 'Rajesh Kumar', 
    service: 'AC Repair & Service',
    scheduledTime: new Date(Date.now() + 3600000), 
    status: 'confirmed',
    price: 450,
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
    rating: 4.8,
    address: 'Pimple Saudagar, Pune',
    bookingId: '#BK001',
    category: 'Home Repair'
  },
  { 
    id: '2', 
    agent: 'Priya Sharma', 
    service: 'House Cleaning',
    scheduledTime: new Date(Date.now() - 86400000), 
    status: 'completed',
    price: 280,
    avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b606?w=100&h=100&fit=crop&crop=face',
    rating: 4.9,
    address: 'Baner, Pune',
    bookingId: '#BK002',
    category: 'Cleaning'
  },
  { 
    id: '3', 
    agent: 'Amit Patel', 
    service: 'Plumbing Repair',
    scheduledTime: new Date(Date.now() + 7200000), 
    status: 'in_progress',
    price: 320,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
    rating: 4.6,
    address: 'Wakad, Pune',
    bookingId: '#BK003',
    category: 'Plumbing'
  },
  { 
    id: '4', 
    agent: 'Sunita Mehta', 
    service: 'Electrical Work',
    scheduledTime: new Date(Date.now() - 172800000), 
    status: 'cancelled',
    price: 500,
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
    rating: 4.5,
    address: 'Hinjewadi, Pune',
    bookingId: '#BK004',
    category: 'Electrical'
  },
];

export default function MyBookingsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return '#2196F3';
      case 'completed': return '#4CAF50';
      case 'in_progress': return '#FF9800';
      case 'cancelled': return '#f44336';
      default: return '#757575';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'confirmed': return 'Confirmed';
      case 'completed': return 'Completed';
      case 'in_progress': return 'In Progress';
      case 'cancelled': return 'Cancelled';
      default: return 'Unknown';
    }
  };

  const formatDate = (date) => {
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return `Today, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Tomorrow, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === -1) {
      return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const filteredBookings = bookings.filter(booking => {
    if (selectedFilter === 'all') return true;
    return booking.status === selectedFilter;
  });

  const renderBookingCard = ({ item }) => (
    <TouchableOpacity activeOpacity={0.95}>
      <Card style={styles.bookingCard}>
        <Card.Content style={styles.cardContent}>
          {/* Header with Booking ID and Status */}
          <View style={styles.cardHeader}>
            <Text style={styles.bookingId}>{item.bookingId}</Text>
            <Chip 
              style={[styles.statusChip, { backgroundColor: getStatusColor(item.status) + '20' }]}
              textStyle={[styles.statusText, { color: getStatusColor(item.status) }]}
            >
              {getStatusText(item.status)}
            </Chip>
          </View>

          {/* Agent Info */}
          <View style={styles.agentSection}>
            <Avatar.Image 
              source={{ uri: item.avatar }} 
              size={50}
              style={styles.avatar}
            />
            <View style={styles.agentInfo}>
              <Text style={styles.agentName}>{item.agent}</Text>
              <Text style={styles.serviceText}>{item.service}</Text>
              <View style={styles.ratingContainer}>
                <MaterialCommunityIcons name="star" size={14} color="#FFA726" />
                <Text style={styles.ratingText}>{item.rating}</Text>
                <Text style={styles.categoryText}>• {item.category}</Text>
              </View>
            </View>
            <View style={styles.priceContainer}>
              <Text style={styles.priceText}>₹{item.price}</Text>
            </View>
          </View>

          {/* Date and Location */}
          <View style={styles.detailsSection}>
            <View style={styles.detailItem}>
              <MaterialCommunityIcons name="clock-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.detailText}>{formatDate(item.scheduledTime)}</Text>
            </View>
            <View style={styles.detailItem}>
              <MaterialCommunityIcons name="map-marker-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.detailText}>{item.address}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          {item.status === 'confirmed' && (
            <View style={styles.actionButtons}>
              <Button 
                mode="outlined" 
                style={styles.actionButton}
                labelStyle={styles.actionButtonText}
                icon="phone"
              >
                Contact
              </Button>
              <Button 
                mode="contained" 
                style={[styles.actionButton, styles.primaryButton]}
                labelStyle={styles.primaryButtonText}
                icon="map"
              >
                Track
              </Button>
            </View>
          )}

          {item.status === 'completed' && (
            <View style={styles.actionButtons}>
              <Button 
                mode="outlined" 
                style={styles.actionButton}
                labelStyle={styles.actionButtonText}
                icon="repeat"
              >
                Rebook
              </Button>
              <Button 
                mode="contained" 
                style={[styles.actionButton, styles.primaryButton]}
                labelStyle={styles.primaryButtonText}
                icon="star"
              >
                Rate
              </Button>
            </View>
          )}
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>My Bookings</Text>
      <Text style={styles.subtitle}>Track your service appointments</Text>
      
      {/* Filter Chips */}
      <View style={styles.filterContainer}>
        {['all', 'confirmed', 'completed', 'in_progress', 'cancelled'].map((filter) => (
          <Chip
            key={filter}
            selected={selectedFilter === filter}
            onPress={() => setSelectedFilter(filter)}
            style={[
              styles.filterChip,
              selectedFilter === filter && styles.selectedFilterChip
            ]}
            textStyle={[
              styles.filterChipText,
              selectedFilter === filter && styles.selectedFilterChipText
            ]}
          >
            {filter === 'all' ? 'All' : 
             filter === 'in_progress' ? 'In Progress' :
             filter.charAt(0).toUpperCase() + filter.slice(1)}
          </Chip>
        ))}
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons name="calendar-blank" size={64} color={colors.textSecondary} />
      <Text style={styles.emptyTitle}>No bookings found</Text>
      <Text style={styles.emptySubtitle}>
        {selectedFilter === 'all' 
          ? "You haven't made any bookings yet"
          : `No ${selectedFilter} bookings found`
        }
      </Text>
      <Button
        mode="contained"
        style={styles.emptyButton}
        onPress={() => {/* Navigate to home */}}
        icon="plus"
      >
        Book a Service
      </Button>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={filteredBookings}
        keyExtractor={item => item.id}
        renderItem={renderBookingCard}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContainer}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  listContainer: {
    paddingBottom: 20,
  },
  header: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e6ed',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  filterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#f0f4f8',
    marginRight: 8,
    marginBottom: 8,
  },
  selectedFilterChip: {
    backgroundColor: colors.primary + '20',
  },
  filterChipText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  selectedFilterChipText: {
    color: colors.primary,
    fontWeight: '600',
  },
  bookingCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: 3,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  bookingId: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  statusChip: {
    height: 28,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  agentSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    marginRight: 12,
  },
  agentInfo: {
    flex: 1,
  },
  agentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  serviceText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 2,
  },
  categoryText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  detailsSection: {
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 8,
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  actionButtonText: {
    fontSize: 12,
  },
  primaryButtonText: {
    fontSize: 12,
    color: '#ffffff',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  emptyButton: {
    paddingHorizontal: 32,
    paddingVertical: 8,
    borderRadius: 24,
  },
});
