import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator
} from 'react-native';
import bookingStatusService from '../services/bookingStatusService';

/**
 * Booking Status Tracking Screen
 * Real-time status updates and progress monitoring
 */
const BookingStatusScreen = ({ route, navigation }) => {
    const { bookingId } = route.params;
    
    const [progress, setProgress] = useState(null);
    const [loading, setLoading] = useState(true);
    const [statusHistory, setStatusHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [agentLocation, setAgentLocation] = useState(null);
    const [eta, setEta] = useState(null);

    useEffect(() => {
        loadBookingProgress();
        loadStatusHistory();
        
        // Connect to real-time updates
        const handleStatusUpdate = (newStatus, data) => {
            console.log('📊 Status update received:', newStatus, data);
            loadBookingProgress(); // Refresh progress data
            
            // Show notification for status changes
            const statusInfo = bookingStatusService.getStatusInfo(newStatus);
            Alert.alert('Status Update', statusInfo.description);
        };

        bookingStatusService.connectToStatusUpdates(bookingId, handleStatusUpdate);
        
        // Cleanup on unmount
        return () => {
            bookingStatusService.disconnectFromStatusUpdates(bookingId);
        };
    }, [bookingId]);

    const loadBookingProgress = async () => {
        try {
            setLoading(true);
            const progressData = await bookingStatusService.getBookingProgress(bookingId);
            setProgress(progressData);
            
            // Update ETA if agent location available
            if (progressData.agent_location) {
                setAgentLocation(progressData.agent_location);
                
                // Calculate ETA from agent status message or default
                if (progressData.agent_status_message?.includes('ETA:')) {
                    const etaMatch = progressData.agent_status_message.match(/ETA:\s*(\d+)\s*min/);
                    if (etaMatch) {
                        setEta(bookingStatusService.formatETA(parseInt(etaMatch[1])));
                    }
                }
            }
        } catch (error) {
            console.error('Error loading booking progress:', error);
            Alert.alert('Error', 'Failed to load booking progress');
        } finally {
            setLoading(false);
        }
    };

    const loadStatusHistory = async () => {
        try {
            const historyData = await bookingStatusService.getBookingStatusHistory(bookingId);
            setStatusHistory(historyData.history || []);
        } catch (error) {
            console.error('Error loading status history:', error);
        }
    };

    const renderProgressBar = () => {
        if (!progress) return null;

        const percentage = bookingStatusService.getProgressPercentage(progress.current_status);
        
        return (
            <View style={styles.progressContainer}>
                <Text style={styles.progressLabel}>Progress: {percentage}%</Text>
                <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${percentage}%` }]} />
                </View>
            </View>
        );
    };

    const renderStatusCard = () => {
        if (!progress) return null;

        const statusInfo = bookingStatusService.getStatusInfo(progress.current_status);
        
        return (
            <View style={styles.statusCard}>
                <View style={styles.statusHeader}>
                    <Text style={styles.statusIcon}>{statusInfo.icon}</Text>
                    <View style={styles.statusInfo}>
                        <Text style={styles.statusLabel}>{statusInfo.label}</Text>
                        <Text style={styles.statusDescription}>{statusInfo.description}</Text>
                    </View>
                </View>
                
                <Text style={styles.statusTime}>
                    Last updated: {new Date(progress.status_updated_at).toLocaleString()}
                </Text>

                {/* ETA Information */}
                {eta && (
                    <View style={styles.etaContainer}>
                        <Text style={styles.etaLabel}>Estimated Arrival:</Text>
                        <Text style={styles.etaTime}>{eta.time}</Text>
                        <Text style={styles.etaDuration}>({eta.duration})</Text>
                    </View>
                )}

                {/* Agent Status Message */}
                {progress.agent_status_message && (
                    <View style={styles.agentMessageContainer}>
                        <Text style={styles.agentMessageLabel}>Agent Update:</Text>
                        <Text style={styles.agentMessage}>{progress.agent_status_message}</Text>
                    </View>
                )}
            </View>
        );
    };

    const renderStatusHistory = () => {
        if (!showHistory || statusHistory.length === 0) return null;

        return (
            <View style={styles.historyContainer}>
                <Text style={styles.historyTitle}>Status History</Text>
                {statusHistory.map((entry, index) => {
                    const statusInfo = bookingStatusService.getStatusInfo(entry.status);
                    
                    return (
                        <View key={index} style={styles.historyItem}>
                            <View style={styles.historyLeft}>
                                <Text style={styles.historyIcon}>{statusInfo.icon}</Text>
                                <View style={styles.historyLine} />
                            </View>
                            <View style={styles.historyContent}>
                                <Text style={styles.historyLabel}>{statusInfo.label}</Text>
                                <Text style={styles.historyTime}>
                                    {new Date(entry.timestamp).toLocaleString()}
                                </Text>
                                {entry.notes && (
                                    <Text style={styles.historyNotes}>{entry.notes}</Text>
                                )}
                            </View>
                        </View>
                    );
                })}
            </View>
        );
    };

    const handleCancelBooking = () => {
        Alert.alert(
            'Cancel Booking',
            'Are you sure you want to cancel this booking?',
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Yes, Cancel',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await bookingStatusService.updateBookingStatus(
                                bookingId,
                                'cancelled',
                                { reason: 'Cancelled by customer' }
                            );
                            navigation.goBack();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to cancel booking');
                        }
                    }
                }
            ]
        );
    };

    const canCancelBooking = () => {
        return progress && ['pending', 'accepted'].includes(progress.current_status);
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading booking status...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Booking Status</Text>
                <Text style={styles.bookingId}>ID: {bookingId}</Text>
            </View>

            {renderProgressBar()}
            {renderStatusCard()}

            <View style={styles.actionButtons}>
                <TouchableOpacity
                    style={styles.historyButton}
                    onPress={() => setShowHistory(!showHistory)}
                >
                    <Text style={styles.historyButtonText}>
                        {showHistory ? 'Hide' : 'Show'} History
                    </Text>
                </TouchableOpacity>

                {canCancelBooking() && (
                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={handleCancelBooking}
                    >
                        <Text style={styles.cancelButtonText}>Cancel Booking</Text>
                    </TouchableOpacity>
                )}
            </View>

            {renderStatusHistory()}

            {/* Agent Location Map (placeholder) */}
            {agentLocation && (
                <View style={styles.locationContainer}>
                    <Text style={styles.locationTitle}>Agent Location</Text>
                    <View style={styles.mapPlaceholder}>
                        <Text style={styles.mapText}>
                            📍 Agent Location:{'\n'}
                            Lat: {agentLocation.latitude.toFixed(6)}{'\n'}
                            Lng: {agentLocation.longitude.toFixed(6)}
                        </Text>
                    </View>
                </View>
            )}
        </ScrollView>
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
    bookingId: {
        fontSize: 14,
        color: '#666',
        marginTop: 4
    },
    progressContainer: {
        backgroundColor: '#fff',
        margin: 16,
        padding: 20,
        borderRadius: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4
    },
    progressLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 12
    },
    progressBar: {
        height: 8,
        backgroundColor: '#e1e5e9',
        borderRadius: 4,
        overflow: 'hidden'
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#007AFF',
        borderRadius: 4
    },
    statusCard: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 20,
        borderRadius: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4
    },
    statusHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12
    },
    statusIcon: {
        fontSize: 32,
        marginRight: 12
    },
    statusInfo: {
        flex: 1
    },
    statusLabel: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 4
    },
    statusDescription: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20
    },
    statusTime: {
        fontSize: 12,
        color: '#888',
        marginBottom: 12
    },
    etaContainer: {
        backgroundColor: '#f0f8ff',
        padding: 12,
        borderRadius: 8,
        marginBottom: 12
    },
    etaLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#007AFF',
        marginBottom: 4
    },
    etaTime: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#007AFF'
    },
    etaDuration: {
        fontSize: 14,
        color: '#007AFF'
    },
    agentMessageContainer: {
        backgroundColor: '#f8f9fa',
        padding: 12,
        borderRadius: 8
    },
    agentMessageLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#495057',
        marginBottom: 4
    },
    agentMessage: {
        fontSize: 14,
        color: '#495057',
        fontStyle: 'italic'
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        marginBottom: 16
    },
    historyButton: {
        backgroundColor: '#6c757d',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        flex: 1,
        marginRight: 8
    },
    historyButtonText: {
        color: '#fff',
        fontWeight: '600',
        textAlign: 'center'
    },
    cancelButton: {
        backgroundColor: '#dc3545',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        flex: 1,
        marginLeft: 8
    },
    cancelButtonText: {
        color: '#fff',
        fontWeight: '600',
        textAlign: 'center'
    },
    historyContainer: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 20,
        borderRadius: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4
    },
    historyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 16
    },
    historyItem: {
        flexDirection: 'row',
        marginBottom: 16
    },
    historyLeft: {
        alignItems: 'center',
        marginRight: 12
    },
    historyIcon: {
        fontSize: 20,
        marginBottom: 8
    },
    historyLine: {
        width: 2,
        flex: 1,
        backgroundColor: '#e1e5e9'
    },
    historyContent: {
        flex: 1
    },
    historyLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 4
    },
    historyTime: {
        fontSize: 12,
        color: '#888',
        marginBottom: 4
    },
    historyNotes: {
        fontSize: 14,
        color: '#666',
        fontStyle: 'italic'
    },
    locationContainer: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 20,
        borderRadius: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4
    },
    locationTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 12
    },
    mapPlaceholder: {
        height: 200,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e1e5e9'
    },
    mapText: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        lineHeight: 20
    }
});

export default BookingStatusScreen;