/**
 * Agent Schedule Setup Screen
 * Allows agents to set their working hours and availability
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    TextInput,
    Modal,
    Switch,
    ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { theme } from '../theme';
import scheduledBookingService from '../services/scheduledBookingService';

const DAYS_OF_WEEK = [
    { id: 0, name: 'Monday', short: 'Mon' },
    { id: 1, name: 'Tuesday', short: 'Tue' },
    { id: 2, name: 'Wednesday', short: 'Wed' },
    { id: 3, name: 'Thursday', short: 'Thu' },
    { id: 4, name: 'Friday', short: 'Fri' },
    { id: 5, name: 'Saturday', short: 'Sat' },
    { id: 6, name: 'Sunday', short: 'Sun' }
];

const AgentScheduleSetupScreen = ({ navigation, route }) => {
    const { agentId } = route.params;
    
    // State management
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState(null);
    const [showTimePicker, setShowTimePicker] = useState({ show: false, type: '', time: new Date() });
    
    // Form state for editing
    const [formData, setFormData] = useState({
        day_of_week: 0,
        start_time: '09:00',
        end_time: '17:00',
        slot_duration_minutes: 60,
        break_duration_minutes: 15,
        max_bookings_per_slot: 3,
        is_active: true
    });

    useEffect(() => {
        loadSchedules();
    }, [agentId]);

    const loadSchedules = async () => {
        setLoading(true);
        try {
            const result = await scheduledBookingService.getAgentSchedule(agentId);
            if (result.success) {
                setSchedules(result.schedules);
            } else {
                Alert.alert('Error', result.error || 'Failed to load schedules');
            }
        } catch (error) {
            console.error('Error loading schedules:', error);
            Alert.alert('Error', 'Failed to load schedules');
        } finally {
            setLoading(false);
        }
    };

    const openEditModal = (schedule = null) => {
        if (schedule) {
            setFormData({
                day_of_week: schedule.day_of_week,
                start_time: schedule.start_time,
                end_time: schedule.end_time,
                slot_duration_minutes: schedule.slot_duration_minutes,
                break_duration_minutes: schedule.break_duration_minutes,
                max_bookings_per_slot: schedule.max_bookings_per_slot,
                is_active: schedule.is_active
            });
            setEditingSchedule(schedule);
        } else {
            // Find next available day
            const usedDays = schedules.filter(s => s.is_active).map(s => s.day_of_week);
            const nextDay = DAYS_OF_WEEK.find(day => !usedDays.includes(day.id));
            
            setFormData({
                day_of_week: nextDay ? nextDay.id : 0,
                start_time: '09:00',
                end_time: '17:00',
                slot_duration_minutes: 60,
                break_duration_minutes: 15,
                max_bookings_per_slot: 3,
                is_active: true
            });
            setEditingSchedule(null);
        }
        setShowEditModal(true);
    };

    const saveSchedule = async () => {
        try {
            // Validate form data
            const validation = scheduledBookingService.validateWorkingHours(
                formData.start_time,
                formData.end_time
            );
            
            if (!validation.isValid) {
                Alert.alert('Invalid Schedule', validation.error);
                return;
            }

            const result = await scheduledBookingService.createAgentSchedule(agentId, formData);
            
            if (result.success) {
                Alert.alert('Success', 'Schedule saved successfully');
                setShowEditModal(false);
                loadSchedules();
            } else {
                Alert.alert('Error', result.error);
            }
        } catch (error) {
            console.error('Error saving schedule:', error);
            Alert.alert('Error', 'Failed to save schedule');
        }
    };

    const deleteSchedule = async (dayOfWeek) => {
        Alert.alert(
            'Delete Schedule',
            'Are you sure you want to delete this schedule?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const result = await scheduledBookingService.deleteAgentSchedule(agentId, dayOfWeek);
                            if (result.success) {
                                Alert.alert('Success', 'Schedule deleted successfully');
                                loadSchedules();
                            } else {
                                Alert.alert('Error', result.error);
                            }
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete schedule');
                        }
                    }
                }
            ]
        );
    };

    const showTimePickerModal = (type, currentTime) => {
        const time = new Date();
        const [hours, minutes] = currentTime.split(':');
        time.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        setShowTimePicker({ show: true, type, time });
    };

    const handleTimeChange = (event, selectedTime) => {
        if (event.type === 'set' && selectedTime) {
            const timeString = selectedTime.toTimeString().split(' ')[0].substring(0, 5);
            setFormData(prev => ({
                ...prev,
                [showTimePicker.type]: timeString
            }));
        }
        setShowTimePicker({ show: false, type: '', time: new Date() });
    };

    const getScheduleForDay = (dayId) => {
        return schedules.find(s => s.day_of_week === dayId && s.is_active);
    };

    const calculateSlots = (startTime, endTime, slotDuration, breakDuration) => {
        return scheduledBookingService.calculateBookingSlots(
            startTime, endTime, slotDuration, breakDuration
        );
    };

    const renderScheduleCard = (day) => {
        const schedule = getScheduleForDay(day.id);
        
        return (
            <View key={day.id} style={styles.scheduleCard}>
                <View style={styles.scheduleHeader}>
                    <Text style={styles.dayName}>{day.name}</Text>
                    {schedule && (
                        <View style={styles.scheduleActions}>
                            <TouchableOpacity
                                onPress={() => openEditModal(schedule)}
                                style={styles.editButton}
                            >
                                <Ionicons name="pencil" size={16} color={theme.colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => deleteSchedule(schedule.day_of_week)}
                                style={styles.deleteButton}
                            >
                                <Ionicons name="trash" size={16} color={theme.colors.error} />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
                
                {schedule ? (
                    <View style={styles.scheduleDetails}>
                        <View style={styles.timeRow}>
                            <Ionicons name="time-outline" size={16} color={theme.colors.primary} />
                            <Text style={styles.timeText}>
                                {scheduledBookingService.formatTime(schedule.start_time)} - {scheduledBookingService.formatTime(schedule.end_time)}
                            </Text>
                        </View>
                        
                        <View style={styles.detailsRow}>
                            <View style={styles.detailItem}>
                                <Text style={styles.detailLabel}>Slot Duration</Text>
                                <Text style={styles.detailValue}>{schedule.slot_duration_minutes}min</Text>
                            </View>
                            <View style={styles.detailItem}>
                                <Text style={styles.detailLabel}>Break Time</Text>
                                <Text style={styles.detailValue}>{schedule.break_duration_minutes}min</Text>
                            </View>
                            <View style={styles.detailItem}>
                                <Text style={styles.detailLabel}>Max Bookings</Text>
                                <Text style={styles.detailValue}>{schedule.max_bookings_per_slot}</Text>
                            </View>
                        </View>
                        
                        <View style={styles.slotsPreview}>
                            <Text style={styles.slotsTitle}>Daily Slots:</Text>
                            <Text style={styles.slotsCount}>
                                {calculateSlots(
                                    schedule.start_time,
                                    schedule.end_time,
                                    schedule.slot_duration_minutes,
                                    schedule.break_duration_minutes
                                ).length} slots available
                            </Text>
                        </View>
                    </View>
                ) : (
                    <View style={styles.noSchedule}>
                        <Text style={styles.noScheduleText}>Not working</Text>
                        <TouchableOpacity
                            onPress={() => openEditModal()}
                            style={styles.addButton}
                        >
                            <Ionicons name="add" size={20} color={theme.colors.primary} />
                            <Text style={styles.addButtonText}>Add Schedule</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    const renderEditModal = () => (
        <Modal
            visible={showEditModal}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowEditModal(false)}
        >
            <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>
                        {editingSchedule ? 'Edit Schedule' : 'Add Schedule'}
                    </Text>
                    <TouchableOpacity onPress={() => setShowEditModal(false)}>
                        <Ionicons name="close" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                </View>
                
                <ScrollView style={styles.modalContent}>
                    {/* Day Selection */}
                    <View style={styles.formSection}>
                        <Text style={styles.sectionTitle}>Working Day</Text>
                        <View style={styles.daySelector}>
                            {DAYS_OF_WEEK.map(day => (
                                <TouchableOpacity
                                    key={day.id}
                                    style={[
                                        styles.dayOption,
                                        formData.day_of_week === day.id && styles.selectedDay
                                    ]}
                                    onPress={() => setFormData(prev => ({ ...prev, day_of_week: day.id }))}
                                >
                                    <Text style={[
                                        styles.dayOptionText,
                                        formData.day_of_week === day.id && styles.selectedDayText
                                    ]}>
                                        {day.short}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                    
                    {/* Working Hours */}
                    <View style={styles.formSection}>
                        <Text style={styles.sectionTitle}>Working Hours</Text>
                        <View style={styles.timeSelector}>
                            <TouchableOpacity
                                style={styles.timeButton}
                                onPress={() => showTimePickerModal('start_time', formData.start_time)}
                            >
                                <Text style={styles.timeLabel}>Start Time</Text>
                                <Text style={styles.timeValue}>
                                    {scheduledBookingService.formatTime(formData.start_time)}
                                </Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity
                                style={styles.timeButton}
                                onPress={() => showTimePickerModal('end_time', formData.end_time)}
                            >
                                <Text style={styles.timeLabel}>End Time</Text>
                                <Text style={styles.timeValue}>
                                    {scheduledBookingService.formatTime(formData.end_time)}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    
                    {/* Slot Configuration */}
                    <View style={styles.formSection}>
                        <Text style={styles.sectionTitle}>Slot Configuration</Text>
                        
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Slot Duration (minutes)</Text>
                            <TextInput
                                style={styles.numberInput}
                                value={formData.slot_duration_minutes.toString()}
                                onChangeText={(text) => setFormData(prev => ({
                                    ...prev,
                                    slot_duration_minutes: parseInt(text) || 60
                                }))}
                                keyboardType="numeric"
                                placeholder="60"
                            />
                        </View>
                        
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Break Between Slots (minutes)</Text>
                            <TextInput
                                style={styles.numberInput}
                                value={formData.break_duration_minutes.toString()}
                                onChangeText={(text) => setFormData(prev => ({
                                    ...prev,
                                    break_duration_minutes: parseInt(text) || 15
                                }))}
                                keyboardType="numeric"
                                placeholder="15"
                            />
                        </View>
                        
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Maximum Bookings Per Slot</Text>
                            <TextInput
                                style={styles.numberInput}
                                value={formData.max_bookings_per_slot.toString()}
                                onChangeText={(text) => setFormData(prev => ({
                                    ...prev,
                                    max_bookings_per_slot: parseInt(text) || 3
                                }))}
                                keyboardType="numeric"
                                placeholder="3"
                            />
                        </View>
                        
                        <View style={styles.switchGroup}>
                            <Text style={styles.inputLabel}>Active Schedule</Text>
                            <Switch
                                value={formData.is_active}
                                onValueChange={(value) => setFormData(prev => ({ ...prev, is_active: value }))}
                                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                                thumbColor={formData.is_active ? theme.colors.surface : theme.colors.textSecondary}
                            />
                        </View>
                    </View>
                    
                    {/* Preview */}
                    <View style={styles.formSection}>
                        <Text style={styles.sectionTitle}>Preview</Text>
                        <View style={styles.previewCard}>
                            <Text style={styles.previewText}>
                                {DAYS_OF_WEEK[formData.day_of_week].name}: {scheduledBookingService.formatTime(formData.start_time)} - {scheduledBookingService.formatTime(formData.end_time)}
                            </Text>
                            <Text style={styles.previewSubtext}>
                                {calculateSlots(
                                    formData.start_time,
                                    formData.end_time,
                                    formData.slot_duration_minutes,
                                    formData.break_duration_minutes
                                ).length} slots of {formData.slot_duration_minutes} minutes each
                            </Text>
                        </View>
                    </View>
                    
                    <TouchableOpacity style={styles.saveButton} onPress={saveSchedule}>
                        <Text style={styles.saveButtonText}>Save Schedule</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
            
            {showTimePicker.show && (
                <DateTimePicker
                    value={showTimePicker.time}
                    mode="time"
                    is24Hour={false}
                    onChange={handleTimeChange}
                />
            )}
        </Modal>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Working Schedule</Text>
                <TouchableOpacity onPress={() => navigation.navigate('AgentCalendar', { agentId })}>
                    <Ionicons name="calendar-outline" size={24} color={theme.colors.primary} />
                </TouchableOpacity>
            </View>
            
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={styles.loadingText}>Loading schedules...</Text>
                </View>
            ) : (
                <ScrollView style={styles.content}>
                    <View style={styles.summaryCard}>
                        <Text style={styles.summaryTitle}>Schedule Overview</Text>
                        <Text style={styles.summaryText}>
                            {schedules.filter(s => s.is_active).length} working days configured
                        </Text>
                    </View>
                    
                    <View style={styles.schedulesContainer}>
                        {DAYS_OF_WEEK.map(renderScheduleCard)}
                    </View>
                </ScrollView>
            )}
            
            {renderEditModal()}
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
    content: {
        flex: 1,
        padding: 15,
    },
    summaryCard: {
        backgroundColor: theme.colors.surface,
        padding: 20,
        borderRadius: 12,
        marginBottom: 20,
    },
    summaryTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 8,
    },
    summaryText: {
        fontSize: 14,
        color: theme.colors.textSecondary,
    },
    schedulesContainer: {
        gap: 15,
    },
    scheduleCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    scheduleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    dayName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    scheduleActions: {
        flexDirection: 'row',
        gap: 8,
    },
    editButton: {
        padding: 8,
        borderRadius: 6,
        backgroundColor: theme.colors.primary + '20',
    },
    deleteButton: {
        padding: 8,
        borderRadius: 6,
        backgroundColor: theme.colors.error + '20',
    },
    scheduleDetails: {
        gap: 12,
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    timeText: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.primary,
    },
    detailsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    detailItem: {
        alignItems: 'center',
    },
    detailLabel: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginBottom: 4,
    },
    detailValue: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.text,
    },
    slotsPreview: {
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    slotsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.text,
    },
    slotsCount: {
        fontSize: 12,
        color: theme.colors.success,
    },
    noSchedule: {
        alignItems: 'center',
        padding: 20,
    },
    noScheduleText: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginBottom: 12,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: theme.colors.primary,
        borderRadius: 8,
    },
    addButtonText: {
        fontSize: 14,
        color: theme.colors.primary,
        fontWeight: '600',
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
    // Modal Styles
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
    formSection: {
        marginBottom: 25,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 15,
    },
    daySelector: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    dayOption: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 8,
        minWidth: 45,
        alignItems: 'center',
    },
    selectedDay: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary,
    },
    dayOptionText: {
        fontSize: 14,
        color: theme.colors.text,
    },
    selectedDayText: {
        color: theme.colors.surface,
        fontWeight: '600',
    },
    timeSelector: {
        flexDirection: 'row',
        gap: 12,
    },
    timeButton: {
        flex: 1,
        padding: 16,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 8,
        alignItems: 'center',
    },
    timeLabel: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginBottom: 4,
    },
    timeValue: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
    },
    inputGroup: {
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 8,
    },
    numberInput: {
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: theme.colors.text,
        backgroundColor: theme.colors.surface,
    },
    switchGroup: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    previewCard: {
        backgroundColor: theme.colors.surface,
        padding: 16,
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: theme.colors.primary,
    },
    previewText: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 4,
    },
    previewSubtext: {
        fontSize: 14,
        color: theme.colors.textSecondary,
    },
    saveButton: {
        backgroundColor: theme.colors.primary,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 40,
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.surface,
    },
});

export default AgentScheduleSetupScreen;