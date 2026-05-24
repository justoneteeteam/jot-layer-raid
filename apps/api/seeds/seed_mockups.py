"""Seed dummy font and mockup template into local SQLite database."""
import sqlite3
import json
import os

db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "jotlayerraid.db")

def seed():
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Get first team
    cursor.execute("SELECT id, name FROM teams LIMIT 1")
    team = cursor.fetchone()
    if team:
        team_id, team_name = team
        print(f"First team found: {team_name} (ID: {team_id})")
        
        # 1. Insert a dummy font
        cursor.execute("""
            INSERT INTO fonts (name, file_url, category, team_id, jersey_type)
            VALUES (?, ?, ?, ?, ?)
        """, ("Impact Bold", "fonts/impact.ttf", "NFL", team_id, "Home"))
        
        # 2. Insert a dummy mockup template
        font_config = json.dumps({
            "font_id": 1, "size": 60, "color": "#FFFFFF", "outline_color": "#000000", "outline_width": 2
        })
        cursor.execute("""
            INSERT INTO mockup_templates (team_id, name, color_variant, original_image_url, font_config, background_color)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (team_id, f"{team_name} Home", "Primary", "mockups/test_bg.png", font_config, "#0D9488"))
        
        conn.commit()
        print("✅ Successfully seeded dummy font and mockup template!")
    else:
        print("❌ No teams found in database.")
    
    conn.close()

if __name__ == "__main__":
    seed()
