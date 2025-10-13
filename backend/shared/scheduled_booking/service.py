"""
Scheduled Booking Service
Business logic for scheduled bookings, time slot management, and calendar operations
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func, text
from datetime import datetime, date, time, timedelta
from typing import Dict, List, Optional, Tuple, Any
import logging
import calendar

from .models import (
    AgentSchedule, AgentTimeSlot, ScheduledBooking, BookingReminder,
    TimeSlotStatus, ScheduleRecurrence
)

logger = logging.getLogger(__name__)

class ScheduledBookingService:
    """
    Service for managing scheduled bookings and agent calendars
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.default_slot_duration = 60  # Default 60 minutes per slot
        self.max_advance_booking_days = 30  # Maximum days in advance for booking
    
    def create_agent_schedule(self, agent_id: int, schedule_data: Dict[str, Any]) -> AgentSchedule:
        """
        Create or update agent's working schedule
        """
        try:
            # Check if schedule already exists for this day
            existing_schedule = self.db.query(AgentSchedule).filter(
                and_(
                    AgentSchedule.agent_id == agent_id,
                    AgentSchedule.day_of_week == schedule_data['day_of_week']
                )
            ).first()
            
            if existing_schedule:
                # Update existing schedule
                for key, value in schedule_data.items():
                    if hasattr(existing_schedule, key):
                        setattr(existing_schedule, key, value)
                schedule = existing_schedule
            else:
                # Create new schedule
                schedule = AgentSchedule(
                    agent_id=agent_id,
                    **schedule_data
                )
                self.db.add(schedule)
            
            self.db.commit()
            self.db.refresh(schedule)
            
            # Generate time slots for the next 30 days
            self.generate_time_slots_for_schedule(schedule)
            
            logger.info(f"📅 Created/updated schedule for agent {agent_id}, day {schedule_data['day_of_week']}")
            return schedule
            
        except Exception as e:
            logger.error(f"Error creating agent schedule: {e}")
            self.db.rollback()
            raise
    
    def generate_time_slots_for_schedule(self, schedule: AgentSchedule, days_ahead: int = 30) -> List[AgentTimeSlot]:
        """
        Generate individual time slots based on agent schedule
        """
        try:
            slots = []
            start_date = date.today()
            end_date = start_date + timedelta(days=days_ahead)
            
            current_date = start_date
            while current_date <= end_date:
                # Check if this date matches the schedule's day of week
                if current_date.weekday() == schedule.day_of_week:
                    # Generate slots for this day
                    day_slots = self.generate_slots_for_day(schedule, current_date)
                    slots.extend(day_slots)
                
                current_date += timedelta(days=1)
            
            logger.info(f"📅 Generated {len(slots)} time slots for schedule {schedule.id}")
            return slots
            
        except Exception as e:
            logger.error(f"Error generating time slots: {e}")
            return []
    
    def generate_slots_for_day(self, schedule: AgentSchedule, target_date: date) -> List[AgentTimeSlot]:
        """
        Generate time slots for a specific day based on schedule
        """
        try:
            slots = []
            
            # Calculate time slots within working hours
            current_time = datetime.combine(target_date, schedule.start_time)
            end_time = datetime.combine(target_date, schedule.end_time)
            slot_duration = timedelta(minutes=schedule.slot_duration_minutes)
            break_duration = timedelta(minutes=schedule.break_duration_minutes)
            
            while current_time + slot_duration <= end_time:
                slot_end = current_time + slot_duration
                
                # Check if slot already exists
                existing_slot = self.db.query(AgentTimeSlot).filter(
                    and_(
                        AgentTimeSlot.agent_id == schedule.agent_id,
                        AgentTimeSlot.slot_date == target_date,
                        AgentTimeSlot.slot_start_time == current_time.time(),
                        AgentTimeSlot.slot_end_time == slot_end.time()
                    )
                ).first()
                
                if not existing_slot:
                    # Create new time slot
                    time_slot = AgentTimeSlot(
                        agent_id=schedule.agent_id,
                        agent_schedule_id=schedule.id,
                        slot_date=target_date,
                        slot_start_time=current_time.time(),
                        slot_end_time=slot_end.time(),
                        status=TimeSlotStatus.AVAILABLE,
                        max_bookings=schedule.max_bookings_per_slot
                    )
                    
                    self.db.add(time_slot)
                    slots.append(time_slot)
                
                # Move to next slot (including break time)
                current_time = slot_end + break_duration
            
            if slots:
                self.db.commit()
            
            return slots
            
        except Exception as e:
            logger.error(f"Error generating slots for day {target_date}: {e}")
            self.db.rollback()
            return []
    
    def get_available_slots(self, agent_id: int, start_date: date, end_date: date) -> List[Dict[str, Any]]:
        """
        Get available time slots for an agent within date range
        """
        try:
            available_slots = self.db.query(AgentTimeSlot).filter(
                and_(
                    AgentTimeSlot.agent_id == agent_id,
                    AgentTimeSlot.slot_date >= start_date,
                    AgentTimeSlot.slot_date <= end_date,
                    AgentTimeSlot.status == TimeSlotStatus.AVAILABLE,
                    AgentTimeSlot.current_bookings < AgentTimeSlot.max_bookings
                )
            ).order_by(
                AgentTimeSlot.slot_date,
                AgentTimeSlot.slot_start_time
            ).all()
            
            slots_data = []
            for slot in available_slots:
                slots_data.append({
                    "slot_id": slot.id,
                    "date": slot.slot_date.isoformat(),
                    "start_time": slot.slot_start_time.strftime("%H:%M"),
                    "end_time": slot.slot_end_time.strftime("%H:%M"),
                    "datetime_start": slot.datetime_start.isoformat(),
                    "datetime_end": slot.datetime_end.isoformat(),
                    "available_bookings": slot.max_bookings - slot.current_bookings,
                    "is_emergency_slot": slot.is_emergency_slot,
                    "custom_rate": slot.custom_rate
                })
            
            return slots_data
            
        except Exception as e:
            logger.error(f"Error getting available slots for agent {agent_id}: {e}")
            return []
    
    def create_scheduled_booking(self, booking_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new scheduled booking
        """
        try:
            # Validate time slot availability
            time_slot = self.db.query(AgentTimeSlot).filter(
                AgentTimeSlot.id == booking_data['time_slot_id']
            ).first()
            
            if not time_slot:
                return {"success": False, "error": "Time slot not found"}
            
            if not time_slot.is_available:
                return {"success": False, "error": "Time slot is not available"}
            
            # Create scheduled booking
            scheduled_booking = ScheduledBooking(
                booking_id=booking_data['booking_id'],
                agent_id=booking_data['agent_id'],
                customer_id=booking_data['customer_id'],
                time_slot_id=time_slot.id,
                agent_schedule_id=time_slot.agent_schedule_id,
                scheduled_date=time_slot.slot_date,
                scheduled_start_time=time_slot.slot_start_time,
                scheduled_end_time=time_slot.slot_end_time,
                estimated_duration_minutes=booking_data.get('duration_minutes', 60),
                customer_notes=booking_data.get('customer_notes'),
                special_instructions=booking_data.get('special_instructions'),
                scheduled_rate=booking_data['rate'],
                total_scheduled_amount=booking_data['total_amount'],
                confirmation_deadline=datetime.now() + timedelta(hours=24)  # Agent must confirm within 24h
            )
            
            self.db.add(scheduled_booking)
            
            # Update time slot booking count
            time_slot.current_bookings += 1
            if time_slot.current_bookings >= time_slot.max_bookings:
                time_slot.status = TimeSlotStatus.BOOKED
            
            # Create booking reminders
            self.create_booking_reminders(scheduled_booking)
            
            self.db.commit()
            self.db.refresh(scheduled_booking)
            
            logger.info(f"📅 Created scheduled booking {scheduled_booking.booking_uuid}")
            
            return {
                "success": True,
                "scheduled_booking_uuid": scheduled_booking.booking_uuid,
                "scheduled_datetime": scheduled_booking.scheduled_datetime.isoformat(),
                "confirmation_deadline": scheduled_booking.confirmation_deadline.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error creating scheduled booking: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}
    
    def create_booking_reminders(self, scheduled_booking: ScheduledBooking):
        """
        Create reminder notifications for scheduled booking
        """
        try:
            booking_datetime = scheduled_booking.scheduled_datetime
            
            # 24 hours before reminder
            reminder_24h = BookingReminder(
                scheduled_booking_id=scheduled_booking.id,
                reminder_type="24h_before",
                reminder_time=booking_datetime - timedelta(hours=24),
                recipient_type="both"
            )
            self.db.add(reminder_24h)
            
            # 2 hours before reminder
            reminder_2h = BookingReminder(
                scheduled_booking_id=scheduled_booking.id,
                reminder_type="2h_before",
                reminder_time=booking_datetime - timedelta(hours=2),
                recipient_type="both"
            )
            self.db.add(reminder_2h)
            
            # 30 minutes before reminder (for agent)
            reminder_30m = BookingReminder(
                scheduled_booking_id=scheduled_booking.id,
                reminder_type="30m_before",
                reminder_time=booking_datetime - timedelta(minutes=30),
                recipient_type="agent"
            )
            self.db.add(reminder_30m)
            
            logger.info(f"📅 Created reminders for booking {scheduled_booking.booking_uuid}")
            
        except Exception as e:
            logger.error(f"Error creating booking reminders: {e}")
    
    def get_agent_calendar(self, agent_id: int, start_date: date, end_date: date) -> Dict[str, Any]:
        """
        Get agent's calendar with all scheduled bookings
        Teams-like calendar interface data
        """
        try:
            # Get scheduled bookings
            bookings = self.db.query(ScheduledBooking).filter(
                and_(
                    ScheduledBooking.agent_id == agent_id,
                    ScheduledBooking.scheduled_date >= start_date,
                    ScheduledBooking.scheduled_date <= end_date,
                    ScheduledBooking.is_cancelled == False
                )
            ).order_by(
                ScheduledBooking.scheduled_date,
                ScheduledBooking.scheduled_start_time
            ).all()
            
            # Get available time slots
            available_slots = self.get_available_slots(agent_id, start_date, end_date)
            
            # Organize by date
            calendar_data = {}
            current_date = start_date
            
            while current_date <= end_date:
                date_str = current_date.isoformat()
                calendar_data[date_str] = {
                    "date": date_str,
                    "day_name": current_date.strftime("%A"),
                    "bookings": [],
                    "available_slots": [],
                    "is_working_day": False
                }
                current_date += timedelta(days=1)
            
            # Add bookings to calendar
            for booking in bookings:
                date_str = booking.scheduled_date.isoformat()
                if date_str in calendar_data:
                    calendar_data[date_str]["bookings"].append({
                        "booking_uuid": booking.booking_uuid,
                        "start_time": booking.scheduled_start_time.strftime("%H:%M"),
                        "end_time": booking.scheduled_end_time.strftime("%H:%M"),
                        "duration_minutes": booking.estimated_duration_minutes,
                        "customer_notes": booking.customer_notes,
                        "special_instructions": booking.special_instructions,
                        "is_confirmed": booking.is_confirmed_by_agent,
                        "total_amount": booking.total_scheduled_amount,
                        "is_today": booking.is_today,
                        "days_until": booking.days_until_booking
                    })
            
            # Add available slots to calendar
            for slot in available_slots:
                slot_date = slot["date"]
                if slot_date in calendar_data:
                    calendar_data[slot_date]["available_slots"].append(slot)
                    calendar_data[slot_date]["is_working_day"] = True
            
            # Calculate summary statistics
            total_bookings = len(bookings)
            confirmed_bookings = sum(1 for b in bookings if b.is_confirmed_by_agent)
            total_earnings = sum(b.total_scheduled_amount for b in bookings)
            
            return {
                "agent_id": agent_id,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "calendar_data": calendar_data,
                "summary": {
                    "total_bookings": total_bookings,
                    "confirmed_bookings": confirmed_bookings,
                    "pending_confirmations": total_bookings - confirmed_bookings,
                    "total_scheduled_earnings": total_earnings,
                    "working_days": sum(1 for day in calendar_data.values() if day["is_working_day"])
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting agent calendar: {e}")
            return {"error": str(e)}
    
    def confirm_scheduled_booking(self, booking_uuid: str, agent_id: int) -> Dict[str, Any]:
        """
        Agent confirms acceptance of scheduled booking
        """
        try:
            booking = self.db.query(ScheduledBooking).filter(
                and_(
                    ScheduledBooking.booking_uuid == booking_uuid,
                    ScheduledBooking.agent_id == agent_id
                )
            ).first()
            
            if not booking:
                return {"success": False, "error": "Booking not found"}
            
            if booking.is_confirmed_by_agent:
                return {"success": False, "error": "Booking already confirmed"}
            
            if booking.confirmation_deadline and datetime.now() > booking.confirmation_deadline:
                return {"success": False, "error": "Confirmation deadline passed"}
            
            # Confirm booking
            booking.is_confirmed_by_agent = True
            self.db.commit()
            
            logger.info(f"📅 Agent confirmed scheduled booking {booking_uuid}")
            
            return {
                "success": True,
                "booking_uuid": booking_uuid,
                "confirmed_at": datetime.now().isoformat(),
                "scheduled_datetime": booking.scheduled_datetime.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error confirming booking: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}
    
    def reschedule_booking(self, booking_uuid: str, new_time_slot_id: int, reason: str = None) -> Dict[str, Any]:
        """
        Reschedule a booking to a different time slot
        """
        try:
            # Get existing booking
            booking = self.db.query(ScheduledBooking).filter(
                ScheduledBooking.booking_uuid == booking_uuid
            ).first()
            
            if not booking:
                return {"success": False, "error": "Booking not found"}
            
            # Get new time slot
            new_slot = self.db.query(AgentTimeSlot).filter(
                AgentTimeSlot.id == new_time_slot_id
            ).first()
            
            if not new_slot or not new_slot.is_available:
                return {"success": False, "error": "New time slot not available"}
            
            # Release old time slot
            old_slot = self.db.query(AgentTimeSlot).filter(
                AgentTimeSlot.id == booking.time_slot_id
            ).first()
            
            if old_slot:
                old_slot.current_bookings = max(0, old_slot.current_bookings - 1)
                if old_slot.current_bookings < old_slot.max_bookings:
                    old_slot.status = TimeSlotStatus.AVAILABLE
            
            # Update booking with new slot
            booking.time_slot_id = new_slot.id
            booking.scheduled_date = new_slot.slot_date
            booking.scheduled_start_time = new_slot.slot_start_time
            booking.scheduled_end_time = new_slot.slot_end_time
            booking.is_rescheduled = True
            booking.reschedule_count += 1
            
            if booking.reschedule_count == 1:  # First reschedule
                booking.original_scheduled_date = booking.scheduled_date
            
            # Reserve new time slot
            new_slot.current_bookings += 1
            if new_slot.current_bookings >= new_slot.max_bookings:
                new_slot.status = TimeSlotStatus.BOOKED
            
            # Update confirmation deadline
            booking.confirmation_deadline = datetime.now() + timedelta(hours=24)
            booking.is_confirmed_by_agent = False  # Need re-confirmation
            
            # Create new reminders
            # First, mark old reminders as cancelled
            old_reminders = self.db.query(BookingReminder).filter(
                BookingReminder.scheduled_booking_id == booking.id
            ).all()
            
            for reminder in old_reminders:
                reminder.is_sent = True  # Mark as sent to prevent sending
            
            # Create new reminders
            self.create_booking_reminders(booking)
            
            self.db.commit()
            
            logger.info(f"📅 Rescheduled booking {booking_uuid} to {new_slot.slot_date} {new_slot.slot_start_time}")
            
            return {
                "success": True,
                "booking_uuid": booking_uuid,
                "new_scheduled_datetime": booking.scheduled_datetime.isoformat(),
                "reschedule_count": booking.reschedule_count,
                "confirmation_deadline": booking.confirmation_deadline.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error rescheduling booking: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}
    
    def get_pending_reminders(self) -> List[Dict[str, Any]]:
        """
        Get all pending reminders that need to be sent
        """
        try:
            current_time = datetime.now()
            
            pending_reminders = self.db.query(BookingReminder).filter(
                and_(
                    BookingReminder.is_sent == False,
                    BookingReminder.reminder_time <= current_time
                )
            ).all()
            
            reminders_data = []
            for reminder in pending_reminders:
                reminders_data.append({
                    "reminder_id": reminder.id,
                    "reminder_type": reminder.reminder_type,
                    "recipient_type": reminder.recipient_type,
                    "scheduled_booking_id": reminder.scheduled_booking_id
                })
            
            return reminders_data
            
        except Exception as e:
            logger.error(f"Error getting pending reminders: {e}")
            return []
    
    def mark_reminder_sent(self, reminder_id: int):
        """
        Mark reminder as sent
        """
        try:
            reminder = self.db.query(BookingReminder).filter(
                BookingReminder.id == reminder_id
            ).first()
            
            if reminder:
                reminder.is_sent = True
                reminder.sent_at = datetime.now()
                self.db.commit()
                
                logger.info(f"📅 Marked reminder {reminder_id} as sent")
                
        except Exception as e:
            logger.error(f"Error marking reminder as sent: {e}")
            self.db.rollback()