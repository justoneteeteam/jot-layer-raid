export default function DatabasePage() {
  const mockPlayers = [
    { id: 1, name: "Jalen Hurts", number: 1, type: "Current", group: "Football" },
    { id: 2, name: "A.J. Brown", number: 11, type: "Current", group: "Football" },
    { id: 3, name: "DeVonta Smith", number: 6, type: "Current", group: "Football" },
    { id: 4, name: "Jason Kelce", number: 62, type: "Legend", group: "Football" },
    { id: 5, name: "Randall Cunningham", number: 12, type: "Legend", group: "Football" },
  ];

  return (
    <div style={{ display: "flex", gap: 24, height: "calc(100vh - 120px)" }}>
      {/* Sidebar: Teams */}
      <div className="card" style={{ width: 280, display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-default)", background: "var(--bg-secondary)", fontWeight: 600 }}>
          NFL Teams
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          <div className="nav-item active" style={{ borderRadius: 0, margin: "4px 8px" }}>🦅 Philadelphia Eagles</div>
          <div className="nav-item" style={{ borderRadius: 0, margin: "4px 8px" }}>⭐ Dallas Cowboys</div>
          <div className="nav-item" style={{ borderRadius: 0, margin: "4px 8px" }}>🌉 San Francisco 49ers</div>
          <div className="nav-item" style={{ borderRadius: 0, margin: "4px 8px" }}>🦅 Seattle Seahawks</div>
        </div>
      </div>

      {/* Main Area: Players */}
      <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div className="card-header" style={{ marginBottom: 0 }}>
          <h2 className="card-title">Philadelphia Eagles Roster</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <a href="/database/import" className="btn btn-secondary">📄 Import CSV</a>
            <button className="btn btn-secondary">🌐 Sync from Yahoo</button>
          </div>
        </div>
        
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
            {mockPlayers.map(player => (
              <tr key={player.id}>
                <td style={{ fontWeight: 500 }}>{player.name}</td>
                <td style={{ fontFamily: "monospace", fontSize: 16 }}>{player.number}</td>
                <td><span className={`badge ${player.type === 'Legend' ? 'badge-warning' : 'badge-info'}`}>{player.type}</span></td>
                <td>{player.group}</td>
                <td><span className="badge badge-success">Active</span></td>
                <td>
                  <button className="btn btn-ghost">✏️</button>
                  <button className="btn btn-ghost">🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
