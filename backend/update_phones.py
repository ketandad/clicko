#!/usr/bin/env python3
"""
Script to update agent phone numbers in the database
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from shared.database import get_db, engine
from shared.user.models import User, Agent

def update_agent_phone_numbers():
    """Update phone numbers for all agents in the database"""
    db = next(get_db())
    
    try:
        print("🔄 Updating agent phone numbers...")
        
        # Updated phone numbers with different patterns
        phone_updates = [
            {"email": "rajesh.kumar@example.com", "phone": "+91-7777777001"},
            {"email": "priya.sharma@example.com", "phone": "+91-8888888002"},
            {"email": "amit.singh@example.com", "phone": "+91-9999999003"},
            {"email": "sunita.patel@example.com", "phone": "+91-6666666004"},
            {"email": "vikram.gupta@example.com", "phone": "+91-5555555005"},
            {"email": "kavitha.reddy@example.com", "phone": "+91-4444444006"},
            {"email": "sayali@gmail.com", "phone": "+91-1234567890"},  # Current logged in user
        ]
        
        updated_count = 0
        for update_data in phone_updates:
            user = db.query(User).filter(User.email == update_data["email"]).first()
            if user:
                user.phone = update_data["phone"]
                print(f"📞 Updated {user.name}: {update_data['phone']}")
                updated_count += 1
            else:
                print(f"❌ User not found: {update_data['email']}")
        
        db.commit()
        print(f"✅ Successfully updated {updated_count} agent phone numbers!")
        
    except Exception as e:
        print(f"❌ Error updating phone numbers: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    update_agent_phone_numbers()