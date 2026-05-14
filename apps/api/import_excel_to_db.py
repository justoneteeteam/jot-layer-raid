import os
import sys
import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Set production database URL
os.environ["DATABASE_URL"] = "postgresql://postgres:OkUsvfhDHnglhQPtNohTEqlOhqhFRjfd@yamabiko.proxy.rlwy.net:34152/railway"

# Adjust path to import models
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import Base, engine, SessionLocal
from models.league import League
from models.team import Team
from models.player import Player

def import_data():
    print("Connecting to database...")
    db = SessionLocal()
    
    print("Reading Excel file...")
    excel_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "NFL Database.xlsx")
    xls = pd.ExcelFile(excel_path)
    
    # Ensure NFL League exists
    nfl_league = db.query(League).filter(League.name == "NFL").first()
    if not nfl_league:
        print("Creating NFL league...")
        nfl_league = League(name="NFL", slug="nfl")
        db.add(nfl_league)
        db.commit()
        db.refresh(nfl_league)
    
    # Read Overall DB
    overall_df = pd.read_excel(xls, sheet_name="Overall DB")
    overall_df = overall_df.dropna(subset=['Team'])
    
    teams_dict = {}
    print(f"Found {len(overall_df)} teams in Overall DB")
    
    for _, row in overall_df.iterrows():
        team_name = str(row['Team']).strip()
        region = str(row['Region']).strip() if pd.notna(row['Region']) else None
        
        # Check if team exists
        team = db.query(Team).filter(Team.name == team_name, Team.league_id == nfl_league.id).first()
        if not team:
            slug = team_name.lower().replace(" ", "-").replace(".", "")
            team = Team(
                name=team_name,
                league_id=nfl_league.id,
                region=region,
                slug=slug
            )
            db.add(team)
            db.flush()
            print(f"  Created team: {team_name}")
        
        teams_dict[team_name] = team
    
    db.commit()
    
    # Process Player Sheets
    for sheet_name in xls.sheet_names:
        if sheet_name == "Overall DB":
            continue
            
        print(f"Processing sheet: {sheet_name}")
        # Sometimes there's a header offset, let's read without header first and find 'Name'
        df = pd.read_excel(xls, sheet_name=sheet_name)
        
        # In the provided Excel, the first row was read as headers, so columns are Unnamed, but the first data row is the actual header
        # E.g.: [Name, Number, Type, Group]
        # We can just reset columns if the first row is 'Name'
        if 'Unnamed: 0' in df.columns and df.iloc[0, 0] == 'Name':
            df.columns = df.iloc[0]
            df = df[1:]
        elif df.columns[0] == 'Name':
            pass # already correct
        
        # Check if we have the 'Name' column
        if 'Name' not in df.columns:
            print(f"  Skipping {sheet_name} - no 'Name' column found.")
            continue
            
        team_name = sheet_name.strip()
        team = teams_dict.get(team_name)
        if not team:
            matched = False
            for t_name, t_obj in teams_dict.items():
                if team_name in t_name or t_name in team_name:
                    team = t_obj
                    matched = True
                    break
            
            if not matched:
                print(f"  Creating missing team for sheet '{sheet_name}'")
                slug = team_name.lower().replace(" ", "-").replace(".", "")
                team = Team(name=team_name, league_id=nfl_league.id, slug=slug)
                db.add(team)
                db.flush()
                teams_dict[team_name] = team
                
        # Load existing players for this team
        existing_players_q = db.query(Player.name, Player.number).filter(Player.team_id == team.id).all()
        existing_players = {(p.name.strip().lower(), p.number) for p in existing_players_q}
                
        new_players = []
        for _, row in df.iterrows():
            player_name = str(row['Name']).strip()
            if not player_name or player_name.lower() == 'nan':
                continue
                
            number = None
            if 'Number' in df.columns and pd.notna(row['Number']):
                try:
                    number = int(row['Number'])
                except ValueError:
                    pass
            
            if number is None:
                continue
                
            p_type = "Current"
            if 'Type' in df.columns and pd.notna(row['Type']):
                p_type = str(row['Type']).strip()
                
            group = "Football"
            if 'Group' in df.columns and pd.notna(row['Group']):
                val = str(row['Group']).strip()
                if val.lower() == 'hockey':
                    group = "Football"
                else:
                    group = val
                    
            # Check memory set
            if (player_name.lower(), number) not in existing_players:
                player = Player(
                    team_id=team.id,
                    name=player_name,
                    display_name=player_name.upper(),
                    number=number,
                    type=p_type,
                    group=group
                )
                new_players.append(player)
                existing_players.add((player_name.lower(), number))
                
        if new_players:
            db.add_all(new_players)
            db.commit()
            print(f"  Added {len(new_players)} players for {team.name}")
            
    print("Done!")

if __name__ == "__main__":
    import_data()
