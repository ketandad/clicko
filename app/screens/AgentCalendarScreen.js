/**
 * Agent Calendar Screen
 * Teams-like calendar interface for agent scheduled bookings
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    RefreshControl,
    Modal,
    TextInput,
    FlatList,
    Dimensions,
    ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import scheduledBookingService from '../services/scheduledBookingService';

const { width: screenWidth } = Dimensions.get('window');

const AgentCalendarScreen = ({ navigation, route }) => {
    const { agentId } = route.params;
    
    // State management
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState('week'); // 'week' or 'month'
    const [calendarData, setCalendarData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [workingSchedule, setWorkingSchedule] = useState([]);
    
    // Calendar navigation state
    const [dateRange, setDateRange] = useState({
        startDate: '',
        endDate: ''
    });

    useEffect(() => {
        updateDateRange();
    }, [currentDate, viewMode]);

    useEffect(() => {
        if (dateRange.startDate && dateRange.endDate) {
            loadCalendarData();
            loadWorkingSchedule();
        }
    }, [dateRange, agentId]);

    const updateDateRange = () => {
        if (viewMode === 'week') {
            const range = scheduledBookingService.getCurrentWeekRange();
            // Adjust for current week
            const today = new Date();
            const currentDay = today.getDay();
            const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
            
            const weekStart = new Date(currentDate);
            weekStart.setDate(currentDate.getDate() + mondayOffset);
            
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            
            setDateRange({
                startDate: weekStart.toISOString().split('T')[0],
                endDate: weekEnd.toISOString().split('T')[0]
            });
        } else {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            const range = scheduledBookingService.getMonthRange(year, month);
            setDateRange(range);
        }
    };

    const loadCalendarData = async () => {
        setLoading(true);
        try {
            const result = await scheduledBookingService.getAgentCalendar(
                agentId,
                dateRange.startDate,
                dateRange.endDate
            );

            if (result.success) {
                setCalendarData(result.calendar);
            } else {
                Alert.alert('Error', result.error || 'Failed to load calendar data');
            }
        } catch (error) {
            console.error('Error loading calendar:', error);
            Alert.alert('Error', 'Failed to load calendar data');
        } finally {
            setLoading(false);
        }
    };

    const loadWorkingSchedule = async () => {
        try {
            const result = await scheduledBookingService.getAgentSchedule(agentId);
            if (result.success) {
                setWorkingSchedule(result.schedules);
            }
        } catch (error) {
            console.error('Error loading schedule:', error);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadCalendarData().finally(() => setRefreshing(false));
    }, [dateRange]);

    const navigateDate = (direction) => {
        const newDate = new Date(currentDate);
        if (viewMode === 'week') {
            newDate.setDate(currentDate.getDate() + (direction * 7));
        } else {
            newDate.setMonth(currentDate.getMonth() + direction);
        }
        setCurrentDate(newDate);
    };

    const handleBookingPress = (booking) => {
        setSelectedBooking(booking);
        setShowBookingModal(true);
    };

    const confirmBooking = async (bookingUuid) => {
        try {
            const result = await scheduledBookingService.confirmScheduledBooking(bookingUuid, agentId);
            if (result.success) {
                Alert.alert('Success', 'Booking confirmed successfully');
                loadCalendarData();
                setShowBookingModal(false);
            } else {
                Alert.alert('Error', result.error);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to confirm booking');
        }
    };

    const getBookingStatusColor = (booking) => {
        if (booking.is_confirmed) {
            return theme.colors.success;
        }
        const daysUntil = scheduledBookingService.getDaysUntilBooking(
            `${calendarData.calendar_data[selectedBooking?.date]?.date}T${booking.start_time}`
        );
        return daysUntil <= 1 ? theme.colors.warning : theme.colors.primary;
    };

    const renderCalendarHeader = () => (
        <View style={styles.header}>
            <View style={styles.headerTop}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Calendar</Text>
                <TouchableOpacity onPress={() => setShowScheduleModal(true)}>
                    <Ionicons name="settings-outline" size={24} color={theme.colors.text} />
                </TouchableOpacity>
            </View>
            
            <View style={styles.headerControls}>
                <View style={styles.viewModeToggle}>
                    <TouchableOpacity
                        style={[styles.viewModeButton, viewMode === 'week' && styles.activeViewMode]}
                        onPress={() => setViewMode('week')}
                    >
                        <Text style={[styles.viewModeText, viewMode === 'week' && styles.activeViewModeText]}>
                            Week
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.viewModeButton, viewMode === 'month' && styles.activeViewMode]}
                        onPress={() => setViewMode('month')}
                    >
                        <Text style={[styles.viewModeText, viewMode === 'month' && styles.activeViewModeText]}>
                            Month
                        </Text>
                    </TouchableOpacity>
                </View>
                
                <View style={styles.navigationControls}>
                    <TouchableOpacity onPress={() => navigateDate(-1)} style={styles.navButton}>
                        <Ionicons name="chevron-back" size={20} color={theme.colors.primary} />
                    </TouchableOpacity>
                    <Text style={styles.dateDisplay}>
                        {viewMode === 'week' 
                            ? `${new Date(dateRange.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(dateRange.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                            : currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                        }
                    </Text>
                    <TouchableOpacity onPress={() => navigateDate(1)} style={styles.navButton}>
                        <Ionicons name="chevron-forward" size={20} color={theme.colors.primary} />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    const renderCalendarSummary = () => {
        if (!calendarData?.summary) return null;
        
        return (
            <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Calendar Summary</Text>
                <View style={styles.summaryRow}>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryNumber}>{calendarData.summary.total_bookings}</Text>
                        <Text style={styles.summaryLabel}>Total Bookings</Text>
                    </View>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryNumber}>{calendarData.summary.confirmed_bookings}</Text>
                        <Text style={styles.summaryLabel}>Confirmed</Text>
                    </View>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryNumber}>₹{calendarData.summary.total_scheduled_earnings}</Text>
                        <Text style={styles.summaryLabel}>Earnings</Text>
                    </View>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryNumber}>{calendarData.summary.working_days}</Text>
                        <Text style={styles.summaryLabel}>Working Days</Text>
                    </View>
                </View>
            </View>
        );
    };

    const renderDayCard = (dayData) => {
        const date = new Date(dayData.date);
        const isToday = date.toDateString() === new Date().toDateString();
        
        return (
            <View key={dayData.date} style={[styles.dayCard, isToday && styles.todayCard]}>
                <View style={styles.dayHeader}>
                    <Text style={[styles.dayName, isToday && styles.todayText]}>
                        {dayData.day_name.substring(0, 3)}
                    </Text>
                    <Text style={[styles.dayNumber, isToday && styles.todayText]}>
                        {date.getDate()}
                    </Text>
                </View>
                
                <ScrollView style={styles.dayContent} showsVerticalScrollIndicator={false}>
                    {/* Bookings */}
                    {dayData.bookings.map((booking, index) => (
                        <TouchableOpacity
                            key={index}
                            style={[styles.bookingItem, { borderLeftColor: getBookingStatusColor(booking) }]}
                            onPress={() => {
                                setSelectedBooking({ ...booking, date: dayData.date });
                                handleBookingPress(booking);
                            }}
                        >
                            <Text style={styles.bookingTime}>
                                {scheduledBookingService.formatTime(booking.start_time)}
                            </Text>
                            <Text style={styles.bookingDuration}>
                                {booking.duration_minutes}min
                            </Text>
                            {!booking.is_confirmed && (
                                <View style={styles.pendingBadge}>
                                    <Text style={styles.pendingText}>Pending</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    ))}
                    
                    {/* Available Slots Preview */}
                    {dayData.available_slots.slice(0, 3).map((slot, index) => (
                        <View key={index} style={styles.availableSlot}>
                            <Text style={styles.slotTime}>
                                {scheduledBookingService.formatTime(slot.start_time)}
                            </Text>
                            <Text style={styles.slotLabel}>Available</Text>
                        </View>
                    ))}
                    
                    {dayData.available_slots.length > 3 && (
                        <Text style={styles.moreSlots}>
                            +{dayData.available_slots.length - 3} more slots
                        </Text>
                    )}
                </ScrollView>
            </View>
        );
    };

    const renderBookingModal = () => (
        <Modal
            visible={showBookingModal}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowBookingModal(false)}
        >
            <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Booking Details</Text>
                    <TouchableOpacity onPress={() => setShowBookingModal(false)}>
                        <Ionicons name="close" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                </View>
                
                {selectedBooking && (
                    <ScrollView style={styles.modalContent}>
                        <View style={styles.bookingDetailCard}>
                            <View style={styles.detailRow}>
                                <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
                                <Text style={styles.detailLabel}>Time:</Text>
                                <Text style={styles.detailValue}>
                                    {scheduledBookingService.formatTime(selectedBooking.start_time)} - {scheduledBookingService.formatTime(selectedBooking.end_time)}
                                </Text>
                            </View>
                            
                            <View style={styles.detailRow}>
                                <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
                                <Text style={styles.detailLabel}>Date:</Text>
                                <Text style={styles.detailValue}>
                                    {scheduledBookingService.formatDate(selectedBooking.date)}
                                </Text>
                            </View>
                            
                            <View style={styles.detailRow}>
                                <Ionicons name="cash-outline" size={20} color={theme.colors.primary} />
                                <Text style={styles.detailLabel}>Amount:</Text>
                                <Text style={styles.detailValue}>₹{selectedBooking.total_amount}</Text>
                            </View>
                            
                            <View style={styles.detailRow}>
                                <Ionicons name="clipboard-outline" size={20} color={theme.colors.primary} />
                                <Text style={styles.detailLabel}>Duration:</Text>
                                <Text style={styles.detailValue}>{selectedBooking.duration_minutes} minutes</Text>
                            </View>
                            
                            {selectedBooking.customer_notes && (
                                <View style={styles.notesSection}>
                                    <Text style={styles.notesLabel}>Customer Notes:</Text>
                                    <Text style={styles.notesText}>{selectedBooking.customer_notes}</Text>
                                </View>
                            )}
                            
                            {selectedBooking.special_instructions && (
                                <View style={styles.notesSection}>
                                    <Text style={styles.notesLabel}>Special Instructions:</Text>
                                    <Text style={styles.notesText}>{selectedBooking.special_instructions}</Text>
                                </View>
                            )}
                        </View>
                        
                        <View style={styles.statusSection}>
                            <Text style={styles.statusLabel}>Status:</Text>
                            <View style={[styles.statusBadge, {
                                backgroundColor: selectedBooking.is_confirmed ? theme.colors.success : theme.colors.warning
                            }]}>
                                <Text style={styles.statusText}>
                                    {selectedBooking.is_confirmed ? 'Confirmed' : 'Pending Confirmation'}
                                </Text>
                            </View>
                        </View>
                        
                        {!selectedBooking.is_confirmed && (
                            <View style={styles.actionSection}>
                                <TouchableOpacity
                                    style={styles.confirmButton}
                                    onPress={() => confirmBooking(selectedBooking.booking_uuid)}
                                >
                                    <Text style={styles.confirmButtonText}>Confirm Booking</Text>
                                </TouchableOpacity>
                                
                                <TouchableOpacity style={styles.rescheduleButton}>
                                    <Text style={styles.rescheduleButtonText}>Reschedule</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>
                )}
            </View>
        </Modal>
    );

    if (loading && !calendarData) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Loading calendar...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {renderCalendarHeader()}
            
            <ScrollView
                style={styles.calendarContainer}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {renderCalendarSummary()}
                
                <View style={styles.calendarGrid}>
                    {calendarData?.calendar_data && Object.values(calendarData.calendar_data).map(renderDayCard)}
                </View>
            </ScrollView>
            
            {renderBookingModal()}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        backgroundColor: theme.colors.surface,
        paddingTop: 50,
        paddingHorizontal: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 15,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    headerControls: {
        gap: 15,
    },
    viewModeToggle: {
        flexDirection: 'row',
        backgroundColor: theme.colors.background,
        borderRadius: 8,
        padding: 2,
    },
    viewModeButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
        alignItems: 'center',
    },
    activeViewMode: {
        backgroundColor: theme.colors.primary,
    },
    viewModeText: {
        fontSize: 14,
        fontWeight: '500',
        color: theme.colors.textSecondary,
    },
    activeViewModeText: {
        color: theme.colors.surface,
    },
    navigationControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    navButton: {
        padding: 8,
    },
    dateDisplay: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        flex: 1,
        textAlign: 'center',
    },
    calendarContainer: {
        flex: 1,
    },
    summaryCard: {
        backgroundColor: theme.colors.surface,
        margin: 15,
        padding: 20,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    summaryTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 15,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    summaryItem: {
        alignItems: 'center',
    },
    summaryNumber: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.primary,
    },
    summaryLabel: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginTop: 4,
    },
    calendarGrid: {
        paddingHorizontal: 15,
    },
    dayCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: 12,
        marginBottom: 15,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    todayCard: {
        borderWidth: 2,
        borderColor: theme.colors.primary,
    },
    dayHeader: {
        padding: 15,
        backgroundColor: theme.colors.background,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dayName: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
    },
    dayNumber: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.primary,
    },
    todayText: {
        color: theme.colors.primary,
    },
    dayContent: {
        padding: 15,
        maxHeight: 200,
    },
    bookingItem: {
        backgroundColor: theme.colors.background,
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        borderLeftWidth: 4,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    bookingTime: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.text,
    },
    bookingDuration: {
        fontSize: 12,
        color: theme.colors.textSecondary,
    },
    pendingBadge: {
        backgroundColor: theme.colors.warning,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    pendingText: {
        fontSize: 10,
        color: theme.colors.surface,
        fontWeight: '600',
    },
    availableSlot: {
        padding: 8,
        borderRadius: 6,
        marginBottom: 4,
        backgroundColor: theme.colors.success + '20',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    slotTime: {
        fontSize: 12,
        color: theme.colors.success,
        fontWeight: '500',
    },
    slotLabel: {
        fontSize: 10,
        color: theme.colors.success,
    },
    moreSlots: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        marginTop: 8,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.background,
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
    bookingDetailCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
        gap: 10,
    },
    detailLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.textSecondary,
        minWidth: 60,
    },
    detailValue: {
        fontSize: 14,
        color: theme.colors.text,
        flex: 1,
    },
    notesSection: {
        marginTop: 15,
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
    },
    notesLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.textSecondary,
        marginBottom: 8,
    },
    notesText: {
        fontSize: 14,
        color: theme.colors.text,
        lineHeight: 20,
    },
    statusSection: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        gap: 10,
    },
    statusLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.textSecondary,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.colors.surface,
    },
    actionSection: {
        gap: 12,
    },
    confirmButton: {
        backgroundColor: theme.colors.success,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    confirmButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.surface,
    },
    rescheduleButton: {
        borderWidth: 2,
        borderColor: theme.colors.primary,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    rescheduleButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.primary,
    },
});

export default AgentCalendarScreen;