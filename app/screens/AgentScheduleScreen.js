import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  ActivityIndicator,
  Chip,
  Divider,
  IconButton,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme';

const { width } = Dimensions.get('window');

const AgentScheduleScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scheduledVisits, setScheduledVisits] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('all');

  // Mock data for scheduled visits - replace with actual API call
  const mockScheduledVisits = [
    {
      id: 1,
      customerName: 'Rahul Sharma',
      service: 'AC Repair',
      date: '2025-09-24',
      time: '10:00 AM',
      status: 'confirmed',
      address: 'Sector 21, Pune',
      phone: '+91 98765 43210',
      estimatedDuration: '2 hours',
    },
    {
      id: 2,
      customerName: 'Priya Patel',
      service: 'Washing Machine Installation',
      date: '2025-09-24',
      time: '2:00 PM',
      status: 'pending_confirmation',
      address: 'Kothrud, Pune',
      phone: '+91 87654 32109',
      estimatedDuration: '1.5 hours',
    },
    {
      id: 3,
      customerName: 'Amit Kumar',
      service: 'Refrigerator Repair',
      date: '2025-09-25',
      time: '11:00 AM',
      status: 'confirmed',
      address: 'Baner, Pune',
      phone: '+91 76543 21098',
      estimatedDuration: '3 hours',
    },
  ];

  useEffect(() => {
    loadScheduledVisits();
  }, []);

  const loadScheduledVisits = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call to get agent's scheduled visits
      // const visits = await getAgentScheduledVisits(user.id);
      
      // For now, using mock data
      setTimeout(() => {
        setScheduledVisits(mockScheduledVisits);
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Error loading scheduled visits:', error);
      setLoading(false);
      Alert.alert('Error', 'Failed to load scheduled visits');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadScheduledVisits();
    setRefreshing(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return colors.success;
      case 'pending_confirmation': return colors.warning;
      case 'in_progress': return colors.info;
      case 'completed': return colors.success;
      default: return colors.text;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'confirmed': return 'Confirmed';
      case 'pending_confirmation': return 'Pending';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      default: return status;
    }
  };

  const handleConfirmVisit = (visitId) => {
    Alert.alert(
      'Confirm Visit',
      'Are you sure you want to confirm this visit?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            // TODO: API call to confirm visit
            setScheduledVisits(prev =>
              prev.map(visit =>
                visit.id === visitId
                  ? { ...visit, status: 'confirmed' }
                  : visit
              )
            );
          },
        },
      ]
    );
  };

  const handleStartVisit = (visitId) => {
    Alert.alert(
      'Start Visit',
      'Are you ready to start this service visit?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: () => {
            // TODO: API call to start visit and navigate to service screen
            setScheduledVisits(prev =>
              prev.map(visit =>
                visit.id === visitId
                  ? { ...visit, status: 'in_progress' }
                  : visit
              )
            );
          },
        },
      ]
    );
  };

  const filteredVisits = scheduledVisits.filter(visit => {
    if (selectedFilter === 'all') return true;
    return visit.status === selectedFilter;
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading your schedule...</Text>
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
        <Text style={styles.headerTitle}>My Schedule</Text>
        <Text style={styles.headerSubtitle}>
          {filteredVisits.length} visits scheduled
        </Text>
      </LinearGradient>

      {/* Filter Chips */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[
            { key: 'all', label: 'All' },
            { key: 'confirmed', label: 'Confirmed' },
            { key: 'pending_confirmation', label: 'Pending' },
            { key: 'in_progress', label: 'In Progress' },
          ].map((filter) => (
            <Chip
              key={filter.key}
              selected={selectedFilter === filter.key}
              onPress={() => setSelectedFilter(filter.key)}
              style={[
                styles.filterChip,
                selectedFilter === filter.key && styles.selectedFilterChip,
              ]}
              textStyle={[
                styles.filterChipText,
                selectedFilter === filter.key && styles.selectedFilterChipText,
              ]}
            >
              {filter.label}
            </Chip>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredVisits.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <MaterialCommunityIcons
                name="calendar-blank"
                size={64}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyTitle}>No Scheduled Visits</Text>
              <Text style={styles.emptySubtitle}>
                {selectedFilter === 'all'
                  ? 'You have no scheduled visits at the moment'
                  : `No ${selectedFilter.replace('_', ' ')} visits found`}
              </Text>
            </Card.Content>
          </Card>
        ) : (
          filteredVisits.map((visit) => (
            <Card key={visit.id} style={styles.visitCard}>
              <Card.Content>
                <View style={styles.visitHeader}>
                  <View style={styles.visitInfo}>
                    <Text style={styles.customerName}>{visit.customerName}</Text>
                    <Text style={styles.serviceType}>{visit.service}</Text>
                  </View>
                  <Chip
                    style={[styles.statusChip, { backgroundColor: getStatusColor(visit.status) + '20' }]}
                    textStyle={[styles.statusText, { color: getStatusColor(visit.status) }]}
                  >
                    {getStatusText(visit.status)}
                  </Chip>
                </View>

                <Divider style={styles.divider} />

                <View style={styles.visitDetails}>
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="calendar" size={20} color={colors.textSecondary} />
                    <Text style={styles.detailText}>{visit.date}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="clock" size={20} color={colors.textSecondary} />
                    <Text style={styles.detailText}>{visit.time} ({visit.estimatedDuration})</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="map-marker" size={20} color={colors.textSecondary} />
                    <Text style={styles.detailText}>{visit.address}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="phone" size={20} color={colors.textSecondary} />
                    <Text style={styles.detailText}>{visit.phone}</Text>
                  </View>
                </View>

                <View style={styles.actionButtons}>
                  {visit.status === 'pending_confirmation' && (
                    <Button
                      mode="contained"
                      onPress={() => handleConfirmVisit(visit.id)}
                      style={styles.actionButton}
                      contentStyle={styles.buttonContent}
                    >
                      Confirm
                    </Button>
                  )}
                  {visit.status === 'confirmed' && (
                    <Button
                      mode="contained"
                      onPress={() => handleStartVisit(visit.id)}
                      style={styles.actionButton}
                      contentStyle={styles.buttonContent}
                    >
                      Start Visit
                    </Button>
                  )}
                  <Button
                    mode="outlined"
                    onPress={() => {/* TODO: Call customer */}}
                    style={styles.actionButton}
                    contentStyle={styles.buttonContent}
                  >
                    Call Customer
                  </Button>
                </View>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>
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
    paddingHorizontal: 20,
    paddingVertical: 24,
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
    marginTop: 4,
  },
  filterContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  filterChip: {
    marginRight: 8,
    backgroundColor: colors.background,
  },
  selectedFilterChip: {
    backgroundColor: colors.primary,
  },
  filterChipText: {
    color: colors.text,
  },
  selectedFilterChipText: {
    color: 'white',
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
  },
  visitCard: {
    marginVertical: 8,
    elevation: 2,
  },
  visitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  visitInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  serviceType: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusChip: {
    marginLeft: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  divider: {
    marginVertical: 16,
  },
  visitDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    marginLeft: 12,
    fontSize: 14,
    color: colors.text,
    flex: 1,
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
    height: 40,
  },
});

export default AgentScheduleScreen;