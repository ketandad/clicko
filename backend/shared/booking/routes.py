"""
Booking API Routes
FastAPI endpoints for service booking system with real-time notifications
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal

from ..booking.models import BookingModel
from ..auth.jwt import get_current_user

router = APIRouter(prefix="/api/bookings", tags=["bookings"])

# Helper function to safely get user ID
def get_user_id(user):
    """Safely extract user ID from user object or dict"""
    if hasattr(user, 'id'):
        return user.id
    elif isinstance(user, dict) and 'id' in user:
        return user['id']
    else:
        raise ValueError(f"Cannot extract user ID from: {type(user)}")

# Pydantic Models for API
class BookingCreateRequest(BaseModel):
    agent_id: int
    service_category: str
    service_subcategory: Optional[str] = None
    service_description: Optional[str] = None
    
    # Location Information
    service_latitude: float = Field(..., ge=-90, le=90)
    service_longitude: float = Field(..., ge=-180, le=180)
    service_address: str
    service_landmark: Optional[str] = None
    service_city: str
    service_state: str
    service_pincode: str
    
    # Pricing
    visit_charge: Decimal = Field(default=0, ge=0)
    service_charge: Decimal = Field(default=0, ge=0)
    total_amount: Decimal = Field(..., gt=0)
    
    # Scheduling
    requested_date: Optional[date] = None
    requested_time_slot: Optional[str] = None
    
    # Additional Info
    special_instructions: Optional[str] = None
    is_emergency: bool = False

class BookingStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(accepted|rejected|cancelled|agent_en_route|service_started|service_completed|completed)$")
    reason: Optional[str] = None
    location_latitude: Optional[float] = Field(None, ge=-90, le=90)
    location_longitude: Optional[float] = Field(None, ge=-180, le=180)

class AgentLocationUpdate(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    accuracy: Optional[float] = None
    speed: Optional[float] = None
    heading: Optional[float] = None
    altitude: Optional[float] = None
    battery_level: Optional[int] = Field(None, ge=0, le=100)
    network_type: Optional[str] = None

class BookingResponse(BaseModel):
    booking_uuid: str
    user_id: int
    agent_id: int
    service_category: str
    service_subcategory: Optional[str]
    service_address: str
    total_amount: Decimal
    booking_status: str
    created_at: datetime
    agent_response_timeout: Optional[datetime]

# Initialize booking model
booking_model = BookingModel()

@router.post("/create")
async def create_booking(
    booking_data: BookingCreateRequest,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user)
):
    """
    Create a new service booking with immediate agent notification
    """
    import logging
    logger = logging.getLogger(__name__)
    
    booking_model = BookingModel()
    
    try:
        logger.info(f"🚀 [BOOKING-START] New booking request initiated")
        logger.info(f"📋 [BOOKING-DATA] Service: {booking_data.service_category}, Agent: {booking_data.agent_id}, Amount: ₹{booking_data.total_amount}")
        logger.info(f"📍 [BOOKING-LOCATION] Address: {booking_data.service_address}, City: {booking_data.service_city}")
        logger.info(f"👤 [BOOKING-USER] Authenticated user: {getattr(current_user, 'name', 'Unknown')} (ID: {getattr(current_user, 'id', 'Unknown')})")
        
        # Add user_id from authenticated user
        booking_dict = booking_data.dict()
        user_id = get_user_id(current_user)
        booking_dict['user_id'] = user_id
        logger.info(f"✅ [BOOKING-AUTH] User ID {user_id} added to booking payload")
        
        # Check if agent is actually available (online AND connected to WebSocket)
        logger.info(f"🔍 [BOOKING-VALIDATION] Checking agent {booking_dict['agent_id']} availability...")
        from ..notifications.websocket_manager import notification_manager
        agent_available = await notification_manager.is_agent_online(booking_dict['agent_id'])
        
        if not agent_available:
            logger.warning(f"❌ [BOOKING-REJECTED] Agent {booking_dict['agent_id']} is not available (offline or disconnected)")
            raise HTTPException(
                status_code=409,  # Conflict
                detail="Agent is currently unavailable. Please try another agent or try again later."
            )
        logger.info(f"✅ [BOOKING-VALIDATED] Agent {booking_dict['agent_id']} confirmed online and ready to receive notifications")
            
        # Create booking in database
        logger.info(f"💾 [BOOKING-DB] Creating booking record in database...")
        try:
            booking_uuid = booking_model.create_booking(booking_dict)
            logger.info(f"✅ [BOOKING-DB] Booking created successfully with UUID: {booking_uuid}")
        except Exception as model_err:
            logger.error(f"❌ [BOOKING-DB] Database error during booking creation: {str(model_err)}")
            logger.error(f"🔍 [BOOKING-DB] Booking data that failed: {booking_dict}")
            raise HTTPException(status_code=500, detail=f"Booking creation failed: {str(model_err)}")
            
        if not booking_uuid:
            logger.error("❌ [BOOKING-DB] Booking UUID not returned, creation failed silently")
            raise HTTPException(status_code=400, detail="Failed to create booking - no UUID returned")
        
        # Send real-time bell notification to agent
        logger.info(f"🔔 [BOOKING-NOTIFY] Preparing notification for agent {booking_dict['agent_id']}...")
        try:
            from ..notifications.websocket_manager import notification_manager
            
            # Safely extract user name from current_user
            user_name = "Unknown Customer"
            if hasattr(current_user, 'name'):
                user_name = current_user.name
            elif isinstance(current_user, dict) and 'name' in current_user:
                user_name = current_user['name']
            
            logger.info(f"👤 [BOOKING-NOTIFY] Customer name: {user_name}")
            
            notification_data = {
                "booking_uuid": booking_uuid,
                "booking_id": booking_dict.get('booking_id'),
                "user_name": user_name,
                "service_category": booking_dict['service_category'],
                "service_address": booking_dict['service_address'],
                "total_amount": float(booking_dict['total_amount']),
                "is_emergency": booking_dict.get('is_emergency', False)
            }
            
            logger.info(f"📦 [BOOKING-NOTIFY] Notification payload: {notification_data}")
            
            # Send bell notification via WebSocket
            background_tasks.add_task(
                notification_manager.send_bell_notification,
                booking_dict['agent_id'],
                notification_data
            )
            logger.info(f"🔔 [BOOKING-NOTIFY] Bell notification queued for agent {booking_dict['agent_id']} - will ring for 2 minutes")
        except Exception as notification_err:
            # Don't fail the booking if notification fails
            logger.error(f"⚠️ [BOOKING-NOTIFY] Failed to send bell notification: {str(notification_err)}")
            logger.error(f"🔍 [BOOKING-NOTIFY] Notification data that failed: {notification_data if 'notification_data' in locals() else 'Not created'}")
        
        logger.info(f"🎉 [BOOKING-SUCCESS] Booking flow completed successfully!")
        logger.info(f"📋 [BOOKING-SUMMARY] UUID: {booking_uuid}, Agent: {booking_dict['agent_id']}, Customer: {user_name}, Amount: ₹{booking_dict['total_amount']}")
        
        return {
            "success": True,
            "message": "Booking request sent to agent. Bell will ring for 2 minutes...",
            "booking_uuid": booking_uuid,
            "status": "pending", 
            "agent_timeout": "2 minutes"
        }
    except HTTPException:
        # Re-raise HTTP exceptions (409, 400, etc.) without modification
        raise
    except Exception as e:
        logger.error(f"💥 [BOOKING-ERROR] Unexpected error in booking flow: {str(e)}")
        logger.error(f"🔍 [BOOKING-ERROR] Error type: {type(e).__name__}")
        logger.error(f"📋 [BOOKING-ERROR] Booking data when error occurred: {booking_dict if 'booking_dict' in locals() else 'Not available'}")
        raise HTTPException(status_code=500, detail=f"Failed to create booking: {str(e)}")

@router.put("/{booking_uuid}/status")
async def update_booking_status(
    booking_uuid: str,
    status_update: BookingStatusUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Update booking status (accept/reject by agent, cancel by customer, etc.)
    """
    try:
        # Determine role based on user type or booking ownership
        changed_by_role = "agent" if current_user.get('user_type') == 'agent' else "customer"
        
        location_data = None
        if status_update.location_latitude and status_update.location_longitude:
            location_data = {
                'latitude': status_update.location_latitude,
                'longitude': status_update.location_longitude
            }
        
        success = booking_model.update_booking_status(
            booking_uuid=booking_uuid,
            new_status=status_update.status,
            changed_by_user_id=get_user_id(current_user),
            changed_by_role=changed_by_role,
            reason=status_update.reason,
            location_data=location_data
        )
        
        if not success:
            raise HTTPException(status_code=400, detail="Failed to update booking status")
        
        return {
            "success": True,
            "message": f"Booking status updated to {status_update.status}",
            "booking_uuid": booking_uuid
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update status: {str(e)}")

@router.get("/agent/notifications")
async def get_agent_notifications(
    current_user: dict = Depends(get_current_user),
    include_expired: bool = False
):
    """
    Get pending notifications for agent (for bell notifications)
    """
    try:
        if current_user.get('user_type') != 'agent':
            raise HTTPException(status_code=403, detail="Only agents can access notifications")
        
        agent_id = get_user_id(current_user)
        notifications = booking_model.get_pending_agent_notifications(
            agent_id=agent_id, 
            timeout_check=not include_expired
        )
        
        return {
            "success": True,
            "notifications": notifications,
            "count": len(notifications)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get notifications: {str(e)}")

@router.post("/{booking_uuid}/agent-location")
async def update_agent_location(
    booking_uuid: str,
    location_update: AgentLocationUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Update agent location during active booking (for customer tracking)
    """
    try:
        if current_user.get('user_type') != 'agent':
            raise HTTPException(status_code=403, detail="Only agents can update location")
        
        # Get booking_id from uuid (simplified - should validate agent owns booking)
        import sqlite3
        conn = sqlite3.connect(booking_model.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, agent_id FROM bookings 
            WHERE booking_uuid = ? AND booking_status IN ('accepted', 'agent_en_route', 'service_started')
        """, (booking_uuid,))
        
        result = cursor.fetchone()
        conn.close()
        
        if not result:
            raise HTTPException(status_code=404, detail="Active booking not found")
        
        booking_id, agent_id = result
        
        if agent_id != get_user_id(current_user):
            raise HTTPException(status_code=403, detail="Not authorized for this booking")
        
        success = booking_model.add_agent_location_update(
            booking_id=booking_id,
            agent_id=agent_id,
            location_data=location_update.dict()
        )
        
        if not success:
            raise HTTPException(status_code=400, detail="Failed to update location")
        
        return {
            "success": True,
            "message": "Location updated successfully",
            "timestamp": datetime.now()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update location: {str(e)}")

@router.get("/user/history")
async def get_user_booking_history(
    current_user: dict = Depends(get_current_user),
    status_filter: Optional[str] = None,
    limit: int = 20,
    offset: int = 0
):
    """
    Get user's booking history with optional status filtering
    """
    try:
        import sqlite3
        conn = sqlite3.connect(booking_model.db_path)
        cursor = conn.cursor()
        
        where_conditions = ["user_id = ?"]
        params = [get_user_id(current_user)]
        
        if status_filter:
            where_conditions.append("booking_status = ?")
            params.append(status_filter)
        
        cursor.execute(f"""
            SELECT booking_uuid, agent_id, service_category, service_address,
                   total_amount, booking_status, created_at, completed_at
            FROM bookings
            WHERE {' AND '.join(where_conditions)}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        """, params + [limit, offset])
        
        columns = [description[0] for description in cursor.description]
        bookings = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        conn.close()
        
        return {
            "success": True,
            "bookings": bookings,
            "count": len(bookings)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get booking history: {str(e)}")

@router.get("/agent/bookings")
async def get_agent_bookings(
    current_user: dict = Depends(get_current_user),
    status_filter: Optional[str] = None,
    limit: int = 20,
    offset: int = 0
):
    """
    Get agent's bookings with optional status filtering
    """
    try:
        if current_user.get('user_type') != 'agent':
            raise HTTPException(status_code=403, detail="Only agents can access this endpoint")
        
        import sqlite3
        conn = sqlite3.connect(booking_model.db_path)
        cursor = conn.cursor()
        
        where_conditions = ["agent_id = ?"]
        params = [get_user_id(current_user)]
        
        if status_filter:
            where_conditions.append("booking_status = ?")
            params.append(status_filter)
        
        cursor.execute(f"""
            SELECT booking_uuid, user_id, service_category, service_address,
                   total_amount, booking_status, created_at, scheduled_datetime,
                   agent_notified_at, agent_responded_at
            FROM bookings
            WHERE {' AND '.join(where_conditions)}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        """, params + [limit, offset])
        
        columns = [description[0] for description in cursor.description]
        bookings = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        conn.close()
        
        return {
            "success": True,
            "bookings": bookings,
            "count": len(bookings)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get agent bookings: {str(e)}")


@router.post("/system/handle-timeouts")
async def handle_notification_timeouts():
    """
    System endpoint to handle expired agent notifications
    Should be called periodically by background job
    """
    try:
        timeout_count = booking_model.handle_notification_timeout()
        
        return {
            "success": True,
            "message": f"Processed {timeout_count} expired notifications",
            "timeout_count": timeout_count
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to handle timeouts: {str(e)}")

@router.get("/{booking_uuid}/details")
async def get_booking_details(
    booking_uuid: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get detailed booking information
    """
    try:
        import sqlite3
        conn = sqlite3.connect(booking_model.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT b.*, 
                   (SELECT json_group_array(
                       json_object('status', new_status, 'timestamp', created_at, 'reason', reason)
                   ) FROM booking_status_history WHERE booking_id = b.id) as status_history
            FROM bookings b
            WHERE b.booking_uuid = ?
        """, (booking_uuid,))
        
        result = cursor.fetchone()
        conn.close()
        
        if not result:
            raise HTTPException(status_code=404, detail="Booking not found")
        
        # Verify user access (either customer who created or assigned agent)
        columns = [description[0] for description in cursor.description]
        booking = dict(zip(columns, result))
        
        user_id = get_user_id(current_user)
        if (booking['user_id'] != user_id and 
            booking['agent_id'] != user_id):
            raise HTTPException(status_code=403, detail="Not authorized to view this booking")
        
        return {
            "success": True,
            "booking": booking
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get booking details: {str(e)}")