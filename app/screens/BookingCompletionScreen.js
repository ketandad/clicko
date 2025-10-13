/**
 * Booking Completion Screen
 * Allows agents to mark bookings as completed and handle post-service actions
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Image,
    Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import bookingService from '../services/bookingService';
import postServiceReviewService from '../services/postServiceReviewService';

const BookingCompletionScreen = ({ navigation, route }) => {
    const { booking } = route.params;
    
    // State management
    const [loading, setLoading] = useState(false);
    const [completionNotes, setCompletionNotes] = useState('');
    const [serviceDetails, setServiceDetails] = useState({
        actualStartTime: booking.started_at ? new Date(booking.started_at) : new Date(),
        actualEndTime: new Date(),
        workPerformed: '',
        materialsUsed: '',
        additionalCharges: 0,
        additionalChargesReason: '',
        customerSatisfied: true,
        issuesEncountered: '',
        recommendations: ''
    });
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [completing, setCompleting] = useState(false);

    useEffect(() => {
        // Auto-populate start time if available
        if (booking.started_at) {
            setServiceDetails(prev => ({
                ...prev,
                actualStartTime: new Date(booking.started_at)
            }));
        }
    }, [booking]);

    const validateCompletion = () => {
        const errors = [];
        
        if (!serviceDetails.workPerformed.trim()) {
            errors.push('Please describe the work performed');
        }
        
        if (serviceDetails.additionalCharges > 0 && !serviceDetails.additionalChargesReason.trim()) {
            errors.push('Please provide reason for additional charges');
        }
        
        if (serviceDetails.actualEndTime <= serviceDetails.actualStartTime) {
            errors.push('End time must be after start time');
        }
        
        return errors;
    };

    const handleCompleteBooking = () => {
        const errors = validateCompletion();
        
        if (errors.length > 0) {
            Alert.alert('Completion Details Required', errors.join('\n'));
            return;
        }
        
        setShowConfirmModal(true);
    };

    const confirmCompletion = async () => {
        setCompleting(true);
        setShowConfirmModal(false);
        
        try {
            // Calculate service duration
            const durationMs = serviceDetails.actualEndTime - serviceDetails.actualStartTime;
            const durationMinutes = Math.round(durationMs / (1000 * 60));
            
            // Prepare completion data
            const completionData = {
                booking_id: booking.id,
                completion_notes: completionNotes,
                actual_start_time: serviceDetails.actualStartTime.toISOString(),
                actual_end_time: serviceDetails.actualEndTime.toISOString(),
                service_duration_minutes: durationMinutes,
                work_performed: serviceDetails.workPerformed,
                materials_used: serviceDetails.materialsUsed,
                additional_charges: serviceDetails.additionalCharges,
                additional_charges_reason: serviceDetails.additionalChargesReason,
                customer_satisfied: serviceDetails.customerSatisfied,
                issues_encountered: serviceDetails.issuesEncountered,
                recommendations: serviceDetails.recommendations
            };
            
            // Complete the booking
            const result = await bookingService.completeBooking(booking.id);
            
            if (result.success) {
                Alert.alert(
                    'Service Completed',
                    'The booking has been marked as completed. The customer will be notified and can now leave a review.',
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                // Navigate back to agent dashboard
                                navigation.navigate('AgentHome');
                            }
                        }
                    ]
                );
            } else {
                Alert.alert('Error', result.message || 'Failed to complete booking');
            }
        } catch (error) {
            console.error('Booking completion error:', error);
            Alert.alert('Error', 'Failed to complete booking. Please try again.');
        } finally {
            setCompleting(false);
        }
    };

    const formatDuration = () => {
        if (!serviceDetails.actualStartTime || !serviceDetails.actualEndTime) return 'N/A';
        
        const durationMs = serviceDetails.actualEndTime - serviceDetails.actualStartTime;
        const hours = Math.floor(durationMs / (1000 * 60 * 60));
        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    };

    const calculateTotal = () => {
        const baseAmount = parseFloat(booking.total_cost) || 0;
        const additional = parseFloat(serviceDetails.additionalCharges) || 0;
        return baseAmount + additional;
    };

    const renderBookingInfo = () => (
        <View style={styles.bookingInfo}>
            <View style={styles.bookingHeader}>
                <View style={styles.serviceInfo}>
                    <Text style={styles.serviceCategory}>{booking.service_category}</Text>
                    <Text style={styles.customerName}>{booking.customer_name}</Text>
                    <Text style={styles.bookingDate}>
                        {new Date(booking.created_at).toLocaleDateString()}
                    </Text>
                </View>
                <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>In Progress</Text>
                </View>
            </View>
            
            <View style={styles.addressSection}>
                <Ionicons name="location" size={16} color={theme.colors.primary} />
                <Text style={styles.address}>{booking.service_address}</Text>
            </View>
        </View>
    );

    const renderTimeSection = () => (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Service Duration</Text>
            
            <View style={styles.timeRow}>
                <Text style={styles.timeLabel}>Started:</Text>
                <Text style={styles.timeValue}>
                    {serviceDetails.actualStartTime.toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    })}
                </Text>
            </View>
            
            <View style={styles.timeRow}>
                <Text style={styles.timeLabel}>Completed:</Text>
                <Text style={styles.timeValue}>
                    {serviceDetails.actualEndTime.toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    })}
                </Text>
            </View>
            
            <View style={styles.timeRow}>
                <Text style={styles.timeLabel}>Duration:</Text>
                <Text style={[styles.timeValue, styles.durationValue]}>
                    {formatDuration()}
                </Text>
            </View>
        </View>
    );

    const renderWorkDetails = () => (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Work Performed *</Text>
            <TextInput
                style={styles.textArea}
                placeholder="Describe the work completed, techniques used, and any important details..."
                value={serviceDetails.workPerformed}
                onChangeText={(text) => setServiceDetails(prev => ({ ...prev, workPerformed: text }))}
                multiline
                numberOfLines={4}
                maxLength={1000}
            />
            <Text style={styles.characterCount}>
                {serviceDetails.workPerformed.length}/1000
            </Text>
        </View>
    );

    const renderMaterials = () => (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Materials Used</Text>
            <TextInput
                style={styles.textArea}
                placeholder="List any materials, parts, or supplies used (optional)..."
                value={serviceDetails.materialsUsed}
                onChangeText={(text) => setServiceDetails(prev => ({ ...prev, materialsUsed: text }))}
                multiline
                numberOfLines={3}
                maxLength={500}
            />
            <Text style={styles.characterCount}>
                {serviceDetails.materialsUsed.length}/500
            </Text>
        </View>
    );

    const renderAdditionalCharges = () => (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Charges</Text>
            
            <View style={styles.chargesRow}>
                <Text style={styles.chargesLabel}>Extra Amount:</Text>
                <View style={styles.chargesInputContainer}>
                    <Text style={styles.currencySymbol}>₹</Text>
                    <TextInput
                        style={styles.chargesInput}
                        placeholder="0"
                        value={serviceDetails.additionalCharges.toString()}
                        onChangeText={(text) => {
                            const amount = parseFloat(text) || 0;
                            setServiceDetails(prev => ({ ...prev, additionalCharges: amount }));
                        }}
                        keyboardType="numeric"
                    />
                </View>
            </View>
            
            {serviceDetails.additionalCharges > 0 && (
                <TextInput
                    style={styles.textInput}
                    placeholder="Reason for additional charges *"
                    value={serviceDetails.additionalChargesReason}
                    onChangeText={(text) => setServiceDetails(prev => ({ ...prev, additionalChargesReason: text }))}
                    maxLength={200}
                />
            )}
            
            <View style={styles.totalSection}>
                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Original Amount:</Text>
                    <Text style={styles.totalValue}>₹{booking.total_cost}</Text>
                </View>
                {serviceDetails.additionalCharges > 0 && (
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Additional:</Text>
                        <Text style={styles.totalValue}>₹{serviceDetails.additionalCharges}</Text>
                    </View>
                )}
                <View style={[styles.totalRow, styles.finalTotal]}>
                    <Text style={styles.finalTotalLabel}>Total Amount:</Text>
                    <Text style={styles.finalTotalValue}>₹{calculateTotal()}</Text>
                </View>
            </View>
        </View>
    );

    const renderCustomerSatisfaction = () => (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customer Satisfaction</Text>
            
            <View style={styles.satisfactionButtons}>
                <TouchableOpacity
                    style={[styles.satisfactionButton, 
                        serviceDetails.customerSatisfied && styles.satisfactionButtonActive]}
                    onPress={() => setServiceDetails(prev => ({ ...prev, customerSatisfied: true }))}
                >
                    <Ionicons 
                        name="happy" 
                        size={20} 
                        color={serviceDetails.customerSatisfied ? theme.colors.surface : theme.colors.textSecondary} 
                    />
                    <Text style={[styles.satisfactionText, 
                        serviceDetails.customerSatisfied && styles.satisfactionTextActive]}>
                        Satisfied
                    </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                    style={[styles.satisfactionButton, 
                        !serviceDetails.customerSatisfied && styles.satisfactionButtonActive]}
                    onPress={() => setServiceDetails(prev => ({ ...prev, customerSatisfied: false }))}
                >
                    <Ionicons 
                        name="sad" 
                        size={20} 
                        color={!serviceDetails.customerSatisfied ? theme.colors.surface : theme.colors.textSecondary} 
                    />
                    <Text style={[styles.satisfactionText, 
                        !serviceDetails.customerSatisfied && styles.satisfactionTextActive]}>
                        Issues
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderIssues = () => {
        if (serviceDetails.customerSatisfied) return null;
        
        return (
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Issues Encountered</Text>
                <TextInput
                    style={styles.textArea}
                    placeholder="Describe any issues, complications, or customer concerns..."
                    value={serviceDetails.issuesEncountered}
                    onChangeText={(text) => setServiceDetails(prev => ({ ...prev, issuesEncountered: text }))}
                    multiline
                    numberOfLines={4}
                    maxLength={500}
                />
                <Text style={styles.characterCount}>
                    {serviceDetails.issuesEncountered.length}/500
                </Text>
            </View>
        );
    };

    const renderRecommendations = () => (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            <TextInput
                style={styles.textArea}
                placeholder="Any recommendations for future maintenance or follow-up (optional)..."
                value={serviceDetails.recommendations}
                onChangeText={(text) => setServiceDetails(prev => ({ ...prev, recommendations: text }))}
                multiline
                numberOfLines={3}
                maxLength={500}
            />
            <Text style={styles.characterCount}>
                {serviceDetails.recommendations.length}/500
            </Text>
        </View>
    );

    const renderNotes = () => (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Completion Notes</Text>
            <TextInput
                style={styles.textArea}
                placeholder="Any additional notes about the service completion (optional)..."
                value={completionNotes}
                onChangeText={setCompletionNotes}
                multiline
                numberOfLines={3}
                maxLength={300}
            />
            <Text style={styles.characterCount}>
                {completionNotes.length}/300
            </Text>
        </View>
    );

    const renderConfirmModal = () => (
        <Modal
            visible={showConfirmModal}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowConfirmModal(false)}
        >
            <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Confirm Service Completion</Text>
                    <TouchableOpacity onPress={() => setShowConfirmModal(false)}>
                        <Ionicons name="close" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                </View>
                
                <ScrollView style={styles.modalContent}>
                    <View style={styles.confirmationSummary}>
                        <Text style={styles.summaryTitle}>Service Summary</Text>
                        
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Customer:</Text>
                            <Text style={styles.summaryValue}>{booking.customer_name}</Text>
                        </View>
                        
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Service:</Text>
                            <Text style={styles.summaryValue}>{booking.service_category}</Text>
                        </View>
                        
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Duration:</Text>
                            <Text style={styles.summaryValue}>{formatDuration()}</Text>
                        </View>
                        
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Total Amount:</Text>
                            <Text style={styles.summaryValue}>₹{calculateTotal()}</Text>
                        </View>
                        
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Customer Satisfied:</Text>
                            <Text style={styles.summaryValue}>
                                {serviceDetails.customerSatisfied ? 'Yes' : 'Issues Reported'}
                            </Text>
                        </View>
                    </View>
                    
                    <Text style={styles.confirmationText}>
                        Once you confirm completion, the customer will be notified and can leave a review. 
                        You will not be able to modify these details later.
                    </Text>
                    
                    <View style={styles.modalActions}>
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => setShowConfirmModal(false)}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                            style={styles.confirmButton}
                            onPress={confirmCompletion}
                            disabled={completing}
                        >
                            {completing ? (
                                <ActivityIndicator color={theme.colors.surface} />
                            ) : (
                                <Text style={styles.confirmButtonText}>Complete Service</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Loading booking details...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Complete Service</Text>
                <View style={styles.headerRight} />
            </View>
            
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {renderBookingInfo()}
                {renderTimeSection()}
                {renderWorkDetails()}
                {renderMaterials()}
                {renderAdditionalCharges()}
                {renderCustomerSatisfaction()}
                {renderIssues()}
                {renderRecommendations()}
                {renderNotes()}
                
                <TouchableOpacity
                    style={styles.completeButton}
                    onPress={handleCompleteBooking}
                    disabled={completing}
                >
                    {completing ? (
                        <ActivityIndicator color={theme.colors.surface} />
                    ) : (
                        <>
                            <Ionicons name="checkmark-circle" size={20} color={theme.colors.surface} />
                            <Text style={styles.completeButtonText}>Complete Service</Text>
                        </>
                    )}
                </TouchableOpacity>
            </ScrollView>
            
            {renderConfirmModal()}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        paddingTop: 50,
        backgroundColor: theme.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    headerRight: {
        width: 24,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    bookingInfo: {
        backgroundColor: theme.colors.surface,
        padding: 20,
        borderRadius: 12,
        marginBottom: 20,
    },
    bookingHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 15,
    },
    serviceInfo: {
        flex: 1,
    },
    serviceCategory: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.primary,
        marginBottom: 4,
    },
    customerName: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 2,
    },
    bookingDate: {
        fontSize: 12,
        color: theme.colors.textSecondary,
    },
    statusBadge: {
        backgroundColor: theme.colors.warning + '20',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        color: theme.colors.warning,
        fontWeight: '600',
    },
    addressSection: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: theme.colors.background,
        padding: 12,
        borderRadius: 8,
    },
    address: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginLeft: 8,
        flex: 1,
        lineHeight: 18,
    },
    section: {
        backgroundColor: theme.colors.surface,
        padding: 20,
        borderRadius: 12,
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 15,
    },
    timeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    timeLabel: {
        fontSize: 14,
        color: theme.colors.textSecondary,
    },
    timeValue: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.text,
    },
    durationValue: {
        color: theme.colors.primary,
    },
    textArea: {
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: theme.colors.text,
        backgroundColor: theme.colors.background,
        textAlignVertical: 'top',
        minHeight: 100,
    },
    textInput: {
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: theme.colors.text,
        backgroundColor: theme.colors.background,
    },
    characterCount: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        textAlign: 'right',
        marginTop: 5,
    },
    chargesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    chargesLabel: {
        fontSize: 14,
        color: theme.colors.text,
        flex: 1,
    },
    chargesInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 8,
        backgroundColor: theme.colors.background,
        paddingHorizontal: 12,
    },
    currencySymbol: {
        fontSize: 16,
        color: theme.colors.text,
        marginRight: 5,
    },
    chargesInput: {
        fontSize: 16,
        color: theme.colors.text,
        padding: 12,
        minWidth: 80,
        textAlign: 'right',
    },
    totalSection: {
        marginTop: 15,
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
    },
    totalLabel: {
        fontSize: 14,
        color: theme.colors.textSecondary,
    },
    totalValue: {
        fontSize: 14,
        color: theme.colors.text,
    },
    finalTotal: {
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        marginTop: 8,
    },
    finalTotalLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    finalTotalValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.primary,
    },
    satisfactionButtons: {
        flexDirection: 'row',
        gap: 15,
    },
    satisfactionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 8,
        backgroundColor: theme.colors.background,
    },
    satisfactionButtonActive: {
        backgroundColor: theme.colors.success,
        borderColor: theme.colors.success,
    },
    satisfactionText: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginLeft: 8,
    },
    satisfactionTextActive: {
        color: theme.colors.surface,
        fontWeight: '600',
    },
    completeButton: {
        backgroundColor: theme.colors.success,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        marginTop: 20,
        marginBottom: 40,
    },
    completeButtonText: {
        color: theme.colors.surface,
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: theme.colors.textSecondary,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 50,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    modalContent: {
        flex: 1,
        padding: 20,
    },
    confirmationSummary: {
        backgroundColor: theme.colors.surface,
        padding: 20,
        borderRadius: 12,
        marginBottom: 20,
    },
    summaryTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 15,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    summaryLabel: {
        fontSize: 14,
        color: theme.colors.textSecondary,
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.text,
    },
    confirmationText: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        lineHeight: 20,
        textAlign: 'center',
        marginBottom: 30,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 15,
        marginBottom: 40,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 16,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 12,
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 16,
        color: theme.colors.textSecondary,
    },
    confirmButton: {
        flex: 1,
        backgroundColor: theme.colors.success,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    confirmButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.surface,
    },
});

export default BookingCompletionScreen;