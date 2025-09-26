import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, ActivityIndicator, Appbar, Chip } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function BookingHistoryScreen({ navigation }) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isAgent = user?.currentMode === 'agent';

  useEffect(() => {
    loadBookingHistory();
  }, []);

  const loadBookingHistory = async () => {
    try {
      setLoading(true);
      // TODO: Implement booking history API call
      // const history = isAgent ? await getAgentServiceHistory(user.id) : await getBookingHistory(user.id);
      
      // Mock data - different for agent vs customer
      const mockBookings = isAgent ? [
        {
          id: 1,
          serviceName: 'AC Repair',
          customerName: 'Rajesh Kumar',
          date: '2025-01-20',
          status: 'completed',
          amount: 500,
          rating: 4.5,
          customerPhone: '+91 98765 43210',
          address: 'Sector 15, Pune'
        },
        {
          id: 2,
          serviceName: 'Washing Machine Installation',
          customerName: 'Priya Sharma',
          date: '2025-01-18',
          status: 'completed',
          amount: 300,
          rating: 5.0,
          customerPhone: '+91 87654 32109',
          address: 'Kothrud, Pune'
        },
        {
          id: 3,
          serviceName: 'Refrigerator Repair',
          customerName: 'Amit Patel',
          date: '2025-01-15',
          status: 'cancelled',
          amount: 0,
          rating: null,
          customerPhone: '+91 76543 21098',
          address: 'Baner, Pune'
        }
      ] : [
        {
          id: 1,
          serviceName: 'House Cleaning',
          agentName: 'John Doe',
          date: '2025-01-15',
          status: 'completed',
          amount: 150
        },
        {
          id: 2,
          serviceName: 'Plumbing Service',
          agentName: 'Jane Smith',
          date: '2025-01-10',
          status: 'cancelled',
          amount: 200
        }
      ];
      
      setBookings(mockBookings);
    } catch (error) {
      console.error('Error loading booking history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadBookingHistory();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return colors.success || '#4CAF50';
      case 'pending':
        return colors.warning || '#FF9800';
      case 'cancelled':
        return colors.error || '#F44336';
      default:
        return colors.primary;
    }
  };

  const renderBookingCard = (booking) => (
    <Card key={booking.id} style={styles.bookingCard}>
      <Card.Content>
        <View style={styles.bookingHeader}>
          <Text style={styles.serviceName}>{booking.serviceName}</Text>
          <Chip 
            style={[styles.statusChip, { backgroundColor: getStatusColor(booking.status) }]}
            textStyle={styles.statusText}
          >
            {booking.status.toUpperCase()}
          </Chip>
        </View>
        
        <View style={styles.bookingDetails}>
          <View style={styles.detailRow}>
            <Icon name="account" size={16} color={colors.textSecondary} />
            <Text style={styles.detailText}>
              {isAgent ? `Customer: ${booking.customerName}` : `Agent: ${booking.agentName}`}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Icon name="calendar" size={16} color={colors.textSecondary} />
            <Text style={styles.detailText}>Date: {booking.date}</Text>
          </View>
          
          {isAgent && booking.address && (
            <View style={styles.detailRow}>
              <Icon name="map-marker" size={16} color={colors.textSecondary} />
              <Text style={styles.detailText}>Location: {booking.address}</Text>
            </View>
          )}
          
          <View style={styles.detailRow}>
            <Icon name="currency-inr" size={16} color={colors.textSecondary} />
            <Text style={styles.detailText}>
              Amount: ₹{booking.amount}
              {isAgent && booking.status === 'completed' && ` (Earned)`}
            </Text>
          </View>
          
          {isAgent && booking.rating && (
            <View style={styles.detailRow}>
              <Icon name="star" size={16} color={colors.warning || '#FF9800'} />
              <Text style={styles.detailText}>Rating: {booking.rating}/5.0</Text>
            </View>
          )}
        </View>
      </Card.Content>
    </Card>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title={isAgent ? "Service History" : "Booking History"} />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>
            {isAgent ? "Loading service history..." : "Loading booking history..."}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={isAgent ? "Service History" : "Booking History"} />
      </Appbar.Header>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {bookings.length > 0 ? (
          bookings.map(renderBookingCard)
        ) : (
          <View style={styles.emptyContainer}>
            <Icon name={isAgent ? "tools" : "calendar-remove"} size={64} color={colors.textSecondary} />
            <Text style={styles.emptyText}>
              {isAgent ? "No service history found" : "No booking history found"}
            </Text>
            <Text style={styles.emptySubtext}>
              {isAgent 
                ? "Your completed services will appear here" 
                : "Your completed bookings will appear here"
              }
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.text,
  },
  bookingCard: {
    marginBottom: 16,
    elevation: 2,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
  },
  statusChip: {
    marginLeft: 8,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  bookingDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
});