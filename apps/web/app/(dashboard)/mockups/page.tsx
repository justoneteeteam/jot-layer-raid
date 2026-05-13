"use client";

import { useRouter } from "next/navigation";

export default function MockupsPage() {
  const router = useRouter();

  const mockTemplates = [
    { id: 1, name: "Eagles Home Green", team: "Philadelphia Eagles", image: "/jerseys/eagles_home_green.png" },
    { id: 2, name: "Cowboys Away White", team: "Dallas Cowboys", image: "/jerseys/cowboys_away_white.png" },
    { id: 3, name: "Ravens Alternate Black", team: "Baltimore Ravens", image: "/jerseys/ravens_alternate_black.png" },
  ];

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Mockup Templates</h2>
          <a href="/mockups/create" className="btn btn-primary">🤖 AI Creator</a>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 24 }}>
          {mockTemplates.map((tpl) => (
            <div key={tpl.id} style={{ border: "1px solid var(--border-default)", borderRadius: 8, overflow: "hidden" }}>
              <img src={tpl.image} alt={tpl.name} style={{ width: "100%", height: 300, objectFit: "cover" }} />
              <div style={{ padding: 16 }}>
                <div style={{ fontWeight: 600 }}>{tpl.name}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{tpl.team}</div>
                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, padding: "4px 8px" }}
                    onClick={() => router.push(`/mockups/${tpl.id}/edit`)}
                  >
                    ✏️ Edit
                  </button>
                  <button className="btn btn-secondary" style={{ flex: 1, padding: "4px 8px" }}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
