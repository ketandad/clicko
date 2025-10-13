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
        # Check if agent is online before sending booking notifications
        if not await self.is_agent_online(agent_id):
            logger.info(f"🔕 Agent {agent_id} is offline, skipping booking notification")
            return None
            
        notification_id = str(uuid.uuid4())
        
        # Prepare notification with 2-minute timeout
        notification = {
            "id": notification_id,
            "type": "booking_request", 
            "agent_id": agent_id,
            "data": notification_data,
            "created_at": datetime.now().isoformat(),
            "timeout_at": (datetime.now() + timedelta(minutes=2)).isoformat(),  # 2-minute timeout
            "timeout_seconds": 120,  # 2 minutes in seconds for countdown
            "requires_response": True,
            "sound_type": "bell_continuous", # Bell sound that rings continuously
            "priority": "critical"
        }
        
        # Store pending notification
        self.pending_notifications[notification_id] = notification
        
        # Send to agent if connected via WebSocket
        websocket_sent = False
        if agent_id in self.agent_connections:
            message = json.dumps({
                "type": "bell_notification",
                "notification": notification
            })
            
            # Send to all agent connections (multiple devices)
            for websocket in self.agent_connections[agent_id]:
                try:
                    await websocket.send_text(message)
                    logger.info(f"🔔 Bell notification sent via WebSocket to agent {agent_id}")
                    websocket_sent = True
                except Exception as e:
                    logger.error(f"Failed to send WebSocket notification to agent {agent_id}: {e}")
        
        # If no WebSocket connection, send push notification
        if not websocket_sent:
            try:
                await self.send_push_notification(agent_id, notification_data)
                logger.info(f"📱 Push notification sent to agent {agent_id} (offline)")
            except Exception as e:
                logger.error(f"Failed to send push notification to agent {agent_id}: {e}")
        
        # Set 2-minute timeout handler
        timeout_task = asyncio.create_task(
            self.handle_notification_timeout(notification_id, agent_id)
        )
        self.timeout_tasks[notification_id] = timeout_task
        logger.info(f"⏰ Bell notification will ring for 2 minutes or until agent {agent_id} responds")
        
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
        
        # Cancel timeout task (if any exists from previous versions)
        if notification_id in self.timeout_tasks:
            self.timeout_tasks[notification_id].cancel()
            del self.timeout_tasks[notification_id]
        
        # Update notification with response
        notification["response"] = response
        notification["response_data"] = response_data
        notification["responded_at"] = datetime.now().isoformat()
        
        # Update booking status in database
        booking_uuid = notification["data"].get("booking_uuid")
        if booking_uuid:
            try:
                from ..booking.models import BookingModel
                booking_model = BookingModel()
                
                # Update booking status based on agent response
                new_status = "accepted" if response == "accepted" else "rejected"
                success = booking_model.update_booking_status(
                    booking_uuid=booking_uuid,
                    new_status=new_status,
                    changed_by_user_id=agent_id,
                    changed_by_role="agent",
                    reason=response_data.get("reason") if response == "rejected" else None
                )
                
                if success:
                    logger.info(f"Booking {booking_uuid} status updated to {new_status}")
                else:
                    logger.error(f"Failed to update booking {booking_uuid} status")
                    
            except Exception as booking_error:
                logger.error(f"Error updating booking status: {booking_error}")
        
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
            "booking_id": notification["data"].get("booking_id"),
            "booking_uuid": booking_uuid
        }

    async def handle_notification_timeout(self, notification_id: str, agent_id: int):
        """
        Handle notification timeout (2 minutes) - auto-reject booking
        """
        try:
            await asyncio.sleep(120)  # Wait for 2 minutes (120 seconds)
            
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

    async def is_agent_online(self, agent_id: int) -> bool:
        """
        Check if an agent is currently online and available for bookings
        Must be BOTH online in database AND connected to WebSocket
        """
        try:
            import sqlite3
            import os
            
            # Use the main application database (same as in shared/database.py)
            db_path = os.getenv("DATABASE_URL", "sqlite:///./clicko.db").replace("sqlite:///./", "")
            
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Check agent status in agents table
            cursor.execute("""
                SELECT is_online, last_online 
                FROM agents 
                WHERE id = ?
            """, (agent_id,))
            
            result = cursor.fetchone()
            conn.close()
            
            if not result:
                logger.warning(f"Agent {agent_id} not found in database")
                return False
                
            is_online, last_online = result
            
            # Agent must be online in database
            if not bool(is_online):
                logger.info(f"Agent {agent_id} is offline in database")
                return False
            
            # Agent must ALSO be connected to WebSocket (actually listening)
            if agent_id not in self.agent_connections or not self.agent_connections[agent_id]:
                logger.info(f"Agent {agent_id} is online in DB but not connected to WebSocket")
                return False
                
            logger.info(f"Agent {agent_id} is fully online: DB=True, WebSocket=True")
            return True
            
        except Exception as e:
            logger.error(f"Error checking agent status for {agent_id}: {e}")
            # Default to offline if we can't check status
            return False

    def is_business_hours(self) -> bool:
        """
        Check if current time is within business hours (7 AM - 10 PM IST)
        No notifications should be sent during night time
        """
        try:
            from datetime import datetime
            import pytz
            
            # Get current time in IST
            ist = pytz.timezone('Asia/Kolkata')
            current_time = datetime.now(ist)
            current_hour = current_time.hour
            
            # Business hours: 7 AM to 10 PM (7-22)
            return 7 <= current_hour <= 22
            
        except Exception as e:
            logger.error(f"Error checking business hours: {e}")
            # Default to business hours if we can't check
            return True

    async def send_offline_reminder(self, agent_id: int):
        """
        Send a gentle reminder to offline agents during business hours
        """
        if not self.is_business_hours():
            logger.info(f"⏰ Outside business hours, skipping reminder for agent {agent_id}")
            return False
            
        try:
            reminder_data = {
                "user_name": "ClickO Platform",
                "service_category": "Go Online Reminder", 
                "service_address": "Start receiving bookings by going online",
                "total_amount": 0.0,
                "is_emergency": False,
                "is_reminder": True
            }
            
            await self.send_push_notification(agent_id, reminder_data)
            logger.info(f"📱 Offline reminder sent to agent {agent_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error sending offline reminder to agent {agent_id}: {e}")
            return False

    async def send_push_notification(self, agent_id: int, notification_data: dict):
        """
        Send push notification to agent when they're offline
        Uses Expo Push Notifications service
        """
        try:
            # Get agent's push token from database
            push_token = await self.get_agent_push_token(agent_id)
            if not push_token:
                logger.warning(f"No push token found for agent {agent_id}")
                return False
            
            # Prepare push notification payload
            is_reminder = notification_data.get('is_reminder', False)
            
            if is_reminder:
                push_message = {
                    "to": push_token,
                    "sound": "default",
                    "title": "� Go Online - ClickO",
                    "body": "Ready to earn? Go online to start receiving booking requests!",
                    "data": {
                        "type": "offline_reminder",
                        **notification_data
                    },
                    "priority": "normal",
                    "channelId": "reminders",
                    "_displayInForeground": False
                }
            else:
                push_message = {
                    "to": push_token,
                    "sound": "default", 
                    "title": "�🔔 New Booking Request",
                    "body": f"Booking from {notification_data.get('user_name', 'Customer')} - {notification_data.get('service_category', 'Service')}",
                    "data": {
                        "type": "booking_request",
                        **notification_data
                    },
                    "priority": "high",
                    "channelId": "booking-requests",
                    "_displayInForeground": True
                }
            
            # Send push notification via Expo Push API
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    'https://exp.host/--/api/v2/push/send',
                    json=push_message,
                    headers={
                        'Accept': 'application/json',
                        'Accept-encoding': 'gzip, deflate',
                        'Content-Type': 'application/json',
                    }
                ) as response:
                    result = await response.json()
                    if response.status == 200:
                        logger.info(f"📱 Push notification sent successfully to agent {agent_id}")
                        return True
                    else:
                        logger.error(f"Push notification failed: {result}")
                        return False
                        
        except Exception as e:
            logger.error(f"Error sending push notification: {e}")
            return False

    async def get_agent_push_token(self, agent_id: int):
        """
        Get agent's Expo push token from database
        """
        try:
            # TODO: Implement database query to get push token
            # For now, return None to fallback to WebSocket only
            return None
        except Exception as e:
            logger.error(f"Error getting push token for agent {agent_id}: {e}")
            return None

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

