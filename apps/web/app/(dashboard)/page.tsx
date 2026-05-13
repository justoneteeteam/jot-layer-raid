export default function DashboardPage() {
  return (
    <div>
      {/* Stats Overview */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🏈</div>
          <div className="stat-label">NFL Teams</div>
          <div className="stat-value">32</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">👤</div>
          <div className="stat-label">Players</div>
          <div className="stat-value">0</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📁</div>
          <div className="stat-label">Templates</div>
          <div className="stat-value">0</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⚙️</div>
          <div className="stat-label">Bulk Jobs</div>
          <div className="stat-value">0</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🛒</div>
          <div className="stat-label">Stores Connected</div>
          <div className="stat-value">0</div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Recent Activity</h2>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">🚀</div>
          <div className="empty-state-title">Welcome to JOTLayerRaid</div>
          <div className="empty-state-text">
            Start by uploading a jersey image in the AI Creator, or import your player database.
          </div>
          <a href="/mockups/create" className="btn btn-primary">
            🤖 Open AI Creator
          </a>
        </div>
      </div>
    </div>
  );
}
