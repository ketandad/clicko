"""
WebSocket routes for real-time notifications
Handles agent connections and bell notifications
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from fastapi.security import HTTPBearer
import json
import logging
from typing import Optional

from .websocket_manager import notification_manager, start_notification_cleanup
# Note: get_current_user would come from auth module
# For now, we'll use a simple auth dependency
def get_current_user():
    return {"user_id": 1, "is_admin": True}

router = APIRouter()
security = HTTPBearer()
logger = logging.getLogger(__name__)

# Note: Notification cleanup will be started by the main app

@router.websocket("/ws/agent/{agent_id}")
async def agent_websocket_endpoint(websocket: WebSocket, agent_id: int):
    """
    WebSocket endpoint for agents to receive real-time notifications
    Agents connect here to get bell notifications for booking requests
    """
    try:
        await notification_manager.connect_agent(websocket, agent_id)
        
        while True:
            try:
                # Listen for incoming messages from agent
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Handle different message types from agent
                if message.get("type") == "response":
                    # Agent responding to a notification
                    notification_id = message.get("notification_id")
                    response = message.get("response")  # "accepted" or "rejected"
                    response_data = message.get("data", {})
                    
                    if notification_id and response in ["accepted", "rejected"]:
                        result = await notification_manager.handle_agent_response(
                            agent_id, notification_id, response, response_data
                        )
                        
                        if not result["success"]:
                            await websocket.send_text(json.dumps({
                                "type": "error",
                                "message": result["error"]
                            }))
                
                elif message.get("type") == "ping":
                    # Heartbeat ping from agent
                    await websocket.send_text(json.dumps({"type": "pong"}))
                
                elif message.get("type") == "status_update":
                    # Agent updating their status
                    agent_status = message.get("status")  # "online", "offline", "busy"
                    logger.info(f"Agent {agent_id} status update: {agent_status}")
                    
            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON format"
                }))
            except Exception as e:
                logger.error(f"WebSocket message error for agent {agent_id}: {e}")
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Message processing error"
                }))
                
    except WebSocketDisconnect:
        logger.info(f"Agent {agent_id} disconnected")
    except Exception as e:
        logger.error(f"WebSocket error for agent {agent_id}: {e}")
    finally:
        await notification_manager.disconnect_agent(websocket, agent_id)

@router.post("/send-booking-notification")
async def send_booking_notification(
    booking_request: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Send bell notification to agent for new booking request
    Called when customer creates a booking
    """
    try:
        agent_id = booking_request.get("agent_id")
        booking_id = booking_request.get("booking_id")
        
        if not agent_id or not booking_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="agent_id and booking_id are required"
            )
        
        # Prepare notification data
        notification_data = {
            "booking_id": booking_id,
            "customer_name": booking_request.get("customer_name"),
            "customer_phone": booking_request.get("customer_phone"),
            "service_type": booking_request.get("service_type"),
            "service_details": booking_request.get("service_details"),
            "location": booking_request.get("location"),
            "address": booking_request.get("address"),
            "scheduled_time": booking_request.get("scheduled_time"),
            "estimated_cost": booking_request.get("estimated_cost"),
            "visit_charges": booking_request.get("visit_charges"),
            "service_charges": booking_request.get("service_charges"),
            "emergency": booking_request.get("emergency", False),
            "customer_notes": booking_request.get("customer_notes")
        }
        
        # Send bell notification
        notification_id = await notification_manager.send_bell_notification(
            agent_id, notification_data
        )
        
        logger.info(f"🔔 Booking notification sent to agent {agent_id}")
        
        return {
            "success": True,
            "notification_id": notification_id,
            "message": f"Bell notification sent to agent {agent_id}",
            "timeout_seconds": 30
        }
        
    except Exception as e:
        logger.error(f"Error sending booking notification: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send notification: {str(e)}"
        )

@router.get("/agent/{agent_id}/connection-status")
async def get_agent_connection_status(
    agent_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get agent's WebSocket connection status"""
    try:
        status_info = notification_manager.get_agent_connection_status(agent_id)
        pending_count = notification_manager.get_pending_notifications_count(agent_id)
        
        return {
            "agent_id": agent_id,
            "is_connected": status_info["is_connected"],
            "connection_count": status_info["connection_count"],
            "pending_notifications": pending_count,
            "last_seen": status_info["last_seen"]
        }
        
    except Exception as e:
        logger.error(f"Error getting agent connection status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get connection status"
        )

@router.post("/broadcast-system-message")
async def broadcast_system_message(
    message_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Broadcast system message to agents
    Admin only functionality
    """
    try:
        # Check if user is admin (implement proper admin check)
        if not current_user.get("is_admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        
        message = message_data.get("message")
        agent_ids = message_data.get("agent_ids")  # Optional: specific agents
        
        if not message:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Message is required"
            )
        
        await notification_manager.broadcast_system_message(message, agent_ids)
        
        return {
            "success": True,
            "message": "System message broadcast successfully",
            "target_agents": agent_ids or "all_connected_agents"
        }
        
    except Exception as e:
        logger.error(f"Error broadcasting system message: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to broadcast message"
        )

@router.post("/send-status-update")
async def send_booking_status_update(
    status_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Send booking status update to relevant parties"""
    try:
        booking_id = status_data.get("booking_id")
        status = status_data.get("status")
        agent_id = status_data.get("agent_id")
        customer_id = status_data.get("customer_id")
        
        if not booking_id or not status:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="booking_id and status are required"
            )
        
        await notification_manager.send_status_update(
            booking_id, status, agent_id, customer_id
        )
        
        return {
            "success": True,
            "message": f"Status update sent: {status}",
            "booking_id": booking_id
        }
        
    except Exception as e:
        logger.error(f"Error sending status update: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send status update"
        )

@router.get("/debug/pending-notifications")
async def debug_pending_notifications(
    current_user: dict = Depends(get_current_user)
):
    """Debug endpoint to view pending notifications"""
    try:
        # Check if user is admin
        if not current_user.get("is_admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        
        return {
            "pending_notifications": list(notification_manager.pending_notifications.values()),
            "active_connections": {
                agent_id: len(connections) 
                for agent_id, connections in notification_manager.agent_connections.items()
            },
            "timeout_tasks": len(notification_manager.timeout_tasks)
        }
        
    except Exception as e:
        logger.error(f"Error in debug endpoint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Debug endpoint error"
        )