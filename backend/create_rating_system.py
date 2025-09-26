"""
Agent Rating and Review System Database Migration
Creates tables for storing user ratings and reviews for agents
"""

import sqlite3
import os

def create_rating_tables():
    """Create rating and review related tables"""
    
    # Get database path
    db_path = 'agents.db'
    
    # Connect to database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        print("🗄️ Creating agent rating system tables...")
        
        # 1. Agent Ratings Table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS agent_ratings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            booking_id INTEGER,
            user_id INTEGER NOT NULL,
            agent_id INTEGER NOT NULL,
            rating REAL NOT NULL CHECK(rating >= 1 AND rating <= 5),
            review_text TEXT,
            service_quality_rating INTEGER CHECK(service_quality_rating >= 1 AND service_quality_rating <= 5),
            punctuality_rating INTEGER CHECK(punctuality_rating >= 1 AND punctuality_rating <= 5),
            communication_rating INTEGER CHECK(communication_rating >= 1 AND communication_rating <= 5),
            value_for_money_rating INTEGER CHECK(value_for_money_rating >= 1 AND value_for_money_rating <= 5),
            would_recommend BOOLEAN DEFAULT TRUE,
            review_photos TEXT, -- JSON array of photo URLs
            is_verified BOOLEAN DEFAULT FALSE,
            is_moderated BOOLEAN DEFAULT FALSE,
            moderation_status TEXT DEFAULT 'pending', -- pending, approved, rejected
            moderation_notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (agent_id) REFERENCES agents (id),
            FOREIGN KEY (booking_id) REFERENCES bookings (id)
        )
        ''')
        
        # 2. Agent Rating Aggregates Table (for performance)
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS agent_rating_aggregates (
            agent_id INTEGER PRIMARY KEY,
            total_ratings INTEGER DEFAULT 0,
            avg_rating REAL DEFAULT 0,
            avg_service_quality REAL DEFAULT 0,
            avg_punctuality REAL DEFAULT 0,
            avg_communication REAL DEFAULT 0,
            avg_value_for_money REAL DEFAULT 0,
            five_star_count INTEGER DEFAULT 0,
            four_star_count INTEGER DEFAULT 0,
            three_star_count INTEGER DEFAULT 0,
            two_star_count INTEGER DEFAULT 0,
            one_star_count INTEGER DEFAULT 0,
            total_reviews INTEGER DEFAULT 0,
            total_recommendations INTEGER DEFAULT 0,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (agent_id) REFERENCES agents (id)
        )
        ''')
        
        # 3. Rating Photos Table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS rating_photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rating_id INTEGER NOT NULL,
            photo_url TEXT NOT NULL,
            photo_type TEXT DEFAULT 'review', -- review, before, after
            caption TEXT,
            is_approved BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (rating_id) REFERENCES agent_ratings (id)
        )
        ''')
        
        # 4. Rating Helpful Votes Table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS rating_helpful_votes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rating_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            is_helpful BOOLEAN NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(rating_id, user_id),
            FOREIGN KEY (rating_id) REFERENCES agent_ratings (id),
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
        ''')
        
        # 5. Agent Response to Reviews Table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS agent_review_responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rating_id INTEGER NOT NULL,
            agent_id INTEGER NOT NULL,
            response_text TEXT NOT NULL,
            is_approved BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (rating_id) REFERENCES agent_ratings (id),
            FOREIGN KEY (agent_id) REFERENCES agents (id)
        )
        ''')
        
        print("✅ Creating indexes for better performance...")
        
        # Create indexes for better query performance
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_agent_ratings_agent_id ON agent_ratings(agent_id)",
            "CREATE INDEX IF NOT EXISTS idx_agent_ratings_user_id ON agent_ratings(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_agent_ratings_booking_id ON agent_ratings(booking_id)",
            "CREATE INDEX IF NOT EXISTS idx_agent_ratings_rating ON agent_ratings(rating)",
            "CREATE INDEX IF NOT EXISTS idx_agent_ratings_created_at ON agent_ratings(created_at)",
            "CREATE INDEX IF NOT EXISTS idx_agent_ratings_moderation ON agent_ratings(moderation_status, is_moderated)",
            "CREATE INDEX IF NOT EXISTS idx_rating_photos_rating_id ON rating_photos(rating_id)",
            "CREATE INDEX IF NOT EXISTS idx_helpful_votes_rating_id ON rating_helpful_votes(rating_id)",
            "CREATE INDEX IF NOT EXISTS idx_helpful_votes_user_id ON rating_helpful_votes(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_agent_responses_rating_id ON agent_review_responses(rating_id)",
            "CREATE INDEX IF NOT EXISTS idx_agent_responses_agent_id ON agent_review_responses(agent_id)"
        ]
        
        for index_sql in indexes:
            cursor.execute(index_sql)
        
        print("✅ Creating triggers for aggregate calculations...")
        
        # Trigger to update rating aggregates when new rating is added
        cursor.execute('''
        CREATE TRIGGER IF NOT EXISTS update_agent_rating_aggregates_insert
        AFTER INSERT ON agent_ratings
        WHEN NEW.moderation_status = 'approved'
        BEGIN
            INSERT OR REPLACE INTO agent_rating_aggregates (
                agent_id, total_ratings, avg_rating, avg_service_quality, 
                avg_punctuality, avg_communication, avg_value_for_money,
                five_star_count, four_star_count, three_star_count, 
                two_star_count, one_star_count, total_reviews, 
                total_recommendations, last_updated
            )
            SELECT 
                NEW.agent_id,
                COUNT(*) as total_ratings,
                AVG(rating) as avg_rating,
                AVG(COALESCE(service_quality_rating, rating)) as avg_service_quality,
                AVG(COALESCE(punctuality_rating, rating)) as avg_punctuality,
                AVG(COALESCE(communication_rating, rating)) as avg_communication,
                AVG(COALESCE(value_for_money_rating, rating)) as avg_value_for_money,
                SUM(CASE WHEN rating >= 4.5 THEN 1 ELSE 0 END) as five_star_count,
                SUM(CASE WHEN rating >= 3.5 AND rating < 4.5 THEN 1 ELSE 0 END) as four_star_count,
                SUM(CASE WHEN rating >= 2.5 AND rating < 3.5 THEN 1 ELSE 0 END) as three_star_count,
                SUM(CASE WHEN rating >= 1.5 AND rating < 2.5 THEN 1 ELSE 0 END) as two_star_count,
                SUM(CASE WHEN rating < 1.5 THEN 1 ELSE 0 END) as one_star_count,
                SUM(CASE WHEN review_text IS NOT NULL AND LENGTH(review_text) > 0 THEN 1 ELSE 0 END) as total_reviews,
                SUM(CASE WHEN would_recommend = 1 THEN 1 ELSE 0 END) as total_recommendations,
                CURRENT_TIMESTAMP
            FROM agent_ratings 
            WHERE agent_id = NEW.agent_id AND moderation_status = 'approved';
        END;
        ''')
        
        # Trigger to update aggregates when rating is updated/moderated
        cursor.execute('''
        CREATE TRIGGER IF NOT EXISTS update_agent_rating_aggregates_update
        AFTER UPDATE ON agent_ratings
        WHEN OLD.moderation_status != NEW.moderation_status OR OLD.rating != NEW.rating
        BEGIN
            INSERT OR REPLACE INTO agent_rating_aggregates (
                agent_id, total_ratings, avg_rating, avg_service_quality, 
                avg_punctuality, avg_communication, avg_value_for_money,
                five_star_count, four_star_count, three_star_count, 
                two_star_count, one_star_count, total_reviews, 
                total_recommendations, last_updated
            )
            SELECT 
                NEW.agent_id,
                COUNT(*) as total_ratings,
                AVG(rating) as avg_rating,
                AVG(COALESCE(service_quality_rating, rating)) as avg_service_quality,
                AVG(COALESCE(punctuality_rating, rating)) as avg_punctuality,
                AVG(COALESCE(communication_rating, rating)) as avg_communication,
                AVG(COALESCE(value_for_money_rating, rating)) as avg_value_for_money,
                SUM(CASE WHEN rating >= 4.5 THEN 1 ELSE 0 END) as five_star_count,
                SUM(CASE WHEN rating >= 3.5 AND rating < 4.5 THEN 1 ELSE 0 END) as four_star_count,
                SUM(CASE WHEN rating >= 2.5 AND rating < 3.5 THEN 1 ELSE 0 END) as three_star_count,
                SUM(CASE WHEN rating >= 1.5 AND rating < 2.5 THEN 1 ELSE 0 END) as two_star_count,
                SUM(CASE WHEN rating < 1.5 THEN 1 ELSE 0 END) as one_star_count,
                SUM(CASE WHEN review_text IS NOT NULL AND LENGTH(review_text) > 0 THEN 1 ELSE 0 END) as total_reviews,
                SUM(CASE WHEN would_recommend = 1 THEN 1 ELSE 0 END) as total_recommendations,
                CURRENT_TIMESTAMP
            FROM agent_ratings 
            WHERE agent_id = NEW.agent_id AND moderation_status = 'approved';
        END;
        ''')
        
        # Note: Initialize aggregates for existing agents will be done via API
        # since agents table is managed by SQLAlchemy and may not exist in SQLite yet
        
        # Commit the changes
        conn.commit()
        print("✅ Agent rating system tables created successfully!")
        print("📊 Tables created:")
        print("   - agent_ratings (main ratings table)")
        print("   - agent_rating_aggregates (performance optimized aggregates)")
        print("   - rating_photos (review photos)")
        print("   - rating_helpful_votes (community voting)")
        print("   - agent_review_responses (agent responses to reviews)")
        print("📈 Indexes and triggers created for optimal performance")
        
    except Exception as e:
        print(f"❌ Error creating rating tables: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    create_rating_tables()