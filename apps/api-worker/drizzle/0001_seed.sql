-- Seed Leagues
INSERT INTO leagues (id, name, slug) VALUES (1, 'NFL', 'nfl');
INSERT INTO leagues (id, name, slug) VALUES (2, 'MLB', 'mlb');
INSERT INTO leagues (id, name, slug) VALUES (3, 'NCAA', 'ncaa');
INSERT INTO leagues (id, name, slug) VALUES (4, 'NHL', 'nhl');

-- Seed NFL Teams
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (1, 1, 'Philadelphia Eagles', 'NFC East', 'eagles', '#004C54', '#A5ACAF', 'https://ca.sports.yahoo.com/nfl/teams/philadelphia/roster/');
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (2, 1, 'Cincinnati Bengals', 'AFC North', 'bengals', '#FB4F14', '#000000', 'https://ca.sports.yahoo.com/nfl/teams/cincinnati/roster/');
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (3, 1, 'Las Vegas Raiders', 'AFC West', 'raiders', '#000000', '#A5ACAF', 'https://ca.sports.yahoo.com/nfl/teams/las-vegas/roster/');
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (4, 1, 'Baltimore Ravens', 'AFC North', 'ravens', '#241773', '#9E7C0C', 'https://ca.sports.yahoo.com/nfl/teams/baltimore/roster/');
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (5, 1, 'Tennessee Titans', 'AFC South', 'titans', '#0C2340', '#4B92DB', 'https://ca.sports.yahoo.com/nfl/teams/tennessee/roster/');
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (6, 1, 'Pittsburgh Steelers', 'AFC North', 'steelers', '#FFB612', '#101820', 'https://ca.sports.yahoo.com/nfl/teams/pittsburgh/roster/');
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (7, 1, 'Arizona Cardinals', 'NFC West', 'cardinals', '#97233F', '#000000', 'https://ca.sports.yahoo.com/nfl/teams/arizona/roster/');
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (8, 1, 'Atlanta Falcons', 'NFC South', 'falcons', '#A71930', '#000000', 'https://ca.sports.yahoo.com/nfl/teams/atlanta/roster/');
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (9, 1, 'Buffalo Bills', 'AFC East', 'bills', '#00338D', '#C60C30', 'https://ca.sports.yahoo.com/nfl/teams/buffalo/roster/');
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (10, 1, 'Kansas City Chiefs', 'AFC West', 'chiefs', '#E31837', '#FFB81C', 'https://ca.sports.yahoo.com/nfl/teams/kansas-city/roster/');
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (11, 1, 'Los Angeles Chargers', 'AFC West', 'chargers', '#0080C6', '#FFC20E', 'https://ca.sports.yahoo.com/nfl/teams/la-chargers/roster/');
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (12, 1, 'Green Bay Packers', 'NFC North', 'packers', '#203731', '#FFB612', 'https://ca.sports.yahoo.com/nfl/teams/green-bay/roster/');
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (13, 1, 'Chicago Bears', 'NFC North', 'bears', '#0B162A', '#C83803', 'https://ca.sports.yahoo.com/nfl/teams/chicago/roster/');
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (14, 1, 'Detroit Lions', 'NFC North', 'lions', '#0076B6', '#B0B7BC', 'https://ca.sports.yahoo.com/nfl/teams/detroit/roster/');
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (15, 1, 'Minnesota Vikings', 'NFC North', 'vikings', '#4F2683', '#FFC62F', 'https://ca.sports.yahoo.com/nfl/teams/minnesota/roster/');
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (16, 1, 'Cleveland Browns', 'AFC North', 'browns', '#311D00', '#FF3C00', 'https://ca.sports.yahoo.com/nfl/teams/cleveland/roster/');
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (17, 1, 'Carolina Panthers', 'NFC South', 'panthers', '#0085CA', '#101820', 'https://ca.sports.yahoo.com/nfl/teams/carolina/roster/');
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (18, 1, 'Tampa Bay Buccaneers', 'NFC South', 'buccaneers', '#D50A0A', '#34302B', 'https://ca.sports.yahoo.com/nfl/teams/tampa-bay/roster/');
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (19, 1, 'New Orleans Saints', 'NFC South', 'saints', '#D3BC8D', '#101820', 'https://ca.sports.yahoo.com/nfl/teams/new-orleans/roster/');
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (20, 1, 'Dallas Cowboys', 'NFC East', 'cowboys', '#041E42', '#869397', 'https://ca.sports.yahoo.com/nfl/teams/dallas/roster/');
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (21, 1, 'Washington Commanders', 'NFC East', 'commanders', '#5A1414', '#FFB612', 'https://ca.sports.yahoo.com/nfl/teams/washington/roster/');
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (22, 1, 'New York Giants', 'NFC East', 'giants', '#0B2265', '#A71930', 'https://ca.sports.yahoo.com/nfl/teams/ny-giants/roster/');
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (23, 1, 'Denver Broncos', 'AFC West', 'broncos', '#FB4F14', '#002244', 'https://ca.sports.yahoo.com/nfl/teams/denver/roster/');
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (24, 1, 'Houston Texans', 'AFC South', 'texans', '#03202F', '#A71930', 'https://ca.sports.yahoo.com/nfl/teams/houston/roster/');
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (25, 1, 'Indianapolis Colts', 'AFC South', 'colts', '#002C5F', '#A2AAAD', 'https://ca.sports.yahoo.com/nfl/teams/indianapolis/roster/');
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (26, 1, 'Jacksonville Jaguars', 'AFC South', 'jaguars', '#006778', '#9F792C', 'https://ca.sports.yahoo.com/nfl/teams/jacksonville/roster/');
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (27, 1, 'San Francisco 49ers', 'NFC West', '49ers', '#AA0000', '#B3995D', 'https://ca.sports.yahoo.com/nfl/teams/san-francisco/roster/');
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (28, 1, 'Los Angeles Rams', 'NFC West', 'rams', '#003594', '#FFA300', 'https://ca.sports.yahoo.com/nfl/teams/la-rams/roster/');
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (29, 1, 'Seattle Seahawks', 'NFC West', 'seahawks', '#002244', '#69BE28', 'https://ca.sports.yahoo.com/nfl/teams/seattle/roster/');
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (30, 1, 'Miami Dolphins', 'AFC East', 'dolphins', '#008E97', '#FC4C02', 'https://ca.sports.yahoo.com/nfl/teams/miami/roster/');
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (31, 1, 'New England Patriots', 'AFC East', 'patriots', '#002244', '#C60C30', 'https://ca.sports.yahoo.com/nfl/teams/new-england/roster/');
INSERT INTO teams (id, league_id, name, region, slug, primary_color, secondary_color, yahoo_roster_url) VALUES (32, 1, 'New York Jets', 'AFC East', 'jets', '#125740', '#000000', 'https://ca.sports.yahoo.com/nfl/teams/ny-jets/roster/');

-- Seed Default Admin User (admin / admin123)
INSERT INTO users (username, hashed_password, created_at) VALUES ('admin', '$2b$12$DmEPsAClVsw8CPHms2X7EuJFrA.xT3B8NP7aQtzIutCZCzZSmpUB6', CURRENT_TIMESTAMP);
