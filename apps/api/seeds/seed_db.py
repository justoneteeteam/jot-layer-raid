"""Seed the database with NFL teams and a default admin user."""
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal, engine, Base
from models.league import League
from models.team import Team
from models.user import User
from services.auth import hash_password

# Create tables
Base.metadata.create_all(bind=engine)


def seed():
    db = SessionLocal()
    try:
        # Check if already seeded
        if db.query(League).first():
            print("Database already seeded. Skipping.")
            return

        # Create NFL league
        nfl = League(name="NFL", slug="nfl")
        db.add(nfl)
        db.flush()

        # Create placeholder leagues for future use
        for league_data in [
            {"name": "MLB", "slug": "mlb"},
            {"name": "NCAA", "slug": "ncaa"},
            {"name": "NHL", "slug": "nhl"},
        ]:
            db.add(League(**league_data))

        # Load and create NFL teams
        seeds_dir = os.path.dirname(os.path.abspath(__file__))
        with open(os.path.join(seeds_dir, "nfl_teams.json"), "r") as f:
            teams_data = json.load(f)

        for team_data in teams_data:
            team = Team(league_id=nfl.id, **team_data)
            db.add(team)

        # Create default admin user
        admin = User(
            username="admin",
            hashed_password=hash_password("admin123"),
        )
        db.add(admin)

        db.commit()
        print(f"✅ Seeded {len(teams_data)} NFL teams + 3 placeholder leagues + admin user")
        print("   Admin login: admin / admin123")
    except Exception as e:
        db.rollback()
        print(f"❌ Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
