/**
 * Scheduled Booking Service
 * Frontend service for scheduled bookings and agent calendar management
 */

import { API_BASE_URL } from '../config';

class ScheduledBookingService {
    constructor() {
        this.baseURL = `${API_BASE_URL}/scheduled-bookings`;
    }

    /**
     * Create or update agent's working schedule
     */
    async createAgentSchedule(agentId, scheduleData) {
        try {
            const response = await fetch(`${this.baseURL}/agent/${agentId}/schedule`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(scheduleData),
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.detail || 'Failed to create schedule');
            }

            return {
                success: true,
                schedule: result.schedule,
                message: result.message
            };
        } catch (error) {
            console.error('Error creating agent schedule:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get available time slots for an agent
     */
    async getAvailableSlots(agentId, startDate, endDate, includeEmergencySlots = false) {
        try {
            const params = new URLSearchParams({
                start_date: startDate,
                end_date: endDate,
                include_emergency_slots: includeEmergencySlots.toString()
            });

            const response = await fetch(`${this.baseURL}/agent/${agentId}/available-slots?${params}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.detail || 'Failed to get available slots');
            }

            return {
                success: true,
                availableSlots: result.available_slots,
                totalSlots: result.total_slots,
                dateRange: result.date_range
            };
        } catch (error) {
            console.error('Error getting available slots:', error);
            return {
                success: false,
                error: error.message,
                availableSlots: []
            };
        }
    }

    /**
     * Create a new scheduled booking
     */
    async createScheduledBooking(bookingData) {
        try {
            const response = await fetch(`${this.baseURL}/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(bookingData),
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.detail || 'Failed to create scheduled booking');
            }

            return {
                success: true,
                bookingUuid: result.booking_uuid,
                scheduledDatetime: result.scheduled_datetime,
                confirmationDeadline: result.confirmation_deadline,
                message: result.message
            };
        } catch (error) {
            console.error('Error creating scheduled booking:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get agent's calendar with scheduled bookings (Teams-like interface)
     */
    async getAgentCalendar(agentId, startDate, endDate) {
        try {
            const params = new URLSearchParams({
                start_date: startDate,
                end_date: endDate
            });

            const response = await fetch(`${this.baseURL}/agent/${agentId}/calendar?${params}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.detail || 'Failed to get calendar data');
            }

            return {
                success: true,
                calendar: result.calendar
            };
        } catch (error) {
            console.error('Error getting agent calendar:', error);
            return {
                success: false,
                error: error.message,
                calendar: null
            };
        }
    }

    /**
     * Agent confirms scheduled booking
     */
    async confirmScheduledBooking(bookingUuid, agentId) {
        try {
            const response = await fetch(`${this.baseURL}/booking/${bookingUuid}/confirm`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ agent_id: agentId }),
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.detail || 'Failed to confirm booking');
            }

            return {
                success: true,
                bookingUuid: result.booking_uuid,
                confirmedAt: result.confirmed_at,
                scheduledDatetime: result.scheduled_datetime,
                message: result.message
            };
        } catch (error) {
            console.error('Error confirming booking:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Reschedule booking to different time slot
     */
    async rescheduleBooking(bookingUuid, newTimeSlotId, reason = null) {
        try {
            const response = await fetch(`${this.baseURL}/booking/${bookingUuid}/reschedule`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    new_time_slot_id: newTimeSlotId,
                    reason: reason
                }),
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.detail || 'Failed to reschedule booking');
            }

            return {
                success: true,
                bookingUuid: result.booking_uuid,
                newScheduledDatetime: result.new_scheduled_datetime,
                rescheduleCount: result.reschedule_count,
                confirmationDeadline: result.confirmation_deadline,
                message: result.message
            };
        } catch (error) {
            console.error('Error rescheduling booking:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get agent's current working schedule
     */
    async getAgentSchedule(agentId) {
        try {
            const response = await fetch(`${this.baseURL}/agent/${agentId}/schedule`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.detail || 'Failed to get agent schedule');
            }

            return {
                success: true,
                schedules: result.schedules,
                totalWorkingDays: result.total_working_days
            };
        } catch (error) {
            console.error('Error getting agent schedule:', error);
            return {
                success: false,
                error: error.message,
                schedules: []
            };
        }
    }

    /**
     * Delete/deactivate agent's schedule for specific day
     */
    async deleteAgentSchedule(agentId, dayOfWeek) {
        try {
            const response = await fetch(`${this.baseURL}/agent/${agentId}/schedule/${dayOfWeek}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.detail || 'Failed to delete schedule');
            }

            return {
                success: true,
                message: result.message
            };
        } catch (error) {
            console.error('Error deleting agent schedule:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get agent's booking statistics
     */
    async getAgentBookingStats(agentId, startDate, endDate) {
        try {
            const params = new URLSearchParams({
                start_date: startDate,
                end_date: endDate
            });

            const response = await fetch(`${this.baseURL}/agent/${agentId}/stats?${params}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.detail || 'Failed to get booking stats');
            }

            return {
                success: true,
                stats: result.stats,
                dateRange: result.date_range
            };
        } catch (error) {
            console.error('Error getting booking stats:', error);
            return {
                success: false,
                error: error.message,
                stats: null
            };
        }
    }

    // Utility methods for calendar management

    /**
     * Format time for display
     */
    formatTime(timeString) {
        const time = new Date(`1970-01-01T${timeString}`);
        return time.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }

    /**
     * Format date for display
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    /**
     * Get current week date range
     */
    getCurrentWeekRange() {
        const today = new Date();
        const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
        
        const monday = new Date(today);
        monday.setDate(today.getDate() + mondayOffset);
        
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        
        return {
            startDate: monday.toISOString().split('T')[0],
            endDate: sunday.toISOString().split('T')[0]
        };
    }

    /**
     * Get next week date range
     */
    getNextWeekRange() {
        const currentWeek = this.getCurrentWeekRange();
        const startDate = new Date(currentWeek.startDate);
        startDate.setDate(startDate.getDate() + 7);
        
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        
        return {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0]
        };
    }

    /**
     * Get month date range
     */
    getMonthRange(year, month) {
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0);
        
        return {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0]
        };
    }

    /**
     * Validate working hours
     */
    validateWorkingHours(startTime, endTime) {
        const start = new Date(`1970-01-01T${startTime}`);
        const end = new Date(`1970-01-01T${endTime}`);
        
        if (start >= end) {
            return {
                isValid: false,
                error: 'Start time must be before end time'
            };
        }
        
        const duration = (end - start) / (1000 * 60); // Duration in minutes
        if (duration < 60) {
            return {
                isValid: false,
                error: 'Working period must be at least 1 hour'
            };
        }
        
        if (duration > 16 * 60) {
            return {
                isValid: false,
                error: 'Working period cannot exceed 16 hours'
            };
        }
        
        return {
            isValid: true,
            duration: duration
        };
    }

    /**
     * Calculate available booking slots within date range
     */
    calculateBookingSlots(startTime, endTime, slotDuration, breakDuration) {
        const start = new Date(`1970-01-01T${startTime}`);
        const end = new Date(`1970-01-01T${endTime}`);
        
        const slots = [];
        let currentTime = start;
        
        while (currentTime.getTime() + (slotDuration * 60 * 1000) <= end.getTime()) {
            const slotEnd = new Date(currentTime.getTime() + (slotDuration * 60 * 1000));
            
            slots.push({
                startTime: currentTime.toTimeString().split(' ')[0].substring(0, 5),
                endTime: slotEnd.toTimeString().split(' ')[0].substring(0, 5)
            });
            
            // Add break time for next slot
            currentTime = new Date(slotEnd.getTime() + (breakDuration * 60 * 1000));
        }
        
        return slots;
    }

    /**
     * Check if time slot is in the past
     */
    isSlotInPast(slotDate, slotTime) {
        const slotDateTime = new Date(`${slotDate}T${slotTime}`);
        const now = new Date();
        
        return slotDateTime < now;
    }

    /**
     * Get days until booking
     */
    getDaysUntilBooking(bookingDate) {
        const booking = new Date(bookingDate);
        const today = new Date();
        const timeDiff = booking.getTime() - today.getTime();
        return Math.ceil(timeDiff / (1000 * 3600 * 24));
    }
}

export default new ScheduledBookingService();