"""
Booking Status Tracking API Routes
Real-time booking status updates and progress monitoring
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, Dict, List, Any
from datetime import datetime
import logging

from .service import BookingStatusService
from .models import BookingStatus

router = APIRouter()
logger = logging.getLogger(__name__)

# Pydantic models for API requests
class StatusUpdateRequest(BaseModel):
    booking_id: str
    new_status: str
    reason: Optional[str] = None
    notes: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    location: Optional[Dict[str, float]] = None  # {latitude: float, longitude: float, eta_minutes: int}

class LocationUpdateRequest(BaseModel):
    booking_id: str
    latitude: float
    longitude: float
    eta_minutes: Optional[int] = None
    status_message: Optional[str] = None

class BookingProgressResponse(BaseModel):
    booking_id: str
    current_status: str
    progress_percentage: int
    status_updated_at: datetime
    estimated_arrival_time: Optional[datetime] = None
    service_started_at: Optional[datetime] = None
    service_completed_at: Optional[datetime] = None
    agent_location: Optional[Dict[str, float]] = None
    agent_status_message: Optional[str] = None

# Dependency to get database session (placeholder)
def get_db():
    # This would return actual database session
    return None

# Dependency for authentication (placeholder)
def get_current_user():
    return {"user_id": 1, "is_agent": True}

@router.post("/update-status")
async def update_booking_status(
    request: StatusUpdateRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Update booking status with comprehensive tracking
    Triggers notifications and progress updates
    """
    try:
        # Validate status
        if request.new_status not in [status.value for status in BookingStatus]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {request.new_status}"
            )
        
        # Initialize service
        status_service = BookingStatusService(db)
        
        # Update status
        result = await status_service.update_booking_status(
            booking_id=request.booking_id,
            new_status=request.new_status,
            changed_by_user_id=current_user["user_id"],
            changed_by_type="agent" if current_user.get("is_agent") else "customer",
            reason=request.reason,
            notes=request.notes,
            metadata=request.metadata,
            location_data=request.location
        )
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result["error"]
            )
        
        logger.info(f"📊 Status updated: {request.booking_id} -> {request.new_status}")
        
        return {
            "success": True,
            "message": f"Booking status updated to {request.new_status}",
            "data": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating booking status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update status: {str(e)}"
        )

@router.post("/update-location")
async def update_agent_location(
    request: LocationUpdateRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Update agent location during active booking
    Provides real-time tracking for customers
    """
    try:
        # Verify user is agent
        if not current_user.get("is_agent"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only agents can update location"
            )
        
        status_service = BookingStatusService(db)
        
        success = await status_service.update_agent_location(
            booking_id=request.booking_id,
            latitude=request.latitude,
            longitude=request.longitude,
            eta_minutes=request.eta_minutes,
            status_message=request.status_message
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to update location or booking not in trackable state"
            )
        
        logger.info(f"📍 Location updated for booking {request.booking_id}")
        
        return {
            "success": True,
            "message": "Agent location updated successfully",
            "booking_id": request.booking_id,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating agent location: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update location: {str(e)}"
        )

@router.get("/progress/{booking_id}", response_model=BookingProgressResponse)
async def get_booking_progress(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Get current booking progress and status
    """
    try:
        status_service = BookingStatusService(db)
        progress = status_service.get_booking_progress(booking_id)
        
        if not progress:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking progress not found"
            )
        
        # Format agent location
        agent_location = None
        if progress.agent_latitude and progress.agent_longitude:
            agent_location = {
                "latitude": progress.agent_latitude,
                "longitude": progress.agent_longitude,
                "updated_at": progress.agent_location_updated_at.isoformat() if progress.agent_location_updated_at else None
            }
        
        return BookingProgressResponse(
            booking_id=progress.booking_id,
            current_status=progress.current_status,
            progress_percentage=progress.progress_percentage,
            status_updated_at=progress.status_updated_at,
            estimated_arrival_time=progress.estimated_arrival_time,
            service_started_at=progress.service_started_at,
            service_completed_at=progress.service_completed_at,
            agent_location=agent_location,
            agent_status_message=progress.agent_status_message
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting booking progress: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get progress: {str(e)}"
        )

@router.get("/history/{booking_id}")
async def get_booking_status_history(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Get complete status history for a booking
    """
    try:
        status_service = BookingStatusService(db)
        history = status_service.get_booking_status_history(booking_id)
        
        history_data = []
        for entry in history:
            history_data.append({
                "status": entry.status,
                "previous_status": entry.previous_status,
                "timestamp": entry.timestamp.isoformat(),
                "changed_by_type": entry.changed_by_type,
                "reason": entry.reason,
                "notes": entry.notes,
                "location": {
                    "latitude": entry.location_latitude,
                    "longitude": entry.location_longitude
                } if entry.location_latitude else None,
                "estimated_arrival_time": entry.estimated_arrival_time.isoformat() if entry.estimated_arrival_time else None
            })
        
        return {
            "booking_id": booking_id,
            "history": history_data,
            "total_changes": len(history_data)
        }
        
    except Exception as e:
        logger.error(f"Error getting booking history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get history: {str(e)}"
        )

@router.get("/agent/{agent_id}/active-bookings")
async def get_agent_active_bookings(
    agent_id: int,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Get all active bookings for an agent
    """
    try:
        # Verify access (agent can only see their own bookings)
        if current_user.get("user_id") != agent_id and not current_user.get("is_admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        status_service = BookingStatusService(db)
        bookings = status_service.get_active_bookings_for_agent(agent_id)
        
        return {
            "agent_id": agent_id,
            "active_bookings": bookings,
            "count": len(bookings)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting agent bookings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get bookings: {str(e)}"
        )

@router.get("/analytics/{booking_id}")
async def get_booking_analytics(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Get comprehensive analytics for a booking
    """
    try:
        status_service = BookingStatusService(db)
        analytics = status_service.get_booking_analytics(booking_id)
        
        if not analytics:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking analytics not found"
            )
        
        return analytics
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting booking analytics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get analytics: {str(e)}"
        )

@router.post("/bulk-status-update")
async def bulk_status_update(
    updates: List[StatusUpdateRequest],
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Update multiple booking statuses in bulk
    Useful for batch operations and system maintenance
    """
    try:
        # Verify admin access for bulk operations
        if not current_user.get("is_admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required for bulk updates"
            )
        
        status_service = BookingStatusService(db)
        results = []
        
        for update_request in updates:
            result = await status_service.update_booking_status(
                booking_id=update_request.booking_id,
                new_status=update_request.new_status,
                changed_by_user_id=current_user["user_id"],
                changed_by_type="admin",
                reason=update_request.reason,
                notes=update_request.notes,
                metadata=update_request.metadata,
                location_data=update_request.location
            )
            
            results.append({
                "booking_id": update_request.booking_id,
                "success": result["success"],
                "error": result.get("error")
            })
        
        successful_updates = len([r for r in results if r["success"]])
        
        return {
            "total_updates": len(updates),
            "successful_updates": successful_updates,
            "failed_updates": len(updates) - successful_updates,
            "results": results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in bulk status update: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Bulk update failed: {str(e)}"
        )