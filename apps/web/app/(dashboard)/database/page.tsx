"use client";

import { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api-worker.justoneteeteam.workers.dev";

interface Team {
  id: number;
  name: string;
  slug: string;
  player_count: number;
}

interface Player {
  id: number;
  name: string;
  display_name: string;
  number: number;
  type: string;
  group: string;
  is_active: boolean;
}

export default function DatabasePage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingPlayers, setLoadingPlayers] = useState(false);

  // Fetch teams on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/database/teams`)
      .then((res) => res.json())
      .then((data: Team[]) => {
        // Sort teams alphabetically
        const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
        setTeams(sorted);
        setLoadingTeams(false);
        if (sorted.length > 0) {
          setSelectedTeam(sorted[0] || null);
        }
      })
      .catch((err) => {
        console.error("Failed to load teams:", err);
        setLoadingTeams(false);
      });
  }, []);

  // Fetch players when a team is selected
  useEffect(() => {
    if (!selectedTeam) return;
    setLoadingPlayers(true);
    fetch(`${API_BASE}/api/database/teams/${selectedTeam.id}/players`)
      .then((res) => res.json())
      .then((data: Player[]) => {
        setPlayers(data);
        setLoadingPlayers(false);
      })
      .catch((err) => {
        console.error("Failed to load players:", err);
        setLoadingPlayers(false);
      });
  }, [selectedTeam]);

  const handleDeletePlayer = async (playerId: number) => {
    if (!window.confirm("Are you sure you want to delete this player?")) return;
    
    try {
      const res = await fetch(`${API_BASE}/api/database/players/${playerId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPlayers((prev) => prev.filter(p => p.id !== playerId));
      } else {
        alert("Failed to delete player");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting player");
    }
  };

  const handleEditPlayer = async (player: Player) => {
    const newName = window.prompt("Enter new name:", player.name);
    if (newName === null) return;
    
    const newNumberStr = window.prompt("Enter new number:", player.number.toString());
    if (newNumberStr === null) return;
    
    const newNumber = parseInt(newNumberStr, 10);
    if (isNaN(newNumber)) {
      alert("Invalid number");
      return;
    }
    
    try {
      const res = await fetch(`${API_BASE}/api/database/players/${player.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: newName,
          number: newNumber
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setPlayers((prev) => prev.map(p => p.id === player.id ? data.player : p));
      } else {
        alert("Failed to update player");
      }
    } catch (err) {
      console.error(err);
      alert("Error updating player");
    }
  };

  return (
    <div style={{ display: "flex", gap: 24, height: "calc(100vh - 120px)" }}>
      {/* Sidebar: Teams */}
      <div className="card" style={{ width: 280, display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-default)", background: "var(--bg-secondary)", fontWeight: 600 }}>
          NFL Teams ({teams.length})
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {loadingTeams ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-secondary)" }}>Loading teams...</div>
          ) : teams.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-secondary)" }}>No teams found</div>
          ) : (
            teams.map((team) => (
              <div
                key={team.id}
                className={`nav-item ${selectedTeam?.id === team.id ? "active" : ""}`}
                style={{ borderRadius: 0, margin: "4px 8px", cursor: "pointer", display: "flex", justifyContent: "space-between" }}
                onClick={() => setSelectedTeam(team)}
              >
                <span>🏈 {team.name}</span>
                <span style={{ fontSize: "0.8em", color: "var(--text-secondary)" }}>{team.player_count}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Area: Players */}
      <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div className="card-header" style={{ marginBottom: 0 }}>
          <h2 className="card-title">
            {selectedTeam ? `${selectedTeam.name} Roster` : "Select a Team"}
          </h2>
          <div style={{ display: "flex", gap: 8 }}>
            <a href="/database/import" className="btn btn-secondary">📄 Import CSV</a>
            <button className="btn btn-secondary">🌐 Sync from Yahoo</button>
          </div>
        </div>
        
        <div style={{ overflowY: "auto", flex: 1 }}>
          {loadingPlayers ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>Loading players...</div>
          ) : players.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>
              {selectedTeam ? "No players found for this team." : "Please select a team from the sidebar."}
            </div>
          ) : (
            <table className="table-wrapper" style={{ width: "100%", marginTop: 16 }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Number</th>
                  <th>Type</th>
                  <th>Group</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {players.map(player => (
                  <tr key={player.id}>
                    <td style={{ fontWeight: 500 }}>{player.name}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 16 }}>{player.number}</td>
                    <td>
                      <span className={`badge ${player.type === 'Legend' ? 'badge-warning' : 'badge-info'}`}>
                        {player.type}
                      </span>
                    </td>
                    <td>{player.group}</td>
                    <td>
                      <span className={`badge ${player.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {player.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-ghost" onClick={() => handleEditPlayer(player)}>✏️</button>
                      <button className="btn btn-ghost" onClick={() => handleDeletePlayer(player.id)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
