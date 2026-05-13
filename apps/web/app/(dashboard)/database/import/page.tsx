"use client";

import { useState, useRef, type DragEvent } from "react";

interface ParsedRow { [key: string]: string; }

const EXPECTED_COLUMNS = ["Team", "Player Name", "Display Name", "Number", "Type", "Group"];

function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const firstLine = lines[0]!;
  const sep = firstLine.includes("\t") ? "\t" : ",";
  const headers = firstLine.split(sep).map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((line) => {
    const vals = line.split(sep).map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: ParsedRow = {};
    headers.forEach((h, i) => { row[h] = vals[i] || ""; });
    return row;
  });
  return { headers, rows };
}

function autoMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const lower = headers.map((h) => h.toLowerCase());
  const tryMatch = (target: string, patterns: string[]) => {
    const idx = lower.findIndex((h) => patterns.some((p) => h.includes(p)));
    if (idx >= 0) map[target] = headers[idx]!;
  };
  tryMatch("Team", ["team"]);
  tryMatch("Player Name", ["player", "name", "full_name", "fullname"]);
  tryMatch("Display Name", ["display", "jersey_name", "display_name"]);
  tryMatch("Number", ["number", "num", "#", "jersey"]);
  tryMatch("Type", ["type", "category", "status"]);
  tryMatch("Group", ["group", "sport", "league"]);
  return map;
}

function validateRow(row: ParsedRow, mapping: Record<string, string>): "valid" | "warning" | "error" {
  const name = row[mapping["Player Name"] || ""] || "";
  const num = row[mapping["Number"] || ""] || "";
  if (!name || !num) return "error";
  if (isNaN(Number(num))) return "warning";
  return "valid";
}

export default function CSVImportPage() {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = (f: File) => {
    setFile(f);
    setImportDone(false);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers: h, rows: r } = parseCSV(text);
      setHeaders(h);
      setRows(r);
      setMapping(autoMap(h));
    };
    reader.readAsText(f);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith(".csv")) processFile(f);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
    e.target.value = "";
  };

  const updateMapping = (target: string, source: string) => {
    setMapping((prev) => ({ ...prev, [target]: source }));
  };

  const stats = {
    total: rows.length,
    teams: new Set(rows.map((r) => r[mapping["Team"] || ""]?.trim()).filter(Boolean)).size,
    valid: rows.filter((r) => validateRow(r, mapping) === "valid").length,
    warnings: rows.filter((r) => validateRow(r, mapping) === "warning").length,
    errors: rows.filter((r) => validateRow(r, mapping) === "error").length,
  };

  const handleImport = async () => {
    setImporting(true);
    await new Promise((r) => setTimeout(r, 1500));
    setImporting(false);
    setImportDone(true);
  };

  const reset = () => {
    setFile(null); setHeaders([]); setRows([]); setMapping({}); setImportDone(false);
  };

  const STATUS_ICON: Record<string, string> = { valid: "✅", warning: "⚠️", error: "❌" };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Import Teams & Players</h2>
          <a href="/database" className="btn btn-secondary">← Back to Database</a>
        </div>

        {/* Step 1: Upload CSV */}
        {!file && (
          <div
            className={`csv-dropzone ${dragOver ? "dragover" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input ref={inputRef} type="file" accept=".csv" onChange={handleFileInput} style={{ display: "none" }} />
            <div className="csv-dropzone-icon">📄</div>
            <div className="csv-dropzone-title">Drop your CSV file here</div>
            <div className="csv-dropzone-hint">or click to browse — accepts .csv files</div>
            <div className="csv-dropzone-format">
              Expected columns: Team, Player Name, Display Name, Number, Type, Group
            </div>
          </div>
        )}

        {/* Step 2: Preview & Map */}
        {file && !importDone && (
          <>
            {/* File Info */}
            <div className="csv-file-bar">
              <span>📄 <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)</span>
              <button className="btn btn-ghost" onClick={reset}>✕ Remove</button>
            </div>

            {/* Stats */}
            <div className="upload-stats-bar" style={{ marginTop: 12 }}>
              <span className="upload-stat-chip">📊 Rows: <strong>{stats.total}</strong></span>
              <span className="upload-stat-chip">🏈 Teams: <strong>{stats.teams}</strong></span>
              <span className="upload-stat-chip" style={{ color: "var(--success)" }}>✅ Valid: <strong>{stats.valid}</strong></span>
              {stats.warnings > 0 && <span className="upload-stat-chip" style={{ color: "#A16207" }}>⚠️ Warnings: <strong>{stats.warnings}</strong></span>}
              {stats.errors > 0 && <span className="upload-stat-chip" style={{ color: "var(--error)" }}>❌ Errors: <strong>{stats.errors}</strong></span>}
            </div>

            {/* Column Mapping */}
            <div className="csv-mapping-section">
              <div className="csv-mapping-title">Column Mapping</div>
              <div className="csv-mapping-grid">
                {EXPECTED_COLUMNS.map((col) => (
                  <div key={col} className="csv-mapping-item">
                    <label className="csv-mapping-label">{col}</label>
                    <select className="input" style={{ height: 32, fontSize: 12 }} value={mapping[col] || ""} onChange={(e) => updateMapping(col, e.target.value)}>
                      <option value="">— unmapped —</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Data Preview Table */}
            <div className="table-wrapper" style={{ marginTop: 16, maxHeight: 400, overflowY: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th style={{ width: 40 }}>Status</th>
                    {headers.map((h) => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 100).map((row, i) => {
                    const status = validateRow(row, mapping);
                    return (
                      <tr key={i} className={`csv-row-${status}`}>
                        <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{i + 1}</td>
                        <td>{STATUS_ICON[status]}</td>
                        {headers.map((h) => <td key={h}>{row[h]}</td>)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {rows.length > 100 && (
                <div style={{ padding: 12, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                  Showing first 100 of {rows.length} rows
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={reset}>Cancel</button>
              <button className="btn btn-primary" onClick={handleImport} disabled={importing || stats.errors === stats.total}>
                {importing ? <><span className="upload-spinner" /> Importing…</> : <>📥 Import {stats.valid} Players</>}
              </button>
            </div>
          </>
        )}

        {/* Step 3: Done */}
        {importDone && (
          <div className="empty-state" style={{ padding: 48 }}>
            <div className="empty-state-icon">🎉</div>
            <div className="empty-state-title">Import Complete!</div>
            <div className="empty-state-text">Successfully imported {stats.valid} players across {stats.teams} teams</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button className="btn btn-secondary" onClick={reset}>Import Another</button>
              <a href="/database" className="btn btn-primary">View Database →</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
