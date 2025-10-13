import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    RefreshControl
} from 'react-native';
import bookingStatusService from '../services/bookingStatusService';

/**
 * Agent Status Management Screen
 * Manage all active bookings and their statuses
 */
const AgentStatusManagementScreen = ({ navigation }) => {
    const [activeBookings, setActiveBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [agentId, setAgentId] = useState(1); // This would come from auth context

    useEffect(() => {
        loadActiveBookings();
        
        // Set up refresh interval for active bookings
        const interval = setInterval(loadActiveBookings, 30000); // Refresh every 30 seconds
        
        return () => clearInterval(interval);
    }, []);

    const loadActiveBookings = async () => {
        try {
            setLoading(true);
            const bookingsData = await bookingStatusService.getAgentActiveBookings(agentId);
            setActiveBookings(bookingsData.active_bookings || []);
        } catch (error) {
            console.error('Error loading active bookings:', error);
            Alert.alert('Error', 'Failed to load active bookings');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleStatusUpdate = async (bookingId, newStatus, options = {}) => {
        try {
            await bookingStatusService.updateBookingStatus(bookingId, newStatus, options);
            
            // Show success message
            const statusInfo = bookingStatusService.getStatusInfo(newStatus);
            Alert.alert('Status Updated', `Booking status changed to: ${statusInfo.label}`);
            
            // Refresh bookings list
            loadActiveBookings();
            
        } catch (error) {
            console.error('Error updating status:', error);
            Alert.alert('Error', 'Failed to update booking status');
        }
    };

    const showStatusUpdateOptions = (booking) => {
        const currentStatus = booking.status;
        
        let options = [];
        
        // Define possible next statuses based on current status
        switch (currentStatus) {
            case 'pending':
                options = [
                    { label: 'Accept Booking', status: 'accepted', color: '#28a745' },
                    { label: 'Reject Booking', status: 'cancelled', color: '#dc3545' }
                ];
                break;
            case 'accepted':
                options = [
                    { label: 'Start Journey', status: 'agent_en_route', color: '#007bff' },
                    { label: 'Cancel Booking', status: 'cancelled', color: '#dc3545' }
                ];
                break;
            case 'agent_en_route':
                options = [
                    { label: 'Arrive & Start Service', status: 'service_in_progress', color: '#fd7e14' },
                    { label: 'Cancel Booking', status: 'cancelled', color: '#dc3545' }
                ];
                break;
            case 'service_in_progress':
                options = [
                    { label: 'Complete Service', status: 'completed', color: '#28a745' }
                ];
                break;
            default:
                options = [];
        }

        if (options.length === 0) {
            Alert.alert('No Actions', 'No status updates available for this booking');
            return;
        }

        const buttons = options.map(option => ({
            text: option.label,
            onPress: () => {
                if (option.status === 'cancelled') {
                    // Show cancellation reason prompt
                    Alert.prompt(
                        'Cancellation Reason',
                        'Please provide a reason for cancellation:',
                        (reason) => {
                            if (reason) {
                                handleStatusUpdate(booking.booking_id, option.status, { reason });
                            }
                        }
                    );
                } else {
                    handleStatusUpdate(booking.booking_id, option.status);
                }
            },
            style: option.status === 'cancelled' ? 'destructive' : 'default'
        }));

        buttons.push({ text: 'Cancel', style: 'cancel' });

        Alert.alert('Update Status', `Current: ${currentStatus}`, buttons);
    };

    const handleLocationUpdate = (booking) => {
        // In a real app, this would get current location
        // For demo, we'll use mock location
        const mockLocation = {
            latitude: 37.7749 + (Math.random() - 0.5) * 0.01,
            longitude: -122.4194 + (Math.random() - 0.5) * 0.01,
            eta_minutes: Math.floor(Math.random() * 30) + 5,
            status_message: `En route to customer. ETA: ${Math.floor(Math.random() * 30) + 5} minutes`
        };

        bookingStatusService.updateAgentLocation(booking.booking_id, mockLocation)
            .then(() => {
                Alert.alert('Success', 'Location updated successfully');
            })
            .catch(error => {
                console.error('Error updating location:', error);
                Alert.alert('Error', 'Failed to update location');
            });
    };

    const renderBookingItem = ({ item: booking }) => {
        const statusInfo = bookingStatusService.getStatusInfo(booking.status);
        const progressPercentage = bookingStatusService.getProgressPercentage(booking.status);
        
        return (
            <View style={styles.bookingCard}>
                {/* Booking Header */}
                <View style={styles.bookingHeader}>
                    <View style={styles.bookingInfo}>
                        <Text style={styles.bookingId}>#{booking.booking_id}</Text>
                        <Text style={styles.customerName}>{booking.customer_name || 'Customer'}</Text>
                        <Text style={styles.serviceType}>{booking.service_type || 'Service'}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
                        <Text style={styles.statusText}>{statusInfo.icon}</Text>
                    </View>
                </View>

                {/* Status Information */}
                <View style={styles.statusSection}>
                    <Text style={styles.statusLabel}>{statusInfo.label}</Text>
                    <Text style={styles.statusDescription}>{statusInfo.description}</Text>
                    
                    {/* Progress Bar */}
                    <View style={styles.progressContainer}>
                        <View style={styles.progressBar}>
                            <View style={[styles.progressFill, { width: `${progressPercentage}%`, backgroundColor: statusInfo.color }]} />
                        </View>
                        <Text style={styles.progressText}>{progressPercentage}%</Text>
                    </View>
                </View>

                {/* Booking Details */}
                <View style={styles.detailsSection}>
                    <Text style={styles.detailText}>📍 {booking.customer_address || 'Address not provided'}</Text>
                    <Text style={styles.detailText}>🕒 Created: {new Date(booking.created_at).toLocaleString()}</Text>
                    {booking.estimated_duration && (
                        <Text style={styles.detailText}>⏱️ Duration: {booking.estimated_duration} mins</Text>
                    )}
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                    <TouchableOpacity
                        style={styles.updateButton}
                        onPress={() => showStatusUpdateOptions(booking)}
                    >
                        <Text style={styles.updateButtonText}>Update Status</Text>
                    </TouchableOpacity>
                    
                    {['accepted', 'agent_en_route'].includes(booking.status) && (
                        <TouchableOpacity
                            style={styles.locationButton}
                            onPress={() => handleLocationUpdate(booking)}
                        >
                            <Text style={styles.locationButtonText}>📍 Update Location</Text>
                        </TouchableOpacity>
                    )}
                    
                    <TouchableOpacity
                        style={styles.viewButton}
                        onPress={() => navigation.navigate('BookingStatus', { bookingId: booking.booking_id })}
                    >
                        <Text style={styles.viewButtonText}>View Details</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadActiveBookings();
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading active bookings...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Active Bookings</Text>
                <Text style={styles.subtitle}>{activeBookings.length} booking{activeBookings.length !== 1 ? 's' : ''} active</Text>
            </View>

            {activeBookings.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyIcon}>📋</Text>
                    <Text style={styles.emptyTitle}>No Active Bookings</Text>
                    <Text style={styles.emptySubtitle}>You don't have any active bookings at the moment</Text>
                </View>
            ) : (
                <FlatList
                    data={activeBookings}
                    renderItem={renderBookingItem}
                    keyExtractor={(item) => item.booking_id}
                    contentContainerStyle={styles.listContainer}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa'
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa'
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#666'
    },
    header: {
        backgroundColor: '#fff',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e1e5e9'
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1a1a1a'
    },
    subtitle: {
        fontSize: 14,
        color: '#666',
        marginTop: 4
    },
    listContainer: {
        padding: 16
    },
    bookingCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4
    },
    bookingHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12
    },
    bookingInfo: {
        flex: 1
    },
    bookingId: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 4
    },
    customerName: {
        fontSize: 14,
        color: '#495057',
        marginBottom: 2
    },
    serviceType: {
        fontSize: 12,
        color: '#6c757d'
    },
    statusBadge: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center'
    },
    statusText: {
        fontSize: 20
    },
    statusSection: {
        marginBottom: 12
    },
    statusLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 4
    },
    statusDescription: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    progressBar: {
        flex: 1,
        height: 6,
        backgroundColor: '#e1e5e9',
        borderRadius: 3,
        marginRight: 8
    },
    progressFill: {
        height: '100%',
        borderRadius: 3
    },
    progressText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#495057',
        minWidth: 35
    },
    detailsSection: {
        backgroundColor: '#f8f9fa',
        padding: 12,
        borderRadius: 8,
        marginBottom: 12
    },
    detailText: {
        fontSize: 12,
        color: '#495057',
        marginBottom: 4,
        lineHeight: 16
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    updateButton: {
        backgroundColor: '#007bff',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
        flex: 1,
        marginRight: 4
    },
    updateButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center'
    },
    locationButton: {
        backgroundColor: '#28a745',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
        flex: 1,
        marginHorizontal: 2
    },
    locationButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center'
    },
    viewButton: {
        backgroundColor: '#6c757d',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
        flex: 1,
        marginLeft: 4
    },
    viewButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center'
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: 16
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 8,
        textAlign: 'center'
    },
    emptySubtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 22
    }
});

export default AgentStatusManagementScreen;