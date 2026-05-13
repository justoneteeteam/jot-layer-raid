export default function RosterApprovalPage() {
  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Roster Approval</h2>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">✅</div>
          <div className="empty-state-title">No pending changes</div>
          <div className="empty-state-text">When new players are detected via CSV import or Yahoo scraper, they will appear here for approval.</div>
        </div>
      </div>
    </div>
  );
}
