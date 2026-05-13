from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from models.team import Team
from models.player import Player
from models.league import League

router = APIRouter(prefix="/api/database", tags=["Database Import"])


class PlayerImport(BaseModel):
    name: str
    display_name: str = ""
    number: int
    type: str = "Current"
    group: str = "Football"


class TeamImport(BaseModel):
    name: str
    players: list[PlayerImport]


class ImportPayload(BaseModel):
    league: str = "NFL"
    teams: list[TeamImport]


@router.post("/import")
def import_csv_data(payload: ImportPayload, db: Session = Depends(get_db)):
    """Import parsed CSV data — upsert teams and players."""
    # Ensure league exists
    league = db.query(League).filter(League.slug == payload.league.lower()).first()
    if not league:
        league = League(name=payload.league, slug=payload.league.lower())
        db.add(league)
        db.commit()
        db.refresh(league)

    stats = {"teams_created": 0, "teams_updated": 0, "players_created": 0, "players_updated": 0}

    for team_data in payload.teams:
        slug = team_data.name.lower().replace(" ", "-")
        team = db.query(Team).filter(Team.slug == slug).first()
        if not team:
            team = Team(name=team_data.name, slug=slug, league_id=league.id)
            db.add(team)
            db.commit()
            db.refresh(team)
            stats["teams_created"] += 1
        else:
            stats["teams_updated"] += 1

        for p in team_data.players:
            display = p.display_name or p.name.upper()
            existing = (
                db.query(Player)
                .filter(Player.team_id == team.id, Player.number == p.number)
                .first()
            )
            if existing:
                existing.name = p.name
                existing.display_name = display
                existing.type = p.type
                existing.group = p.group
                stats["players_updated"] += 1
            else:
                player = Player(
                    team_id=team.id,
                    name=p.name,
                    display_name=display,
                    number=p.number,
                    type=p.type,
                    group=p.group,
                )
                db.add(player)
                stats["players_created"] += 1

        db.commit()

    return {"status": "ok", "stats": stats}


@router.get("/teams")
def list_teams(db: Session = Depends(get_db)):
    """List all teams with player counts."""
    teams = db.query(Team).all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "slug": t.slug,
            "league_id": t.league_id,
            "player_count": len(t.players),
        }
        for t in teams
    ]


@router.get("/teams/{team_id}/players")
def list_players(team_id: int, db: Session = Depends(get_db)):
    """List players for a specific team."""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return [
        {
            "id": p.id,
            "name": p.name,
            "display_name": p.display_name,
            "number": p.number,
            "type": p.type,
            "group": p.group,
            "is_active": p.is_active,
        }
        for p in team.players
    ]


class PlayerUpdate(BaseModel):
    name: str | None = None
    display_name: str | None = None
    number: int | None = None
    type: str | None = None
    group: str | None = None
    is_active: bool | None = None


@router.put("/players/{player_id}")
def update_player(player_id: int, payload: PlayerUpdate, db: Session = Depends(get_db)):
    """Update a specific player."""
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
        
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(player, key, value)
        
    db.commit()
    db.refresh(player)
    
    return {"status": "ok", "player": {
        "id": player.id,
        "name": player.name,
        "display_name": player.display_name,
        "number": player.number,
        "type": player.type,
        "group": player.group,
        "is_active": player.is_active,
    }}


@router.delete("/players/{player_id}")
def delete_player(player_id: int, db: Session = Depends(get_db)):
    """Delete a specific player."""
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
        
    db.delete(player)
    db.commit()
    
    return {"status": "ok", "deleted": True}
