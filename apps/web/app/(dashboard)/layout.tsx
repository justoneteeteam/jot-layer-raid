"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../components/AuthProvider";

const navItems = [
  { label: "Dashboard", icon: "📊", href: "/" },
  { section: "MOCKUPS" },
  { label: "Templates", icon: "📁", href: "/mockups" },
  { label: "Fonts", icon: "🔤", href: "/fonts" },
  { label: "Patches", icon: "🏷️", href: "/patches" },
  { section: "DATABASE" },
  { label: "Teams & Players", icon: "🏈", href: "/database" },
  { label: "Roster Approval", icon: "✅", href: "/roster/approval" },
  { section: "PRODUCTION" },
  { label: "Bulk Generator", icon: "⚙️", href: "/bulk" },
  { section: "PINTEREST" },
  { label: "AI Studio", icon: "📌", href: "/pinterest" },
  { label: "Niche Libraries", icon: "📚", href: "/pinterest/niches" },
  { label: "Batch Generate", icon: "⚡", href: "/pinterest/batch" },
  { label: "Image Generator", icon: "🎨", href: "/pinterest/generate" },
  { label: "Trend Queue", icon: "📊", href: "/pinterest/trends" },
  { label: "Style Library", icon: "📝", href: "/pinterest/prompts" },
  { label: "Theme Library", icon: "🎭", href: "/pinterest/themes" },
  { label: "History", icon: "🕐", href: "/pinterest/history" },
  { label: "RSS Feeds", icon: "📡", href: "/pinterest/rss" },
  { label: "Auto-Pilot", icon: "⚡", href: "/pinterest/autopilot" },
  { label: "Settings", icon: "🔧", href: "/pinterest/settings" },
  { section: "ORDER MANAGEMENT (OMS)" },
  { label: "Orders & Sync", icon: "📦", href: "/oms" },
  { label: "P&L Financial Report", icon: "📈", href: "/oms/reports" },
  { label: "WeChat Tracking", icon: "📁", href: "/oms/wechat" },
  { label: "Customer CRM", icon: "👥", href: "/oms/customers" },
  { label: "Product Catalog", icon: "🎽", href: "/oms/products" },
  { label: "Email", icon: "✉️", href: "/oms/tickets" },
  { section: "MARKETING" },
  { label: "Campaigns & Lists", icon: "📧", href: "/marketing" },
  { label: "Automations", icon: "⚡", href: "/marketing/automations" },
  { section: "SYSTEM" },
  { label: "Settings", icon: "🔧", href: "/settings" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, role, token, loading, logout } = useAuth();

  if (loading || !token) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "var(--bg-secondary)" }}>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          .spinner {
            width: 32px;
            height: 32px;
            border: 3px solid var(--border-default);
            border-radius: 50%;
            border-top-color: var(--accent);
            animation: spin 0.8s linear infinite;
          }
        `}} />
        <div className="spinner"></div>
      </div>
    );
  }

  // Filter navigation items for sub_user (exclude Orders & Sync)
  const isSubUser = role === "sub_user";
  const filteredNavItems = navItems.filter((item) => {
    if ("href" in item) {
      if (isSubUser && (item.href === "/oms" || item.href === "/oms/sync")) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          🎽 <span>JOTLayerRaid</span>
        </div>
        <nav className="sidebar-nav">
          {filteredNavItems.map((item, i) => {
            if ("section" in item) {
              return (
                <div key={i} className="sidebar-section-label">
                  {item.section}
                </div>
              );
            }
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href!);
            return (
              <Link
                key={item.href}
                href={item.href!}
                className={`nav-item ${isActive ? "active" : ""}`}
              >
                <span className="nav-item-icon">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="main-wrapper">
        <header className="topbar">
          <div className="topbar-title">
            {filteredNavItems.find(
              (item) =>
                "href" in item &&
                (item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href!))
            )?.label || "JOTLayerRaid"}
          </div>
          <div className="topbar-actions" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{
              fontSize: "11px",
              padding: "3px 8px",
              borderRadius: "12px",
              fontWeight: 600,
              textTransform: "uppercase",
              background: isSubUser ? "rgba(234, 179, 8, 0.15)" : "rgba(13, 148, 136, 0.15)",
              color: isSubUser ? "#D97706" : "var(--accent)",
              border: isSubUser ? "1px solid rgba(217, 119, 6, 0.3)" : "1px solid rgba(13, 148, 136, 0.3)"
            }}>
              {isSubUser ? "Sub User" : "Admin"}
            </span>
            <button className="btn btn-ghost" style={{ cursor: "default" }}>{user || "user"}</button>
            <button className="btn btn-secondary" onClick={logout}>Logout</button>
          </div>
        </header>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
