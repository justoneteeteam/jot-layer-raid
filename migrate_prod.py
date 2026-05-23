import psycopg2

DATABASE_URL = "postgresql://postgres:OkUsvfhDHnglhQPtNohTEqlOhqhFRjfd@yamabiko.proxy.rlwy.net:34152/railway"

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# Verify columns exist
cur.execute("""
    SELECT column_name, data_type, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'mockup_templates' 
    ORDER BY ordinal_position
""")
print("mockup_templates columns:")
for row in cur.fetchall():
    print(f"  {row[0]:25s} | {row[1]:15s} | default: {row[2]}")

cur.close()
conn.close()
