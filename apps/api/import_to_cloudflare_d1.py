import os
import pandas as pd
import requests

API_URL = "https://api-worker.justoneteeteam.workers.dev/api/database/import"

def main():
    print("Reading Excel file...")
    excel_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "NFL Database.xlsx")
    xls = pd.ExcelFile(excel_path)
    
    # Read Overall DB
    overall_df = pd.read_excel(xls, sheet_name="Overall DB")
    overall_df = overall_df.dropna(subset=['Team'])
    
    team_names = [str(t).strip() for t in overall_df['Team']]
    print(f"Found {len(team_names)} teams in Overall DB sheet")
    
    teams_payload = []
    
    for sheet_name in xls.sheet_names:
        if sheet_name == "Overall DB":
            continue
            
        print(f"Processing sheet: {sheet_name}")
        df = pd.read_excel(xls, sheet_name=sheet_name)
        
        # Adjust headers if necessary
        if 'Unnamed: 0' in df.columns and df.iloc[0, 0] == 'Name':
            df.columns = df.iloc[0]
            df = df[1:]
        elif df.columns[0] == 'Name':
            pass
            
        if 'Name' not in df.columns:
            print(f"  Skipping {sheet_name} - 'Name' column not found")
            continue
            
        players_list = []
        for _, row in df.iterrows():
            player_name = str(row['Name']).strip()
            if not player_name or player_name.lower() == 'nan':
                continue
                
            number = None
            if 'Number' in df.columns and pd.notna(row['Number']):
                try:
                    number = int(row['Number'])
                except ValueError:
                    pass
                    
            if number is None:
                continue
                
            p_type = "Current"
            if 'Type' in df.columns and pd.notna(row['Type']):
                p_type = str(row['Type']).strip()
                
            group = "Football"
            if 'Group' in df.columns and pd.notna(row['Group']):
                val = str(row['Group']).strip()
                if val.lower() == 'hockey':
                    group = "Football"
                else:
                    group = val
                    
            players_list.append({
                "name": player_name,
                "display_name": player_name.upper(),
                "number": number,
                "type": p_type,
                "group": group
            })
            
        if players_list:
            teams_payload.append({
                "name": sheet_name.strip(),
                "players": players_list
            })
            print(f"  Prepared {len(players_list)} players for {sheet_name}")
            
    payload = {
        "league": "NFL",
        "teams": teams_payload
    }
    
    print(f"Sending data for {len(teams_payload)} teams to API...")
    try:
        res = requests.post(API_URL, json=payload, headers={"Content-Type": "application/json"})
        if res.status_code == 200:
            print("Import successfully completed!")
            print(res.json())
        else:
            print(f"Failed to import: {res.status_code} - {res.text}")
    except Exception as e:
        print(f"Error making request: {e}")

if __name__ == "__main__":
    main()
