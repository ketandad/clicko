"""
Rating and Review Database Models
Handles user ratings and reviews for agents with aggregate calculations.
"""

import sqlite3
from datetime import datetime
from typing import Optional, List, Dict, Any

class RatingModel:
    def __init__(self, db_path: str = "database.db"):
        self.db_path = db_path
        self.init_tables()
    
    def init_tables(self):
        """Initialize rating system tables"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Agent Ratings Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS agent_ratings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    agent_id INTEGER NOT NULL,
                    booking_id INTEGER,
                    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
                    review_text TEXT,
                    service_quality_rating INTEGER CHECK (service_quality_rating >= 1 AND service_quality_rating <= 5),
                    punctuality_rating INTEGER CHECK (punctuality_rating >= 1 AND punctuality_rating <= 5),
                    professionalism_rating INTEGER CHECK (professionalism_rating >= 1 AND professionalism_rating <= 5),
                    value_for_money_rating INTEGER CHECK (value_for_money_rating >= 1 AND value_for_money_rating <= 5),
                    would_recommend BOOLEAN DEFAULT TRUE,
                    photos TEXT, -- JSON array of photo URLs
                    is_verified BOOLEAN DEFAULT FALSE,
                    is_featured BOOLEAN DEFAULT FALSE,
                    helpful_count INTEGER DEFAULT 0,
                    reported_count INTEGER DEFAULT 0,
                    agent_response TEXT,
                    agent_response_date DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, agent_id, booking_id) -- Prevent duplicate ratings for same booking
                )
            """)
            
            # Agent Rating Aggregates Table (for performance)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS agent_rating_aggregates (
                    agent_id INTEGER PRIMARY KEY,
                    total_ratings INTEGER DEFAULT 0,
                    avg_rating REAL DEFAULT 0.0,
                    avg_service_quality REAL DEFAULT 0.0,
                    avg_punctuality REAL DEFAULT 0.0,
                    avg_professionalism REAL DEFAULT 0.0,
                    avg_value_for_money REAL DEFAULT 0.0,
                    rating_1_count INTEGER DEFAULT 0,
                    rating_2_count INTEGER DEFAULT 0,
                    rating_3_count INTEGER DEFAULT 0,
                    rating_4_count INTEGER DEFAULT 0,
                    rating_5_count INTEGER DEFAULT 0,
                    recommendation_percentage REAL DEFAULT 0.0,
                    last_rating_date DATETIME,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Rating Helpful Votes Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS rating_helpful_votes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    rating_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    is_helpful BOOLEAN NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(rating_id, user_id),
                    FOREIGN KEY (rating_id) REFERENCES agent_ratings (id) ON DELETE CASCADE
                )
            """)
            
            # Rating Reports Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS rating_reports (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    rating_id INTEGER NOT NULL,
                    reporter_user_id INTEGER NOT NULL,
                    reason TEXT NOT NULL,
                    description TEXT,
                    status TEXT DEFAULT 'pending', -- pending, reviewed, dismissed, removed
                    admin_notes TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    reviewed_at DATETIME,
                    FOREIGN KEY (rating_id) REFERENCES agent_ratings (id) ON DELETE CASCADE
                )
            """)
            
            # Create indexes for performance
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_agent_ratings_agent_id ON agent_ratings(agent_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_agent_ratings_user_id ON agent_ratings(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_agent_ratings_booking_id ON agent_ratings(booking_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_agent_ratings_created_at ON agent_ratings(created_at)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_agent_ratings_rating ON agent_ratings(rating)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_agent_ratings_verified ON agent_ratings(is_verified)")
            
            conn.commit()
            print("✅ Rating system tables created successfully")
            
        except Exception as e:
            print(f"❌ Error creating rating tables: {e}")
            conn.rollback()
            raise
        finally:
            conn.close()
    
    def add_rating(self, rating_data: Dict[str, Any]) -> Optional[int]:
        """Add a new rating for an agent"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO agent_ratings (
                    user_id, agent_id, booking_id, rating, review_text,
                    service_quality_rating, punctuality_rating, professionalism_rating,
                    value_for_money_rating, would_recommend, photos
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                rating_data['user_id'],
                rating_data['agent_id'],
                rating_data.get('booking_id'),
                rating_data['rating'],
                rating_data.get('review_text'),
                rating_data.get('service_quality_rating'),
                rating_data.get('punctuality_rating'),
                rating_data.get('professionalism_rating'),
                rating_data.get('value_for_money_rating'),
                rating_data.get('would_recommend', True),
                rating_data.get('photos')  # JSON string
            ))
            
            rating_id = cursor.lastrowid
            
            # Update aggregates
            self._update_agent_aggregates(cursor, rating_data['agent_id'])
            
            conn.commit()
            return rating_id
            
        except sqlite3.IntegrityError as e:
            if "UNIQUE constraint failed" in str(e):
                raise ValueError("User has already rated this agent for this booking")
            raise
        except Exception as e:
            conn.rollback()
            raise
        finally:
            conn.close()
    
    def get_agent_ratings(self, agent_id: int, limit: int = 20, offset: int = 0, 
                         verified_only: bool = False) -> List[Dict[str, Any]]:
        """Get ratings for a specific agent"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            where_clause = "WHERE agent_id = ?"
            params = [agent_id]
            
            if verified_only:
                where_clause += " AND is_verified = TRUE"
            
            cursor.execute(f"""
                SELECT 
                    id, user_id, agent_id, booking_id, rating, review_text,
                    service_quality_rating, punctuality_rating, professionalism_rating,
                    value_for_money_rating, would_recommend, photos, is_verified,
                    is_featured, helpful_count, agent_response, agent_response_date,
                    created_at
                FROM agent_ratings 
                {where_clause}
                ORDER BY is_featured DESC, created_at DESC
                LIMIT ? OFFSET ?
            """, params + [limit, offset])
            
            columns = [description[0] for description in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]
            
        finally:
            conn.close()
    
    def get_agent_rating_summary(self, agent_id: int) -> Optional[Dict[str, Any]]:
        """Get rating summary/aggregates for an agent"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                SELECT * FROM agent_rating_aggregates WHERE agent_id = ?
            """, (agent_id,))
            
            row = cursor.fetchone()
            if not row:
                return None
                
            columns = [description[0] for description in cursor.description]
            return dict(zip(columns, row))
            
        finally:
            conn.close()
    
    def _update_agent_aggregates(self, cursor, agent_id: int):
        """Update aggregate ratings for an agent"""
        # Calculate new aggregates
        cursor.execute("""
            SELECT 
                COUNT(*) as total_ratings,
                AVG(rating) as avg_rating,
                AVG(service_quality_rating) as avg_service_quality,
                AVG(punctuality_rating) as avg_punctuality,
                AVG(professionalism_rating) as avg_professionalism,
                AVG(value_for_money_rating) as avg_value_for_money,
                SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as rating_1_count,
                SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as rating_2_count,
                SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as rating_3_count,
                SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as rating_4_count,
                SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as rating_5_count,
                AVG(CASE WHEN would_recommend THEN 100.0 ELSE 0.0 END) as recommendation_percentage,
                MAX(created_at) as last_rating_date
            FROM agent_ratings 
            WHERE agent_id = ?
        """, (agent_id,))
        
        aggregates = cursor.fetchone()
        
        # Insert or update aggregates
        cursor.execute("""
            INSERT OR REPLACE INTO agent_rating_aggregates (
                agent_id, total_ratings, avg_rating, avg_service_quality,
                avg_punctuality, avg_professionalism, avg_value_for_money,
                rating_1_count, rating_2_count, rating_3_count, rating_4_count, rating_5_count,
                recommendation_percentage, last_rating_date, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, (agent_id,) + aggregates)
        
        # Update agent table with latest ratings
        cursor.execute("""
            UPDATE agents 
            SET avg_rating = ?, total_ratings = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (aggregates[1], aggregates[0], agent_id))
    
    def add_helpful_vote(self, rating_id: int, user_id: int, is_helpful: bool) -> bool:
        """Add a helpful vote for a rating"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT OR REPLACE INTO rating_helpful_votes (rating_id, user_id, is_helpful)
                VALUES (?, ?, ?)
            """, (rating_id, user_id, is_helpful))
            
            # Update helpful count on the rating
            cursor.execute("""
                UPDATE agent_ratings 
                SET helpful_count = (
                    SELECT COUNT(*) FROM rating_helpful_votes 
                    WHERE rating_id = ? AND is_helpful = TRUE
                )
                WHERE id = ?
            """, (rating_id, rating_id))
            
            conn.commit()
            return True
            
        except Exception as e:
            conn.rollback()
            raise
        finally:
            conn.close()
    
    def report_rating(self, rating_id: int, reporter_user_id: int, reason: str, 
                     description: str = None) -> int:
        """Report a rating for review"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO rating_reports (rating_id, reporter_user_id, reason, description)
                VALUES (?, ?, ?, ?)
            """, (rating_id, reporter_user_id, reason, description))
            
            report_id = cursor.lastrowid
            
            # Update report count on the rating
            cursor.execute("""
                UPDATE agent_ratings 
                SET reported_count = (
                    SELECT COUNT(*) FROM rating_reports WHERE rating_id = ?
                )
                WHERE id = ?
            """, (rating_id, rating_id))
            
            conn.commit()
            return report_id
            
        except Exception as e:
            conn.rollback()
            raise
        finally:
            conn.close()