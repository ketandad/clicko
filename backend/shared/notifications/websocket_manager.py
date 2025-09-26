"""
Real-time Notification System using WebSockets
Handles agent bell notifications that ring until accept/reject
"""

from fastapi import WebSocket, WebSocketDisconnect, BackgroundTasks
from typing import Dict, List, Optional
import json
import asyncio
import time
from datetime import datetime, timedelta
import uuid
import logging

# Configure logging
logger = logging.getLogger(__name__)

class NotificationManager:
    def __init__(self):
        # Active WebSocket connections by agent_id
        self.agent_connections: Dict[int, List[WebSocket]] = {}
        
        # Active notifications awaiting response
        self.pending_notifications: Dict[str, dict] = {}
        
        # Background tasks for timeout handling
        self.timeout_tasks: Dict[str, asyncio.Task] = {}

    async def connect_agent(self, websocket: WebSocket, agent_id: int):
        """Connect an agent to the WebSocket for real-time notifications"""
        await websocket.accept()
        
        if agent_id not in self.agent_connections:
            self.agent_connections[agent_id] = []
        
        self.agent_connections[agent_id].append(websocket)
        logger.info(f"🔔 Agent {agent_id} connected to notifications")
        
        # Send any pending notifications for this agent
        await self.send_pending_notifications(agent_id)

    async def disconnect_agent(self, websocket: WebSocket, agent_id: int):
        """Disconnect an agent from WebSocket"""
        if agent_id in self.agent_connections:
            if websocket in self.agent_connections[agent_id]:
                self.agent_connections[agent_id].remove(websocket)
            
            # Clean up empty connections list
            if not self.agent_connections[agent_id]:
                del self.agent_connections[agent_id]
        
        logger.info(f"🔌 Agent {agent_id} disconnected from notifications")

    async def send_bell_notification(self, agent_id: int, notification_data: dict):
        """
        Send bell notification to agent that rings until accept/reject
        Returns notification_id for tracking
        """
        notification_id = str(uuid.uuid4())
        
        # Prepare notification with timeout
        notification = {
            "id": notification_id,
            "type": "booking_request",
            "agent_id": agent_id,
            "data": notification_data,
            "created_at": datetime.now().isoformat(),
            "timeout_at": (datetime.now() + timedelta(seconds=30)).isoformat(),
            "requires_response": True,
            "sound_type": "bell_continuous", # Bell sound that rings continuously
            "priority": "critical"
        }
        
        # Store pending notification
        self.pending_notifications[notification_id] = notification
        
        # Send to agent if connected
        if agent_id in self.agent_connections:
            message = json.dumps({
                "type": "bell_notification",
                "notification": notification
            })
            
            # Send to all agent connections (multiple devices)
            for websocket in self.agent_connections[agent_id]:
                try:
                    await websocket.send_text(message)
                    logger.info(f"🔔 Bell notification sent to agent {agent_id}")
                except Exception as e:
                    logger.error(f"Failed to send notification to agent {agent_id}: {e}")
        
        # Set timeout handler
        timeout_task = asyncio.create_task(
            self.handle_notification_timeout(notification_id, agent_id)
        )
        self.timeout_tasks[notification_id] = timeout_task
        
        return notification_id

    async def handle_agent_response(self, agent_id: int, notification_id: str, response: str, response_data: dict = None):
        """
        Handle agent response (accept/reject) to notification
        """
        if notification_id not in self.pending_notifications:
            return {"success": False, "error": "Notification not found"}
        
        notification = self.pending_notifications[notification_id]
        
        # Validate agent
        if notification["agent_id"] != agent_id:
            return {"success": False, "error": "Unauthorized response"}
        
        # Cancel timeout task
        if notification_id in self.timeout_tasks:
            self.timeout_tasks[notification_id].cancel()
            del self.timeout_tasks[notification_id]
        
        # Update notification with response
        notification["response"] = response
        notification["response_data"] = response_data
        notification["responded_at"] = datetime.now().isoformat()
        
        # Remove from pending
        del self.pending_notifications[notification_id]
        
        # Send confirmation back to agent
        if agent_id in self.agent_connections:
            confirmation = {
                "type": "response_confirmed",
                "notification_id": notification_id,
                "response": response,
                "message": f"Booking {response} successfully"
            }
            
            for websocket in self.agent_connections[agent_id]:
                try:
                    await websocket.send_text(json.dumps(confirmation))
                except Exception:
                    pass
        
        logger.info(f"🎯 Agent {agent_id} {response} notification {notification_id}")
        
        return {
            "success": True,
            "notification_id": notification_id,
            "response": response,
            "booking_id": notification["data"].get("booking_id")
        }

    async def handle_notification_timeout(self, notification_id: str, agent_id: int):
        """
        Handle notification timeout (30 seconds) - auto-reject booking
        """
        try:
            await asyncio.sleep(30)  # Wait for 30 seconds
            
            if notification_id in self.pending_notifications:
                notification = self.pending_notifications[notification_id]
                
                # Auto-reject the booking
                await self.handle_agent_response(
                    agent_id, 
                    notification_id, 
                    "rejected", 
                    {"reason": "Agent did not respond within timeout period", "auto_rejected": True}
                )
                
                # Send timeout notification to agent
                if agent_id in self.agent_connections:
                    timeout_message = {
                        "type": "notification_timeout",
                        "notification_id": notification_id,
                        "message": "Booking request timed out and was auto-rejected"
                    }
                    
                    for websocket in self.agent_connections[agent_id]:
                        try:
                            await websocket.send_text(json.dumps(timeout_message))
                        except Exception:
                            pass
                
                logger.warning(f"⏰ Notification {notification_id} timed out for agent {agent_id}")
        
        except asyncio.CancelledError:
            # Timeout was cancelled (agent responded)
            pass

    async def send_pending_notifications(self, agent_id: int):
        """Send any pending notifications when agent reconnects"""
        for notification_id, notification in self.pending_notifications.items():
            if notification["agent_id"] == agent_id:
                # Check if not expired
                timeout_time = datetime.fromisoformat(notification["timeout_at"])
                if datetime.now() < timeout_time:
                    message = json.dumps({
                        "type": "bell_notification",
                        "notification": notification
                    })
                    
                    for websocket in self.agent_connections[agent_id]:
                        try:
                            await websocket.send_text(message)
                        except Exception:
                            pass

    async def send_status_update(self, booking_id: str, status: str, agent_id: int = None, customer_id: int = None):
        """Send booking status updates to relevant parties"""
        status_message = {
            "type": "booking_status_update",
            "booking_id": booking_id,
            "status": status,
            "timestamp": datetime.now().isoformat()
        }
        
        # Send to agent if specified and connected
        if agent_id and agent_id in self.agent_connections:
            for websocket in self.agent_connections[agent_id]:
                try:
                    await websocket.send_text(json.dumps(status_message))
                except Exception:
                    pass
        
        # Send to customer if specified and connected (implement customer connections similar to agents)
        # This would require extending the system to track customer WebSocket connections
        
        logger.info(f"📢 Status update sent: {booking_id} -> {status}")

    def get_agent_connection_status(self, agent_id: int) -> dict:
        """Get agent's connection status"""
        is_connected = agent_id in self.agent_connections and len(self.agent_connections[agent_id]) > 0
        connection_count = len(self.agent_connections.get(agent_id, []))
        
        return {
            "agent_id": agent_id,
            "is_connected": is_connected,
            "connection_count": connection_count,
            "last_seen": datetime.now().isoformat() if is_connected else None
        }

    def get_pending_notifications_count(self, agent_id: int) -> int:
        """Get count of pending notifications for an agent"""
        count = 0
        for notification in self.pending_notifications.values():
            if notification["agent_id"] == agent_id:
                count += 1
        return count

    async def broadcast_system_message(self, message: str, agent_ids: List[int] = None):
        """Broadcast system message to agents"""
        system_message = {
            "type": "system_message",
            "message": message,
            "timestamp": datetime.now().isoformat()
        }
        
        target_agents = agent_ids or list(self.agent_connections.keys())
        
        for agent_id in target_agents:
            if agent_id in self.agent_connections:
                for websocket in self.agent_connections[agent_id]:
                    try:
                        await websocket.send_text(json.dumps(system_message))
                    except Exception:
                        pass

    def cleanup_expired_notifications(self):
        """Clean up expired notifications (called periodically)"""
        current_time = datetime.now()
        expired_notifications = []
        
        for notification_id, notification in self.pending_notifications.items():
            timeout_time = datetime.fromisoformat(notification["timeout_at"])
            if current_time > timeout_time:
                expired_notifications.append(notification_id)
        
        for notification_id in expired_notifications:
            if notification_id in self.pending_notifications:
                del self.pending_notifications[notification_id]
            
            if notification_id in self.timeout_tasks:
                self.timeout_tasks[notification_id].cancel()
                del self.timeout_tasks[notification_id]
        
        if expired_notifications:
            logger.info(f"🧹 Cleaned up {len(expired_notifications)} expired notifications")

# Global notification manager instance
notification_manager = NotificationManager()

# Background task to clean up expired notifications
async def cleanup_notifications_periodically():
    """Background task to clean up expired notifications every minute"""
    while True:
        try:
            await asyncio.sleep(60)  # Run every minute
            notification_manager.cleanup_expired_notifications()
        except Exception as e:
            logger.error(f"Error in notification cleanup: {e}")

# Cleanup task management
cleanup_task = None

def start_notification_cleanup():
    global cleanup_task
    try:
        # Only start if there's an active event loop and no existing task
        if cleanup_task is None:
            loop = asyncio.get_running_loop()
            cleanup_task = loop.create_task(cleanup_notifications_periodically())
    except RuntimeError:
        # No event loop running, will start when one is available
        logger.info("No event loop available for notification cleanup task")

def stop_notification_cleanup():
    global cleanup_task
    if cleanup_task:
        cleanup_task.cancel()
        cleanup_task = None