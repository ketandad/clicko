#!/usr/bin/env python3
"""
Database Migration: Add Enhanced Location Tracking to Agents
============================================================

This script adds new location tracking fields to the agents table for:
- Scalable geospatial queries (indexed latitude/longitude)
- Real-time location updates
- Service radius management
- Location accuracy tracking

Run this after updating the Agent model with new location fields.
"""

import sqlite3
from pathlib import Path

def migrate_agent_location_fields():
    """Add new location tracking fields to agents table"""
    
    db_path = Path(__file__).parent / "clicko.db"
    
    if not db_path.exists():
        print("❌ Database file not found. Creating new database with updated schema.")
        return
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # List of new columns to add
    new_columns = [
        ("current_latitude", "REAL"),
        ("current_longitude", "REAL"),  
        ("service_radius_km", "REAL DEFAULT 10.0"),
        ("last_location_update", "DATETIME"),
        ("location_accuracy", "REAL"),
        ("is_location_enabled", "BOOLEAN DEFAULT 1"),
        ("base_latitude", "REAL"),
        ("base_longitude", "REAL")
    ]
    
    try:
        # Check which columns already exist
        cursor.execute("PRAGMA table_info(agents)")
        existing_columns = {col[1] for col in cursor.fetchall()}
        
        # Add missing columns
        for col_name, col_type in new_columns:
            if col_name not in existing_columns:
                print(f"➕ Adding column: {col_name}")
                cursor.execute(f"ALTER TABLE agents ADD COLUMN {col_name} {col_type}")
        
        # Create indexes for efficient geospatial queries
        try:
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_agents_current_lat ON agents(current_latitude)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_agents_current_lng ON agents(current_longitude)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_agents_location_update ON agents(last_location_update)")
            print("✅ Created geospatial indexes for efficient location queries")
        except sqlite3.Error as e:
            print(f"⚠️  Warning: Could not create indexes: {e}")
        
        # Update existing agents with default service radius
        cursor.execute("""
            UPDATE agents 
            SET service_radius_km = 10.0, is_location_enabled = 1 
            WHERE service_radius_km IS NULL OR is_location_enabled IS NULL
        """)
        
        conn.commit()
        print("✅ Agent location fields migration completed successfully!")
        print("📊 Enhanced location tracking is now available for agents")
        
    except sqlite3.Error as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    print("🚀 Starting Agent Location Fields Migration...")
    migrate_agent_location_fields()