# Background task to send offline reminders
async def send_offline_reminders_periodically():
    """Background task to send reminders to offline agents every 3 hours during business hours"""
    while True:
        try:
            # Wait 3 hours between reminder checks
            await asyncio.sleep(3 * 60 * 60)  # 3 hours in seconds
            
            if not notification_manager.is_business_hours():
                logger.info("⏰ Outside business hours, skipping offline reminders")
                continue
                
            # Get all offline agents from database
            offline_agents = await get_offline_agents()
            
            for agent_id in offline_agents:
                try:
                    await notification_manager.send_offline_reminder(agent_id)
                except Exception as agent_error:
                    logger.error(f"Error sending reminder to agent {agent_id}: {agent_error}")
                    
            if offline_agents:
                logger.info(f"📱 Sent offline reminders to {len(offline_agents)} agents")
            
        except Exception as e:
            logger.error(f"Error in offline reminder task: {e}")

async def get_offline_agents():
    """Get list of agent IDs who are currently offline"""
    try:
        import sqlite3
        from ..booking.models import BookingModel
        booking_model = BookingModel()
        
        conn = sqlite3.connect(booking_model.db_path)
        cursor = conn.cursor()
        
        # Get agents who are offline and have push tokens
        cursor.execute("""
            SELECT user_id 
            FROM agents 
            WHERE (is_online = 0 OR is_online IS NULL)
            AND push_token IS NOT NULL
            AND created_at > datetime('now', '-30 days')  -- Active agents only
        """)
        
        offline_agents = [row[0] for row in cursor.fetchall()]
        conn.close()
        
        return offline_agents
        
    except Exception as e:
        logger.error(f"Error getting offline agents: {e}")
        return []

# Task management
cleanup_task = None
reminder_task = None

def start_notification_cleanup():
    global cleanup_task, reminder_task
    try:
        # Only start if there's an active event loop and no existing tasks
        loop = asyncio.get_running_loop()
        
        if cleanup_task is None:
            cleanup_task = loop.create_task(cleanup_notifications_periodically())
            logger.info("🧹 Started notification cleanup task")
            
        if reminder_task is None:
            reminder_task = loop.create_task(send_offline_reminders_periodically())
            logger.info("📱 Started offline reminder task")
            
    except RuntimeError:
        # No event loop running, will start when one is available
        logger.info("No event loop available for background tasks")

def stop_notification_cleanup():
    global cleanup_task, reminder_task
    
    if cleanup_task:
        cleanup_task.cancel()
        cleanup_task = None
        logger.info("🛑 Stopped notification cleanup task")
        
    if reminder_task:
        reminder_task.cancel()
        reminder_task = None
        logger.info("🛑 Stopped offline reminder task")