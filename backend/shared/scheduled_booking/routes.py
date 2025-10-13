"""
Scheduled Booking API Routes
FastAPI endpoints for scheduled bookings and agent calendar management
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Query
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
from datetime import datetime, date, time
import logging

from ..database import get_db
from sqlalchemy.orm import Session
from .service import ScheduledBookingService
from .models import ScheduleRecurrence, TimeSlotStatus

router = APIRouter(prefix="/scheduled-bookings", tags=["scheduled-bookings"])
logger = logging.getLogger(__name__)

# Pydantic Models
class AgentScheduleCreate(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6, description="0=Monday, 6=Sunday")
    start_time: time
    end_time: time
    slot_duration_minutes: int = Field(default=60, ge=15, le=240)
    break_duration_minutes: int = Field(default=15, ge=0, le=60)
    max_bookings_per_slot: int = Field(default=3, ge=1, le=10)
    is_active: bool = Field(default=True)
    recurrence: Optional[ScheduleRecurrence] = None

class ScheduledBookingCreate(BaseModel):
    booking_id: int
    agent_id: int
    customer_id: int
    time_slot_id: int
    duration_minutes: int = Field(default=60, ge=15, le=480)
    customer_notes: Optional[str] = None
    special_instructions: Optional[str] = None
    rate: float = Field(..., gt=0)
    total_amount: float = Field(..., gt=0)

class BookingReschedule(BaseModel):
    new_time_slot_id: int
    reason: Optional[str] = None

class TimeSlotFilter(BaseModel):
    start_date: date
    end_date: date
    include_emergency_slots: bool = Field(default=False)

# API Routes
@router.post("/agent/{agent_id}/schedule")
async def create_agent_schedule(
    agent_id: int,
    schedule_data: AgentScheduleCreate,
    db: Session = Depends(get_db)
):
    """
    Create or update agent's working schedule for a specific day
    """
    try:
        service = ScheduledBookingService(db)
        
        # Convert Pydantic model to dict
        schedule_dict = schedule_data.dict()
        
        # Validate time range
        if schedule_dict['start_time'] >= schedule_dict['end_time']:
            raise HTTPException(
                status_code=400,
                detail="Start time must be before end time"
            )
        
        schedule = service.create_agent_schedule(agent_id, schedule_dict)
        
        return {
            "success": True,
            "message": f"Schedule created/updated for agent {agent_id}",
            "schedule": {
                "id": schedule.id,
                "day_of_week": schedule.day_of_week,
                "start_time": schedule.start_time.strftime("%H:%M"),
                "end_time": schedule.end_time.strftime("%H:%M"),
                "slot_duration_minutes": schedule.slot_duration_minutes,
                "is_active": schedule.is_active
            }
        }
        
    except Exception as e:
        logger.error(f"Error creating agent schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/agent/{agent_id}/available-slots")
async def get_available_slots(
    agent_id: int,
    start_date: date = Query(...),
    end_date: date = Query(...),
    db: Session = Depends(get_db)
):
    """
    Get available time slots for an agent within date range
    """
    try:
        service = ScheduledBookingService(db)
        
        # Validate date range
        if start_date > end_date:
            raise HTTPException(
                status_code=400,
                detail="Start date must be before or equal to end date"
            )
        
        # Limit date range to prevent excessive queries
        if (end_date - start_date).days > 60:
            raise HTTPException(
                status_code=400,
                detail="Date range cannot exceed 60 days"
            )
        
        available_slots = service.get_available_slots(agent_id, start_date, end_date)
        
        return {
            "success": True,
            "agent_id": agent_id,
            "date_range": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "available_slots": available_slots,
            "total_slots": len(available_slots)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting available slots: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/create")
async def create_scheduled_booking(
    booking_data: ScheduledBookingCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Create a new scheduled booking for future date/time
    """
    try:
        service = ScheduledBookingService(db)
        
        # Convert Pydantic model to dict
        booking_dict = booking_data.dict()
        
        result = service.create_scheduled_booking(booking_dict)
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        # TODO: Add background task for notification sending
        # background_tasks.add_task(send_booking_notifications, result["scheduled_booking_uuid"])
        
        return {
            "success": True,
            "message": "Scheduled booking created successfully",
            "booking_uuid": result["scheduled_booking_uuid"],
            "scheduled_datetime": result["scheduled_datetime"],
            "confirmation_deadline": result["confirmation_deadline"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating scheduled booking: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/agent/{agent_id}/calendar")
async def get_agent_calendar(
    agent_id: int,
    start_date: date = Query(...),
    end_date: date = Query(...),
    db: Session = Depends(get_db)
):
    """
    Get agent's calendar with scheduled bookings (Teams-like interface)
    """
    try:
        service = ScheduledBookingService(db)
        
        # Validate date range
        if start_date > end_date:
            raise HTTPException(
                status_code=400,
                detail="Start date must be before or equal to end date"
            )
        
        if (end_date - start_date).days > 90:
            raise HTTPException(
                status_code=400,
                detail="Date range cannot exceed 90 days"
            )
        
        calendar_data = service.get_agent_calendar(agent_id, start_date, end_date)
        
        if "error" in calendar_data:
            raise HTTPException(status_code=500, detail=calendar_data["error"])
        
        return {
            "success": True,
            "calendar": calendar_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting agent calendar: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/booking/{booking_uuid}/confirm")
async def confirm_scheduled_booking(
    booking_uuid: str,
    agent_id: int,
    db: Session = Depends(get_db)
):
    """
    Agent confirms acceptance of scheduled booking
    """
    try:
        service = ScheduledBookingService(db)
        
        result = service.confirm_scheduled_booking(booking_uuid, agent_id)
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return {
            "success": True,
            "message": "Booking confirmed successfully",
            "booking_uuid": result["booking_uuid"],
            "confirmed_at": result["confirmed_at"],
            "scheduled_datetime": result["scheduled_datetime"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error confirming booking: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/booking/{booking_uuid}/reschedule")
async def reschedule_booking(
    booking_uuid: str,
    reschedule_data: BookingReschedule,
    db: Session = Depends(get_db)
):
    """
    Reschedule booking to a different time slot
    """
    try:
        service = ScheduledBookingService(db)
        
        result = service.reschedule_booking(
            booking_uuid, 
            reschedule_data.new_time_slot_id, 
            reschedule_data.reason
        )
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return {
            "success": True,
            "message": "Booking rescheduled successfully",
            "booking_uuid": result["booking_uuid"],
            "new_scheduled_datetime": result["new_scheduled_datetime"],
            "reschedule_count": result["reschedule_count"],
            "confirmation_deadline": result["confirmation_deadline"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rescheduling booking: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/agent/{agent_id}/schedule")
async def get_agent_schedule(
    agent_id: int,
    db: Session = Depends(get_db)
):
    """
    Get agent's current working schedule for all days
    """
    try:
        from .models import AgentSchedule
        
        schedules = db.query(AgentSchedule).filter(
            AgentSchedule.agent_id == agent_id
        ).order_by(AgentSchedule.day_of_week).all()
        
        schedule_data = []
        for schedule in schedules:
            schedule_data.append({
                "id": schedule.id,
                "day_of_week": schedule.day_of_week,
                "day_name": [
                    "Monday", "Tuesday", "Wednesday", "Thursday", 
                    "Friday", "Saturday", "Sunday"
                ][schedule.day_of_week],
                "start_time": schedule.start_time.strftime("%H:%M"),
                "end_time": schedule.end_time.strftime("%H:%M"),
                "slot_duration_minutes": schedule.slot_duration_minutes,
                "break_duration_minutes": schedule.break_duration_minutes,
                "max_bookings_per_slot": schedule.max_bookings_per_slot,
                "is_active": schedule.is_active,
                "recurrence": schedule.recurrence
            })
        
        return {
            "success": True,
            "agent_id": agent_id,
            "schedules": schedule_data,
            "total_working_days": len([s for s in schedule_data if s["is_active"]])
        }
        
    except Exception as e:
        logger.error(f"Error getting agent schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/agent/{agent_id}/schedule/{day_of_week}")
async def delete_agent_schedule(
    agent_id: int,
    day_of_week: int,
    db: Session = Depends(get_db)
):
    """
    Delete agent's schedule for a specific day
    """
    try:
        from .models import AgentSchedule
        
        if not 0 <= day_of_week <= 6:
            raise HTTPException(
                status_code=400,
                detail="day_of_week must be between 0 (Monday) and 6 (Sunday)"
            )
        
        schedule = db.query(AgentSchedule).filter(
            AgentSchedule.agent_id == agent_id,
            AgentSchedule.day_of_week == day_of_week
        ).first()
        
        if not schedule:
            raise HTTPException(
                status_code=404,
                detail=f"No schedule found for agent {agent_id} on day {day_of_week}"
            )
        
        # Mark as inactive instead of deleting to preserve historical data
        schedule.is_active = False
        db.commit()
        
        return {
            "success": True,
            "message": f"Schedule for day {day_of_week} deactivated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting agent schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/reminders/pending")
async def get_pending_reminders(db: Session = Depends(get_db)):
    """
    Get all pending reminders that need to be sent
    Internal API for reminder system
    """
    try:
        service = ScheduledBookingService(db)
        
        pending_reminders = service.get_pending_reminders()
        
        return {
            "success": True,
            "pending_reminders": pending_reminders,
            "total_count": len(pending_reminders)
        }
        
    except Exception as e:
        logger.error(f"Error getting pending reminders: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reminders/{reminder_id}/mark-sent")
async def mark_reminder_sent(
    reminder_id: int,
    db: Session = Depends(get_db)
):
    """
    Mark reminder as sent
    Internal API for reminder system
    """
    try:
        service = ScheduledBookingService(db)
        service.mark_reminder_sent(reminder_id)
        
        return {
            "success": True,
            "message": "Reminder marked as sent"
        }
        
    except Exception as e:
        logger.error(f"Error marking reminder as sent: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Additional utility endpoints
@router.get("/agent/{agent_id}/stats")
async def get_agent_booking_stats(
    agent_id: int,
    start_date: date = Query(...),
    end_date: date = Query(...),
    db: Session = Depends(get_db)
):
    """
    Get agent's booking statistics for a date range
    """
    try:
        from .models import ScheduledBooking, AgentTimeSlot
        from sqlalchemy import and_, func
        
        # Get booking stats
        booking_stats = db.query(
            func.count(ScheduledBooking.id).label("total_bookings"),
            func.sum(ScheduledBooking.total_scheduled_amount).label("total_earnings"),
            func.count(
                func.case([(ScheduledBooking.is_confirmed_by_agent == True, 1)])
            ).label("confirmed_bookings"),
            func.count(
                func.case([(ScheduledBooking.is_cancelled == True, 1)])
            ).label("cancelled_bookings")
        ).filter(
            and_(
                ScheduledBooking.agent_id == agent_id,
                ScheduledBooking.scheduled_date >= start_date,
                ScheduledBooking.scheduled_date <= end_date
            )
        ).first()
        
        # Get available slots count
        available_slots_count = db.query(func.count(AgentTimeSlot.id)).filter(
            and_(
                AgentTimeSlot.agent_id == agent_id,
                AgentTimeSlot.slot_date >= start_date,
                AgentTimeSlot.slot_date <= end_date,
                AgentTimeSlot.status == TimeSlotStatus.AVAILABLE
            )
        ).scalar()
        
        return {
            "success": True,
            "agent_id": agent_id,
            "date_range": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "stats": {
                "total_bookings": booking_stats.total_bookings or 0,
                "confirmed_bookings": booking_stats.confirmed_bookings or 0,
                "cancelled_bookings": booking_stats.cancelled_bookings or 0,
                "pending_confirmations": (booking_stats.total_bookings or 0) - (booking_stats.confirmed_bookings or 0),
                "total_scheduled_earnings": float(booking_stats.total_earnings or 0),
                "available_slots": available_slots_count or 0,
                "booking_rate": round(
                    ((booking_stats.total_bookings or 0) / max(1, (booking_stats.total_bookings or 0) + (available_slots_count or 0))) * 100,
                    2
                )
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting agent booking stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))