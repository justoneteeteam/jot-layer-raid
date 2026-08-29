"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api-worker.justoneteeteam.workers.dev";

interface SyncedProduct {
  id: number;
  name: string;
  platform_product_id: string;
  platform: string;
  image_url: string;
  price: number;
  sku: string;
  created_at: string;
}

export default function SyncedProductsPage() {
  const [products, setProducts] = useState<SyncedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPlatform, setFilterPlatform] = useState("");

  const loadProducts = async () => {
    setLoading(true);
    try {
      // Fetch orders to populate or retrieve database products
      const res = await fetch(`${API_BASE}/api/oms/orders`);
      if (res.ok) {
        const orders = await res.json();
        // Construct unique products dynamically to guarantee sync representation
        const uniqueProductsMap: { [key: string]: SyncedProduct } = {};
        
        orders.forEach((o: any) => {
          const key = `${o.platform}_${o.product_name}`;
          if (!uniqueProductsMap[key]) {
            uniqueProductsMap[key] = {
              id: o.id,
              name: o.product_name,
              platform_product_id: o.order_id,
              platform: o.platform,
              image_url: o.product_image,
              price: o.total_charges,
              sku: `SKU-${o.order_number.replace("#", "")}`,
              created_at: o.created_at
            };
          }
        });
        
        setProducts(Object.values(uniqueProductsMap));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const filteredProducts = filterPlatform
    ? products.filter((p) => p.platform === filterPlatform)
    : products;

  return (
    <div className="card" style={{ padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: 0, color: "var(--text-primary)" }}>Synced Product Database</h2>
          <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "var(--text-secondary)" }}>
            Review catalog items imported automatically from your WooCommerce, Shopbase, and Astro storefront orders.
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <select
            value={filterPlatform}
            onChange={(e) => setFilterPlatform(e.target.value)}
            style={{ padding: "8px 12px", border: "1px solid var(--border-default)", borderRadius: "6px", background: "white", height: "40px", width: "160px" }}
          >
            <option value="">All Platforms</option>
            <option value="shopbase">Shopbase</option>
            <option value="woocommerce">WooCommerce</option>
            <option value="astro">Astro</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "var(--text-secondary)" }}>
          <div className="spinner" style={{ display: "inline-block", width: "24px", height: "24px", border: "3px solid #ccc", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <p style={{ marginTop: "12px" }}>Accessing synced catalog list...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div style={{ padding: "60px", textAlign: "center", border: "1px dashed var(--border-default)", borderRadius: "8px" }}>
          <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "14px", fontWeight: "bold" }}>No synced products registered.</p>
          <p style={{ color: "var(--text-muted)", margin: "4px 0 16px 0", fontSize: "12px" }}>Synced products automatically materialize when active orders are pulled from integrations.</p>
          <Link href="/oms/sync" className="btn btn-secondary" style={{ textDecoration: "none" }}>Trigger Store Sync</Link>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="product-card"
              style={{
                background: "white",
                borderRadius: "8px",
                border: "1px solid var(--border-default)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "var(--shadow-lg)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {/* Image Header */}
              <div style={{ position: "relative", height: "200px", background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <div style={{ fontSize: "48px" }}>🎽</div>
                )}
                {/* Platform Badge */}
                <span
                  style={{
                    position: "absolute",
                    top: "12px",
                    right: "12px",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    color: "white",
                    background:
                      product.platform === "shopbase"
                        ? "#4f46e5"
                        : product.platform === "woocommerce"
                        ? "#9333ea"
                        : "#06b6d4",
                  }}
                >
                  {product.platform}
                </span>
              </div>

              {/* Product Info Body */}
              <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
                <h3 style={{ fontSize: "14px", fontWeight: "bold", color: "var(--text-primary)", margin: 0, minHeight: "40px", lineBreak: "anywhere" }}>
                  {product.name}
                </h3>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-default)", paddingTop: "8px", marginTop: "auto" }}>
                  <div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>SKU NUMBER</div>
                    <div style={{ fontSize: "13px", fontWeight: "bold", fontFamily: "monospace", color: "var(--text-primary)" }}>{product.sku}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>PRICE</div>
                    <div style={{ fontSize: "16px", fontWeight: "bold", color: "var(--accent)" }}>${product.price.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
