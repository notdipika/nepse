# NEPSE Dashboard

Nepal Stock Exchange analytics platform — Next.js 16 + MySQL + load_history.py

## Architecture

```
load_history.py (OmitNomis archive)
        │
        ▼ writes directly to MySQL
   nepse_db ──► Next.js API routes ──► React UI
   auth_db  ──► NextAuth sessions
```

## Stack
- **Frontend/Backend**: Next.js 16, React 19, Tailwind CSS 4
- **Auth**: NextAuth v5 (JWT, credentials)
- **Database**: MySQL 8 — `nepse_db` (stocks) + `auth_db` (users)
- **Data fetcher**: `load_history.py` — fetches from OmitNomis/ShareSansarScraper archive

## Setup

### 1. MySQL databases
```bash
mysql -u root -p < setup_databases.sql
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment
Edit `.env.local`:
```env
AUTH_SECRET=<generate with node -e "console.log(require('crypto').randomBytes(32).toString('base64'))">
AUTH_DB_PASSWORD=your_mysql_password
NEPSE_DB_PASSWORD=your_mysql_password
PYTHON_PATH=python          # or full path to your conda python
# HIST_LOADER_PATH=/path/to/load_history.py   # if not in project root
NEXTAUTH_URL=http://localhost:3000
```

### 4. Run
```bash
npm run dev
```

Visit http://localhost:3000 → register → dashboard opens → 
**30 days of data auto-loads** via `load_history.py --days 30` on first visit.

## Pages
| Page | Path | Description |
|------|------|-------------|
| Overview | `/dashboard` | Market summary, gainers/losers, all stocks |
| Analytics | `/dashboard/analytics` | Filter panel + **live SQL query viewer** |
| Portfolio | `/dashboard/portfolio` | Company dropdown with detailed metrics |
| Watchlist | `/dashboard/watchlist` | Tracked companies with OHLCV charts |
| Search | `/dashboard/search` | Symbol/name search |
| Stock | `/dashboard/stock/:symbol` | Individual company chart + stats |

## Data fetcher
`load_history.py` fetches from the OmitNomis ShareSansarScraper GitHub archive.

```bash
# Manual usage (the app calls this automatically):
python load_history.py --days 30
python load_history.py --from 2026-01-01 --to 2026-03-20
python load_history.py --from 2026-01-01 --symbol ADBL
```

## Python requirements
```bash
pip install mysql-connector-python pymysql pandas requests openpyxl
```

## Common errors
| Error | Fix |
|-------|-----|
| `AUTH_SECRET not set` | Add to .env.local |
| `ER_BAD_DB_ERROR` | Run setup_databases.sql |
| `load_history.py not found` | Set HIST_LOADER_PATH or place in project root |
| `No module named mysql.connector` | pip install mysql-connector-python |


Dips.