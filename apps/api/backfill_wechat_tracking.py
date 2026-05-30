import os
import re
import sqlite3
import pypdf

# Paths
DB_PATH = "jotlayerraid.db"
WECHAT_BASE_DIR = "/Users/lukepham/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_i5tyisy8lh9422_a7fc/msg/file"

def extract_tracking_and_name(pdf_path):
    try:
        reader = pypdf.PdfReader(pdf_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
            
        # 1. Extract tracking number (Yanwen or USPS)
        tracking_number = ""
        postal_match = re.search(r"\b([A-Z]{2}\d{9}[A-Z]{2})\b", text.upper())
        if postal_match:
            tracking_number = postal_match.group(1)
        else:
            candidates = re.findall(r"\b9\d[\s\d]{20,28}\d\b", text)
            for cand in candidates:
                digits = "".join(re.findall(r"\d", cand))
                if len(digits) == 22:
                    tracking_number = digits
                    break
            if not tracking_number:
                grouped_match = re.search(r"\b(?:\d\s*){22}\b", text)
                if grouped_match:
                    tracking_number = "".join(grouped_match.group(0).split())
                    
        # 2. Extract recipient name candidate
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        name_candidate = ""
        
        # Check for To: or TO: indicator (standard in Yanwen labels)
        for i, line in enumerate(lines):
            if line.upper().rstrip(":") == "TO" and i + 1 < len(lines):
                name_candidate = lines[i+1].strip()
                # Clean up if it contains numbers or standard addresses
                if len(name_candidate.split()) >= 2 and not any(char.isdigit() for char in name_candidate):
                    break
                else:
                    name_candidate = ""

        if not name_candidate:
            for line in lines:
                if line.isupper() and len(line.split()) >= 2 and "DEPT" not in line and "USPS" not in line and "GROUND" not in line and "TO:" not in line:
                    name_candidate = line.title()
                    break
                    
        if not name_candidate:
            for line in lines:
                if len(line.split()) in [2, 3] and line.isupper() and "SHIPPING" not in line:
                    name_candidate = line.title()
                    break
                    
        return tracking_number, name_candidate
    except Exception as e:
        print(f"Error reading PDF {pdf_path}: {e}")
        return "", ""

def main():
    if not os.path.exists(WECHAT_BASE_DIR):
        print(f"Error: WeChat directory does not exist at {WECHAT_BASE_DIR}")
        return
        
    print(f"Connecting to database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Query all orders in database
    orders = cursor.execute("SELECT id, customer_name, order_id, tracking_number, shipping_status FROM orders;").fetchall()
    print(f"Loaded {len(orders)} orders from database.")
    
    # Create name-to-order mapping
    order_map = {}
    for o in orders:
        name_key = o[1].lower().strip()
        if name_key:
            if name_key not in order_map:
                order_map[name_key] = []
            order_map[name_key].append(o)
            
    scanned_count = 0
    matched_count = 0
    updated_count = 0
    
    # Traverse WeChat month folders
    print(f"\nScanning through subdirectories in: {WECHAT_BASE_DIR}")
    for item in sorted(os.listdir(WECHAT_BASE_DIR)):
        item_path = os.path.join(WECHAT_BASE_DIR, item)
        # Check if folder name matches YYYY-MM format (e.g. 2026-01)
        if os.path.isdir(item_path) and re.match(r"^\d{4}-\d{2}$", item):
            print(f"Scanning month folder: {item}")
            for filename in os.listdir(item_path):
                if filename.lower().endswith(".pdf"):
                    pdf_path = os.path.join(item_path, filename)
                    scanned_count += 1
                    
                    tracking, name = extract_tracking_and_name(pdf_path)
                    if tracking and name:
                        name_key = name.lower().strip()
                        if name_key in order_map:
                            matched_orders = order_map[name_key]
                            matched_count += 1
                            for o in matched_orders:
                                o_id, o_name, o_ref, o_track, o_status = o
                                # Only update if it doesn't already have this tracking number
                                if o_track != tracking:
                                    cursor.execute(
                                        "UPDATE orders SET tracking_number = ?, shipping_status = 'in transit' WHERE id = ?;",
                                        (tracking, o_id)
                                    )
                                    print(f"  -> SUCCESS MATCH: {name} | Order {o_ref} | Set Tracking: {tracking}")
                                    updated_count += 1
                                    
    conn.commit()
    conn.close()
    
    print("\n" + "="*40)
    print("BACKFILL SCAN COMPLETED SUMMARY:")
    print(f"Total PDF Shipping Slips Scanned: {scanned_count}")
    print(f"Total Customer Name Matches Found: {matched_count}")
    print(f"Total Database Order Records Injected/Updated: {updated_count}")
    print("="*40)

if __name__ == "__main__":
    main()
