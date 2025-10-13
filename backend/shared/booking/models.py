"""
Service Booking Database Models
Handles booking schema with comprehensive status tracking and location data
"""

import sqlite3
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import json

class BookingModel:
    def __init__(self, db_path: str = "database.db"):
        self.db_path = db_path
        self.init_tables()
    
    def init_tables(self):
        """Initialize booking system tables"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Main Bookings Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS bookings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    booking_uuid TEXT UNIQUE NOT NULL,
                    user_id INTEGER NOT NULL,
                    agent_id INTEGER NOT NULL,
                    
                    -- Service Information
                    service_category TEXT NOT NULL,
                    service_subcategory TEXT,
                    service_description TEXT,
                    service_notes TEXT,
                    
                    -- Location Data
                    service_latitude REAL NOT NULL,
                    service_longitude REAL NOT NULL,
                    service_address TEXT NOT NULL,
                    service_landmark TEXT,
                    service_city TEXT NOT NULL,
                    service_state TEXT NOT NULL,
                    service_pincode TEXT NOT NULL,
                    
                    -- Pricing Information
                    visit_charge DECIMAL(10,2) DEFAULT 0.00,
                    service_charge DECIMAL(10,2) DEFAULT 0.00,
                    additional_charges DECIMAL(10,2) DEFAULT 0.00,
                    discount_amount DECIMAL(10,2) DEFAULT 0.00,
                    total_amount DECIMAL(10,2) NOT NULL,
                    payment_method TEXT,
                    
                    -- Scheduling
                    requested_date DATE,
                    requested_time_slot TEXT,
                    scheduled_datetime DATETIME,
                    estimated_duration INTEGER, -- in minutes
                    
                    -- Status & Tracking
                    booking_status TEXT DEFAULT 'pending' CHECK (
                        booking_status IN (
                            'pending', 'accepted', 'rejected', 'cancelled',
                            'agent_en_route', 'service_started', 'service_completed',
                            'payment_pending', 'completed', 'refunded'
                        )
                    ),
                    
                    -- Agent Response Tracking
                    agent_notified_at DATETIME,
                    agent_response_timeout DATETIME,
                    agent_responded_at DATETIME,
                    agent_rejection_reason TEXT,
                    
                    -- Timestamps
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    completed_at DATETIME,
                    
                    -- Additional Data
                    special_instructions TEXT,
                    customer_rating INTEGER CHECK (customer_rating >= 1 AND customer_rating <= 5),
                    agent_rating INTEGER CHECK (agent_rating >= 1 AND agent_rating <= 5),
                    
                    -- Emergency & Support
                    is_emergency BOOLEAN DEFAULT FALSE,
                    support_contact_needed BOOLEAN DEFAULT FALSE,
                    cancellation_reason TEXT,
                    cancelled_by TEXT CHECK (cancelled_by IN ('customer', 'agent', 'system', 'admin')),
                    
                    -- Indexes will be created separately
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    FOREIGN KEY (agent_id) REFERENCES agents(id)
                )
            """)
            
            # Booking Status History Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS booking_status_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    booking_id INTEGER NOT NULL,
                    previous_status TEXT,
                    new_status TEXT NOT NULL,
                    changed_by_user_id INTEGER,
                    changed_by_role TEXT, -- 'customer', 'agent', 'system', 'admin'
                    reason TEXT,
                    location_latitude REAL,
                    location_longitude REAL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
                )
            """)
            
            # Agent Notifications Table (for bell notifications)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS agent_notifications (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    agent_id INTEGER NOT NULL,
                    booking_id INTEGER NOT NULL,
                    notification_type TEXT NOT NULL CHECK (
                        notification_type IN (
                            'booking_request', 'booking_cancelled', 'payment_received',
                            'customer_message', 'reminder', 'system_alert'
                        )
                    ),
                    notification_title TEXT NOT NULL,
                    notification_body TEXT NOT NULL,
                    notification_data TEXT, -- JSON data
                    
                    -- Notification State
                    is_sent BOOLEAN DEFAULT FALSE,
                    is_delivered BOOLEAN DEFAULT FALSE,
                    is_read BOOLEAN DEFAULT FALSE,
                    is_responded BOOLEAN DEFAULT FALSE,
                    
                    -- Bell Notification Settings (for booking requests)
                    requires_response BOOLEAN DEFAULT FALSE,
                    response_timeout DATETIME,
                    bell_sound_enabled BOOLEAN DEFAULT TRUE,
                    notification_priority INTEGER DEFAULT 1, -- 1=low, 2=medium, 3=high, 4=critical
                    
                    -- Tracking
                    sent_at DATETIME,
                    delivered_at DATETIME,
                    read_at DATETIME,
                    responded_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    
                    FOREIGN KEY (agent_id) REFERENCES agents(id),
                    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
                )
            """)
            
            # Service Pricing Estimates Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS booking_service_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    booking_id INTEGER NOT NULL,
                    service_name TEXT NOT NULL,
                    service_description TEXT,
                    quantity INTEGER DEFAULT 1,
                    unit_price DECIMAL(10,2) NOT NULL,
                    total_price DECIMAL(10,2) NOT NULL,
                    is_confirmed BOOLEAN DEFAULT FALSE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
                )
            """)
            
            # Booking Communication Log
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS booking_communications (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    booking_id INTEGER NOT NULL,
                    sender_user_id INTEGER NOT NULL,
                    sender_role TEXT NOT NULL CHECK (sender_role IN ('customer', 'agent', 'system', 'admin')),
                    message_type TEXT DEFAULT 'text' CHECK (
                        message_type IN ('text', 'image', 'location', 'system', 'voice_note')
                    ),
                    message_content TEXT NOT NULL,
                    message_data TEXT, -- JSON for additional data like image URLs
                    
                    -- Delivery Status
                    is_delivered BOOLEAN DEFAULT FALSE,
                    is_read BOOLEAN DEFAULT FALSE,
                    delivered_at DATETIME,
                    read_at DATETIME,
                    
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
                )
            """)
            
            # Agent Location Tracking During Bookings
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS agent_location_tracking (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    booking_id INTEGER NOT NULL,
                    agent_id INTEGER NOT NULL,
                    latitude REAL NOT NULL,
                    longitude REAL NOT NULL,
                    accuracy REAL,
                    speed REAL,
                    heading REAL,
                    altitude REAL,
                    battery_level INTEGER,
                    network_type TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
                    FOREIGN KEY (agent_id) REFERENCES agents(id)
                )
            """)
            
            # Create comprehensive indexes for performance
            indexes = [
                # Bookings table indexes
                "CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id)",
                "CREATE INDEX IF NOT EXISTS idx_bookings_agent_id ON bookings(agent_id)",
                "CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(booking_status)",
                "CREATE INDEX IF NOT EXISTS idx_bookings_uuid ON bookings(booking_uuid)",
                "CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at)",
                "CREATE INDEX IF NOT EXISTS idx_bookings_scheduled_datetime ON bookings(scheduled_datetime)",
                "CREATE INDEX IF NOT EXISTS idx_bookings_location ON bookings(service_latitude, service_longitude)",
                "CREATE INDEX IF NOT EXISTS idx_bookings_agent_timeout ON bookings(agent_id, agent_response_timeout)",
                
                # Status history indexes
                "CREATE INDEX IF NOT EXISTS idx_status_history_booking ON booking_status_history(booking_id)",
                "CREATE INDEX IF NOT EXISTS idx_status_history_created ON booking_status_history(created_at)",
                
                # Notifications indexes
                "CREATE INDEX IF NOT EXISTS idx_notifications_agent ON agent_notifications(agent_id)",
                "CREATE INDEX IF NOT EXISTS idx_notifications_booking ON agent_notifications(booking_id)",
                "CREATE INDEX IF NOT EXISTS idx_notifications_unread ON agent_notifications(agent_id, is_read)",
                "CREATE INDEX IF NOT EXISTS idx_notifications_timeout ON agent_notifications(response_timeout)",
                "CREATE INDEX IF NOT EXISTS idx_notifications_priority ON agent_notifications(notification_priority, created_at)",
                
                # Communications indexes
                "CREATE INDEX IF NOT EXISTS idx_communications_booking ON booking_communications(booking_id)",
                "CREATE INDEX IF NOT EXISTS idx_communications_created ON booking_communications(created_at)",
                
                # Location tracking indexes
                "CREATE INDEX IF NOT EXISTS idx_location_tracking_booking ON agent_location_tracking(booking_id)",
                "CREATE INDEX IF NOT EXISTS idx_location_tracking_agent ON agent_location_tracking(agent_id, created_at)",
                "CREATE INDEX IF NOT EXISTS idx_location_tracking_created ON agent_location_tracking(created_at)",
            ]
            
            for index_query in indexes:
                cursor.execute(index_query)
            
            conn.commit()
            print("✅ Booking system tables created successfully")
            
        except Exception as e:
            print(f"❌ Error creating booking tables: {e}")
            conn.rollback()
            raise
        finally:
            conn.close()
    
    def create_booking(self, booking_data: Dict[str, Any]) -> Optional[str]:
        """Create a new booking and return booking UUID"""
        import logging
        logger = logging.getLogger("booking")
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            import uuid
            booking_uuid = str(uuid.uuid4())
            timeout = datetime.now() + timedelta(seconds=30)
            logger.info(f"[MODEL] Creating booking with payload: {booking_data}")
            # Convert Decimal values to float for SQLite compatibility
            visit_charge = booking_data.get('visit_charge', 0)
            service_charge = booking_data.get('service_charge', 0)
            total_amount = booking_data['total_amount']
            
            # Convert Decimal to float if needed
            if hasattr(visit_charge, 'to_eng_string'):  # Check if it's a Decimal
                visit_charge = float(visit_charge)
            if hasattr(service_charge, 'to_eng_string'):  # Check if it's a Decimal
                service_charge = float(service_charge)
            if hasattr(total_amount, 'to_eng_string'):  # Check if it's a Decimal
                total_amount = float(total_amount)
            
            cursor.execute("""
                INSERT INTO bookings (
                    booking_uuid, user_id, agent_id, service_category, service_subcategory,
                    service_description, service_latitude, service_longitude, service_address,
                    service_city, service_state, service_pincode, visit_charge, service_charge,
                    total_amount, requested_date, requested_time_slot, agent_notified_at,
                    agent_response_timeout, special_instructions, is_emergency
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                booking_uuid,
                booking_data['user_id'],
                booking_data['agent_id'],
                booking_data['service_category'],
                booking_data.get('service_subcategory'),
                booking_data.get('service_description'),
                booking_data['service_latitude'],
                booking_data['service_longitude'],
                booking_data['service_address'],
                booking_data['service_city'],
                booking_data['service_state'],
                booking_data['service_pincode'],
                visit_charge,
                service_charge,
                total_amount,
                booking_data.get('requested_date'),
                booking_data.get('requested_time_slot'),
                datetime.now(),
                timeout,
                booking_data.get('special_instructions'),
                booking_data.get('is_emergency', False)
            ))
            booking_id = cursor.lastrowid
            logger.info(f"[MODEL] Booking row created: id={booking_id}, uuid={booking_uuid}")
            # Add initial status history
            cursor.execute("""
                INSERT INTO booking_status_history (
                    booking_id, new_status, changed_by_role, reason
                ) VALUES (?, 'pending', 'customer', 'Booking created')
            """, (booking_id,))
            logger.info(f"[MODEL] Booking status history row created for booking_id={booking_id}")
            # Create bell notification for agent
            cursor.execute("""
                INSERT INTO agent_notifications (
                    agent_id, booking_id, notification_type, notification_title,
                    notification_body, requires_response, response_timeout,
                    notification_priority, bell_sound_enabled
                ) VALUES (?, ?, 'booking_request', ?, ?, TRUE, ?, 4, TRUE)
            """, (
                booking_data['agent_id'],
                booking_id,
                f"New Booking Request - {booking_data['service_category']}",
                f"Customer wants {booking_data['service_category']} service at {booking_data['service_address']}. Total: ₹{booking_data['total_amount']}",
                timeout,
            ))
            logger.info(f"[MODEL] Agent notification row created for agent_id={booking_data['agent_id']} booking_id={booking_id}")
            conn.commit()
            logger.info(f"[MODEL] Booking committed successfully: uuid={booking_uuid}")
            return booking_uuid
        except Exception as e:
            logger.error(f"[MODEL] Exception during booking creation: {e}")
            conn.rollback()
            raise
        finally:
            conn.close()
    
    def update_booking_status(self, booking_uuid: str, new_status: str, 
                             changed_by_user_id: int, changed_by_role: str,
                             reason: str = None, location_data: Dict = None) -> bool:
        """Update booking status with history tracking"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Get current booking
            cursor.execute("""
                SELECT id, booking_status FROM bookings WHERE booking_uuid = ?
            """, (booking_uuid,))
            
            result = cursor.fetchone()
            if not result:
                raise ValueError("Booking not found")
            
            booking_id, current_status = result
            
            # Update booking status
            cursor.execute("""
                UPDATE bookings 
                SET booking_status = ?, updated_at = CURRENT_TIMESTAMP,
                    agent_responded_at = CASE 
                        WHEN ? IN ('accepted', 'rejected') AND agent_responded_at IS NULL 
                        THEN CURRENT_TIMESTAMP 
                        ELSE agent_responded_at 
                    END,
                    completed_at = CASE 
                        WHEN ? = 'completed' THEN CURRENT_TIMESTAMP 
                        ELSE completed_at 
                    END
                WHERE booking_uuid = ?
            """, (new_status, new_status, new_status, booking_uuid))
            
            # Add status history
            cursor.execute("""
                INSERT INTO booking_status_history (
                    booking_id, previous_status, new_status, changed_by_user_id,
                    changed_by_role, reason, location_latitude, location_longitude
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                booking_id, current_status, new_status, changed_by_user_id,
                changed_by_role, reason,
                location_data.get('latitude') if location_data else None,
                location_data.get('longitude') if location_data else None
            ))
            
            # Mark notification as responded if agent accepts/rejects
            if new_status in ['accepted', 'rejected'] and changed_by_role == 'agent':
                cursor.execute("""
                    UPDATE agent_notifications 
                    SET is_responded = TRUE, responded_at = CURRENT_TIMESTAMP
                    WHERE booking_id = ? AND notification_type = 'booking_request'
                """, (booking_id,))
            
            conn.commit()
            return True
            
        except Exception as e:
            conn.rollback()
            raise
        finally:
            conn.close()
    
    def get_pending_agent_notifications(self, agent_id: int, 
                                      timeout_check: bool = True) -> List[Dict[str, Any]]:
        """Get pending notifications for an agent with timeout checking"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            where_conditions = ["agent_id = ?", "is_responded = FALSE"]
            params = [agent_id]
            
            if timeout_check:
                where_conditions.append("response_timeout > CURRENT_TIMESTAMP")
            
            cursor.execute(f"""
                SELECT n.*, b.booking_uuid, b.service_category, b.total_amount, b.service_address
                FROM agent_notifications n
                LEFT JOIN bookings b ON n.booking_id = b.id
                WHERE {' AND '.join(where_conditions)}
                ORDER BY n.notification_priority DESC, n.created_at ASC
            """, params)
            
            columns = [description[0] for description in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]
            
        finally:
            conn.close()
    
    def handle_notification_timeout(self) -> int:
        """Handle expired agent notifications and auto-reject bookings"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Find expired notifications
            cursor.execute("""
                SELECT n.booking_id, n.agent_id, b.booking_uuid
                FROM agent_notifications n
                JOIN bookings b ON n.booking_id = b.id
                WHERE n.notification_type = 'booking_request' 
                AND n.is_responded = FALSE
                AND n.response_timeout <= CURRENT_TIMESTAMP
                AND b.booking_status = 'pending'
            """)
            
            expired_bookings = cursor.fetchall()
            timeout_count = 0
            
            for booking_id, agent_id, booking_uuid in expired_bookings:
                # Auto-reject booking
                cursor.execute("""
                    UPDATE bookings 
                    SET booking_status = 'rejected', 
                        agent_rejection_reason = 'Agent did not respond within timeout period',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (booking_id,))
                
                # Mark notification as responded (timed out)
                cursor.execute("""
                    UPDATE agent_notifications 
                    SET is_responded = TRUE, responded_at = CURRENT_TIMESTAMP
                    WHERE booking_id = ? AND notification_type = 'booking_request'
                """, (booking_id,))
                
                # Add status history
                cursor.execute("""
                    INSERT INTO booking_status_history (
                        booking_id, previous_status, new_status, 
                        changed_by_role, reason
                    ) VALUES (?, 'pending', 'rejected', 'system', 'Agent response timeout')
                """, (booking_id,))
                
                timeout_count += 1
            
            conn.commit()
            return timeout_count
            
        except Exception as e:
            conn.rollback()
            raise
        finally:
            conn.close()
    
    def add_agent_location_update(self, booking_id: int, agent_id: int, 
                                 location_data: Dict[str, Any]) -> bool:
        """Add agent location update during active booking"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO agent_location_tracking (
                    booking_id, agent_id, latitude, longitude, accuracy, 
                    speed, heading, altitude, battery_level, network_type
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                booking_id, agent_id,
                location_data['latitude'],
                location_data['longitude'],
                location_data.get('accuracy'),
                location_data.get('speed'),
                location_data.get('heading'),
                location_data.get('altitude'),
                location_data.get('battery_level'),
                location_data.get('network_type')
            ))
            
            conn.commit()
            return True
            
        except Exception as e:
            conn.rollback()
            raise
        finally:
            conn.close()