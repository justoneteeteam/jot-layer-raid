"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Dashboard", icon: "📊", href: "/" },
  { section: "MOCKUPS" },
  { label: "AI Creator", icon: "🤖", href: "/mockups/create" },
  { label: "Templates", icon: "📁", href: "/mockups" },
  { label: "Fonts", icon: "🔤", href: "/fonts" },
  { label: "Patches", icon: "🏷️", href: "/patches" },
  { section: "DATABASE" },
  { label: "Teams & Players", icon: "🏈", href: "/database" },
  { label: "Roster Approval", icon: "✅", href: "/roster/approval" },
  { section: "PRODUCTION" },
  { label: "Bulk Generator", icon: "⚙️", href: "/bulk" },
  { section: "ORDER MANAGEMENT (OMS)" },
  { label: "Orders & Sync", icon: "📦", href: "/oms" },
  { label: "WeChat Tracking", icon: "📁", href: "/oms/wechat" },
  { label: "Customer CRM", icon: "👥", href: "/oms/customers" },
  { label: "Product Catalog", icon: "🎽", href: "/oms/products" },
  { label: "Email", icon: "✉️", href: "/oms/tickets" },
  { section: "SYSTEM" },
  { label: "Settings", icon: "🔧", href: "/settings" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          🎽 <span>JOTLayerRaid</span>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item, i) => {
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
            {navItems.find(
              (item) =>
                "href" in item &&
                (item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href!))
            )?.label || "JOTLayerRaid"}
          </div>
          <div className="topbar-actions">
            <button className="btn btn-ghost">admin</button>
            <button className="btn btn-secondary">Logout</button>
          </div>
        </header>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
