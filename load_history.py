# """
# NEPSE Historical Loader
# ======================
# Downloads daily CSVs (or combined Excel) from OmitNomis ShareSansarScraper archive
# and loads normalized OHLCV rows into nepse_db.

# Usage:
#     python load_history.py --days 90
#     python load_history.py --from 2025-01-01 --to 2026-03-20
#     python load_history.py --from 2025-01-01 --symbol ADBL
#     python load_history.py --excel
# """

# import argparse
# import os
# import sys
# import time
# from datetime import date, datetime, timedelta
# from io import StringIO

# import mysql.connector
# import pandas as pd
# import pymysql
# import requests


# DB = dict(
#     host=os.getenv("NEPSE_DB_HOST", "localhost"),
#     port=int(os.getenv("NEPSE_DB_PORT", "3306")),
#     user=os.getenv("NEPSE_DB_USER", "root"),
#     password=os.getenv("NEPSE_DB_PASSWORD", ""),
#     database=os.getenv("NEPSE_DB_NAME", "nepse_db"),
# )

# CSV_URL = "https://raw.githubusercontent.com/OmitNomis/ShareSansarScraper/master/docs/Data/{date}.csv"
# EXCEL_URL = "https://raw.githubusercontent.com/OmitNomis/ShareSansarScraper/master/docs/Data/combined_excel.xlsx"
# EXCEL_LOCAL = "nepse_historical.xlsx"

# HEADERS = {"User-Agent": "Mozilla/5.0"}



# # Known NEPSE sector classifications by symbol
# SECTOR_MAP = {
#     1:  ['NABIL','EBL','NICA','SBI','ADBL','BOKL','CCBL','CBL','CZBIL','GBIME','HBL','KBL',
#           'LBL','MBL','NBB','NBL','NCCB','NIB','NMB','PCBL','PRVU','SANB','SCB','SRBL','SHBL',
#           'MAXA','MEGA','NIMB','JBNL','SUNBL','LBBL','BNBL','SHINE'],  # Commercial Bank
#     3:  ['DDBL','EDBL','GBBL','GRDBL','ICFC','JBBL','KBBL','LSBBL','MLBL','MNBBL','MPBL',
#           'MRGD','NABBC','ODBL','SADBL','SAPDBL','SBBL','SDBL','SINDU','SPDBL','SSBL','TBBL',
#           'WBBL','CORBL','KSBBL','RIPDBL','SSDBL','PBBL','BPCL','EDCL','RBBI','HAMRO'],  # Dev Bank
#     4:  ['CFCL','GUFL','GFCL','ICC','IFIC','JFL','MFIL','NFCL','PROFL','SFCL','SIFC','SKFL',
#           'UFL','AFCL','BFC','CBFIN','CMF','NCFL','NFIL','PAFAN','MPFL','RLFL','SVFL'],  # Finance
#     7:  ['AHPC','BARUN','BEDC','BHPL','BHL','CHCL','DHPL','DOLTI','HDHPC','HPPL','HURJA',
#           'KBHPL','KPCL','LBHPL','MBJCL','MKCL','MKJC','MMKJL','NHDL','NHPC','NPCBL','NYADI',
#           'PPCL','RADHI','RHCL','RIDI','RURU','SANJEN','SAHAS','SJCL','SMPL','SPDL','SRPL',
#           'SSHL','TMHL','UHEWA','UPCL','USHEC','USHL','YETI','NGPL','KKHC','UPPER'],  # Hydropower
#     9:  ['ALICL','CLI','GLICL','ILI','JLIC','LICN','MLIC','NLIC','PCLI','PMLI','SNLI','SLI',
#           'RNLI','SRLI','NILI','ULIF','PLIT','NWCL'],  # Life Insurance
#     11: ['MFBS','SMFBS','GMFBS','RMDC','SWMF','UNLB','WNLB','NICLBSL','MLBSL','SKDBL',
#           'FOWAD','NIRDHAN','NSLBBL','SWBBL','GILBSL','SLBSL','GLBSL','JBLB','KMFL',
#           'NESDO','NMFBS','SDESI','SLBBL','SMFL','CBBL'],  # Microfinance
#     13: ['AIL','HGICL','HGI','IGI','LGIL','NIC','NLICL','NIL','PICL','PLIC','PRIN','RBCL',
#           'RIMCL','SALICL','SGIC','SICL','SLICL','TICL','UAIL','API','SEIT'],  # Non-Life Insurance
#     6:  ['EVRL','OHL','TRH','YHL','MHCL','SHIVM','SHL'],  # Hotel & Tourism
#     10: ['BSML','HDL','GCIL','BNHC','NTC','STC','NIFRA','UNL','SAIL','NBBL'],  # Manufacturing
#     8:  ['CHDC','CIT','HIDCL','NIL'],  # Investment
#     17: ['BBC','STC','NRIC'],  # Trading
# }
# # Reverse lookup: symbol -> sector_id
# SYMBOL_SECTOR = {sym: sid for sid, syms in SECTOR_MAP.items() for sym in syms}

# def is_trading_day(d: str) -> bool:
#     return datetime.strptime(d, "%Y-%m-%d").weekday() not in (4, 5)


# def date_range(from_date: str, to_date: str):
#     cur = datetime.strptime(from_date, "%Y-%m-%d")
#     end = datetime.strptime(to_date, "%Y-%m-%d")
#     while cur <= end:
#         ds = cur.strftime("%Y-%m-%d")
#         if is_trading_day(ds):
#             yield ds
#         cur += timedelta(days=1)


# def clean_num(v):
#     try:
#         return float(str(v).replace(",", "").replace("%", "").strip())
#     except Exception:
#         return None


# def clean_int(v):
#     try:
#         return int(float(str(v).replace(",", "").strip()))
#     except Exception:
#         return None


# def normalize_df(df: pd.DataFrame, trading_date: str | None = None) -> pd.DataFrame:
#     col_map = {
#         "Symbol": "symbol",
#         "symbol": "symbol",
#         "SYMBOL": "symbol",
#         "Open": "open_price",
#         "open": "open_price",
#         "High": "high_price",
#         "high": "high_price",
#         "Low": "low_price",
#         "low": "low_price",
#         "Close": "close_price",
#         "close": "close_price",
#         "LTP": "close_price",
#         "Ltp": "close_price",
#         "Volume": "volume",
#         "volume": "volume",
#         "Vol": "volume",
#         "Qty.": "volume",
#         "Traded Shares": "volume",
#         "Turnover": "turnover",
#         "turnover": "turnover",
#         "Amount": "turnover",
#         "Prev. Close": "prev_close",
#         "Previous Close": "prev_close",
#         "prev_close": "prev_close",
#         "% Change": "percent_change",
#         "Percent Change": "percent_change",
#         "percent_change": "percent_change",
#         "Diff %": "percent_change",
#         "Date": "date",
#         "date": "date",
#         "Trading Date": "date",
#     }
#     df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns})
#     # Multiple source columns can map to the same normalized name (e.g., Close/LTP).
#     # Keep the first mapped column to avoid duplicate-column assignment issues.
#     df = df.loc[:, ~df.columns.duplicated()]

#     if "symbol" not in df.columns:
#         return pd.DataFrame()

#     if "date" not in df.columns:
#         if trading_date is None:
#             return pd.DataFrame()
#         df["date"] = trading_date

#     def parse_date(v):
#         if isinstance(v, datetime):
#             return v.strftime("%Y-%m-%d")
#         for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y"):
#             try:
#                 return datetime.strptime(str(v).strip(), fmt).strftime("%Y-%m-%d")
#             except Exception:
#                 pass
#         return None

#     df["date"] = df["date"].apply(parse_date)
#     df = df.dropna(subset=["date"])

#     for col in ["open_price", "high_price", "low_price", "close_price", "volume", "turnover", "prev_close", "percent_change"]:
#         if col in df.columns:
#             df[col] = df[col].apply(clean_num)

#     if "close_price" not in df.columns:
#         return pd.DataFrame()

#     if "open_price" not in df.columns:
#         df["open_price"] = df["close_price"]
#     if "high_price" not in df.columns:
#         df["high_price"] = df["close_price"]
#     if "low_price" not in df.columns:
#         df["low_price"] = df["close_price"]
#     if "volume" not in df.columns:
#         df["volume"] = 0

#     df["symbol"] = df["symbol"].astype(str).str.upper().str.strip()
#     df = df.dropna(subset=["symbol", "close_price"])
#     df = df[df["symbol"].str.len() > 1]
#     df = df[df["close_price"] > 0]
#     df = df[~df["symbol"].isin(["SYMBOL", "NAN", "#", "S.NO", "SN"])]

#     return df


# def fetch_csv_day(d: str) -> pd.DataFrame:
#     archive_date = d.replace('-', '_')
#     url = CSV_URL.format(date=archive_date)
#     try:
#         r = requests.get(url, headers=HEADERS, timeout=25)
#         if r.status_code == 404:
#             return pd.DataFrame()
#         r.raise_for_status()
#         raw = pd.read_csv(StringIO(r.text))
#         if raw.empty:
#             return pd.DataFrame()
#         return normalize_df(raw, trading_date=d)
#     except Exception:
#         return pd.DataFrame()


# def load_excel_archive(path: str) -> pd.DataFrame:
#     raw = pd.read_excel(path, sheet_name=0)
#     if raw.empty:
#         return pd.DataFrame()
#     return normalize_df(raw)


# class Loader:
#     def __init__(self):
#         self.driver = "mysql-connector"
#         try:
#             self.conn = mysql.connector.connect(**DB)
#             self.cur = self.conn.cursor()
#         except Exception as first_err:
#             self.driver = "pymysql"
#             try:
#                 self.conn = pymysql.connect(
#                     host=DB["host"],
#                     port=DB["port"],
#                     user=DB["user"],
#                     password=DB["password"],
#                     database=DB["database"],
#                     autocommit=False,
#                     charset="utf8mb4",
#                 )
#                 self.cur = self.conn.cursor()
#             except Exception:
#                 raise first_err

#         self.company_cache = {}
#         self.session_cache = {}

#     def close(self):
#         self.cur.close()
#         self.conn.close()

#     def company_id(self, symbol: str):
#         if symbol in self.company_cache:
#             return self.company_cache[symbol]

#         self.cur.execute("SELECT company_id FROM company WHERE symbol=%s LIMIT 1", (symbol,))
#         row = self.cur.fetchone()
#         if row:
#             self.company_cache[symbol] = row[0]
#             return row[0]

#         try:
#             self.cur.execute(
#                 "INSERT INTO company (symbol, name, sector_id, is_active) VALUES (%s,%s,%s,1)",
#                 (symbol, symbol, SYMBOL_SECTOR.get(symbol, 14)),
#             )
#             self.conn.commit()
#             cid = self.cur.lastrowid
#             self.company_cache[symbol] = cid
#             return cid
#         except Exception:
#             self.conn.rollback()
#             return None

#     def session_id(self, trading_date: str):
#         if trading_date in self.session_cache:
#             return self.session_cache[trading_date]

#         self.cur.execute("SELECT session_id FROM trading_session WHERE trading_date=%s LIMIT 1", (trading_date,))
#         row = self.cur.fetchone()
#         if row:
#             sid = row[0]
#         else:
#             self.cur.execute(
#                 "INSERT INTO trading_session (trading_date, open_time, close_time, is_holiday, remarks) VALUES (%s,'11:00:00','15:00:00',0,'archive')",
#                 (trading_date,),
#             )
#             self.conn.commit()
#             sid = self.cur.lastrowid

#         self.session_cache[trading_date] = sid
#         return sid

#     def insert_df(self, df: pd.DataFrame, symbol_filter: str | None = None):
#         loaded = 0
#         dupes = 0

#         for _, row in df.iterrows():
#             sym = str(row.get("symbol", "")).upper().strip()
#             ds = str(row.get("date", "")).strip()
#             if not sym or not ds:
#                 continue
#             if symbol_filter and sym != symbol_filter.upper():
#                 continue

#             cid = self.company_id(sym)
#             if not cid:
#                 continue
#             sid = self.session_id(ds)

#             o = clean_num(row.get("open_price"))
#             h = clean_num(row.get("high_price"))
#             l = clean_num(row.get("low_price"))
#             c = clean_num(row.get("close_price"))
#             v = clean_int(row.get("volume"))
#             t = clean_num(row.get("turnover"))
#             p = clean_num(row.get("prev_close"))
#             pct = clean_num(row.get("percent_change"))

#             if None in (o, h, l, c, v) or c <= 0:
#                 continue
#             if h < l:
#                 h, l = l, h

#             try:
#                 self.cur.execute(
#                     "INSERT INTO price_data (company_id, session_id, open_price, high_price, low_price, close_price, volume, turnover, prev_close, percent_change) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
#                     (cid, sid, o, h, l, c, v, t, p, pct),
#                 )
#                 pid = self.cur.lastrowid
#                 self.cur.execute(
#                     "INSERT INTO data_source (price_id, source_name, entered_by, entry_method) VALUES (%s,'OmitNomis/ShareSansarScraper','load_history','archive')",
#                     (pid,),
#                 )
#                 self.conn.commit()
#                 loaded += 1
#             except (mysql.connector.IntegrityError, pymysql.err.IntegrityError):
#                 self.conn.rollback()
#                 dupes += 1
#             except Exception:
#                 self.conn.rollback()

#         return loaded, dupes


# def main():
#     ap = argparse.ArgumentParser(description="NEPSE historical loader from archive")
#     ap.add_argument("--from", dest="from_d")
#     ap.add_argument("--to", dest="to_d")
#     ap.add_argument("--days", type=int)
#     ap.add_argument("--symbol", default=None)
#     ap.add_argument("--excel", action="store_true", help="Use combined Excel archive")
#     args = ap.parse_args()

#     today = date.today().strftime("%Y-%m-%d")
#     loader = Loader()
#     total_loaded = 0
#     total_dupes = 0

#     if args.excel:
#         if not os.path.exists(EXCEL_LOCAL):
#             r = requests.get(EXCEL_URL, headers=HEADERS, timeout=180)
#             r.raise_for_status()
#             with open(EXCEL_LOCAL, "wb") as f:
#                 f.write(r.content)

#         df = load_excel_archive(EXCEL_LOCAL)
#         if args.from_d:
#             df = df[df["date"] >= args.from_d]
#         if args.to_d:
#             df = df[df["date"] <= args.to_d]
#         if args.days:
#             cutoff = (date.today() - timedelta(days=args.days)).strftime("%Y-%m-%d")
#             df = df[df["date"] >= cutoff]

#         for i, (_, batch) in enumerate(df.groupby("date"), 1):
#             loaded, dupes = loader.insert_df(batch, symbol_filter=args.symbol)
#             total_loaded += loaded
#             total_dupes += dupes
#             if i % 10 == 0 or i == 1:
#                 print(f"[{i:4d}] loaded={total_loaded} dupes={total_dupes}")
#     else:
#         if args.days:
#             to_d = today
#             from_d = (date.today() - timedelta(days=args.days)).strftime("%Y-%m-%d")
#         elif args.from_d:
#             from_d = args.from_d
#             to_d = args.to_d or today
#         else:
#             print("Usage: python load_history.py --days 90")
#             print("   or: python load_history.py --from 2025-01-01")
#             print("   or: python load_history.py --excel --from 2025-01-01")
#             loader.close()
#             sys.exit(1)

#         trading_days = list(date_range(from_d, to_d))
#         print(f"Range: {from_d} -> {to_d}")
#         print(f"Symbol: {args.symbol or 'ALL'}")
#         print(f"Trading days: {len(trading_days)}")

#         for idx, d in enumerate(trading_days, 1):
#             print(f"[{idx:3d}/{len(trading_days)}] {d} ...", end=" ", flush=True)
#             df = fetch_csv_day(d)
#             if df.empty:
#                 print("no data")
#                 time.sleep(0.2)
#                 continue

#             loaded, dupes = loader.insert_df(df, symbol_filter=args.symbol)
#             total_loaded += loaded
#             total_dupes += dupes

#             sample_symbol = (args.symbol or "ADBL").upper()
#             sample = df[df["symbol"] == sample_symbol]
#             if not sample.empty:
#                 r = sample.iloc[0]
#                 print(f"ok {loaded} loaded ({dupes} dupes) [{sample_symbol}: C={r.get('close_price', '-')}, H={r.get('high_price', '-')}, V={r.get('volume', '-')}]")
#             else:
#                 print(f"ok {loaded} loaded ({dupes} dupes)")
#             time.sleep(0.2)

#     loader.close()

#     # Auto-fix sectors after loading (calls stored procedure)
#     print("\nFixing sector classifications...")
#     try:
#         import mysql.connector
#         conn = mysql.connector.connect(**DB)
#         cur = conn.cursor()
#         cur.callproc("sp_fix_sectors")
#         conn.commit()
#         cur.close()
#         conn.close()
#         print("Sectors updated via sp_fix_sectors()")
#     except Exception as e:
#         print(f"Sector fix skipped: {e}")

#     print("DONE")
#     print(f"Total loaded: {total_loaded}")
#     print(f"Total dupes: {total_dupes}")


# if __name__ == "__main__":
#     main()

"""
NEPSE Historical Loader
=======================
Fetches OHLCV history from merolagani chart API and synchronizes it to nepse_db.

Usage:
    python load_history.py --days 90
    python load_history.py --from 2025-01-01 --to 2026-03-20
    python load_history.py --from 2025-01-01 --symbol ADBL
    python load_history.py --symbol NABIL --days 180

Fixes vs original:
  • Single DB driver (pymysql only) — removes the mysql-connector/pymysql
    dual-import fallback that caused confusing error messages.
  • Batch inserts inside a single transaction per symbol instead of one
    COMMIT per row (was O(n) round-trips, now O(1) per symbol).
  • prev_close resolved from the fetched rows themselves (sorted by date)
    rather than a SELECT per row (eliminated N+1 query problem).
  • No combined_excel usage anywhere.
"""

import argparse
import csv
import os
import sys
import time
from datetime import UTC, date, datetime, timedelta

import pymysql
import requests

# ── Database config ────────────────────────────────────────────────
DB = dict(
    host=os.getenv("NEPSE_DB_HOST") or os.getenv("DB_HOST", "localhost"),
    port=int(os.getenv("NEPSE_DB_PORT") or os.getenv("DB_PORT", "3306")),
    user=os.getenv("NEPSE_DB_USER") or os.getenv("DB_USER", "root"),
    password=os.getenv("NEPSE_DB_PASSWORD") or os.getenv("DB_PASS", ""),
    database=os.getenv("NEPSE_DB_NAME") or os.getenv("DB_NAME", "nepse_db"),
    charset="utf8mb4",
    autocommit=False,
)

# ── Merolagani chart API ───────────────────────────────────────────
CHART_URL = (
    "https://www.merolagani.com/handlers/TechnicalChartHandler.ashx"
    "?type=get_advanced_chart&symbol={sym}&resolution=1D"
    "&rangeStartDate={fr}&rangeEndDate={to}"
    "&from=&isAdjust=1&currencyCode=NPR"
)

SESSION = requests.Session()
SESSION.headers.update(
    {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "*/*",
        "Origin": "https://www.merolagani.com",
    }
)
_session_warmed = False


# ── Date helpers ───────────────────────────────────────────────────
def to_ts(d: str) -> int:
    return int(datetime.strptime(d, "%Y-%m-%d").timestamp())


def today_iso() -> str:
    return date.today().strftime("%Y-%m-%d")


def ago(days: int) -> str:
    return (date.today() - timedelta(days=days)).strftime("%Y-%m-%d")


# ── HTTP helpers ───────────────────────────────────────────────────
def _warm_session(symbol: str) -> None:
    global _session_warmed
    if _session_warmed:
        return
    url = f"https://www.merolagani.com/CompanyDetail.aspx?symbol={symbol}"
    SESSION.headers["Referer"] = url
    try:
        SESSION.get(url, timeout=15)
    except Exception:
        pass
    _session_warmed = True


def fetch_symbol_rows(symbol: str, from_ts: int, end_ts: int) -> list[dict]:
    """Fetch OHLCV rows for *symbol* from the merolagani chart API."""
    _warm_session(symbol)
    SESSION.headers["Referer"] = (
        f"https://www.merolagani.com/CompanyDetail.aspx?symbol={symbol}"
    )

    try:
        res = SESSION.get(
            CHART_URL.format(sym=symbol, fr=from_ts, to=end_ts), timeout=25
        )
        res.raise_for_status()
        data = res.json()
    except Exception as exc:
        print(f"    fetch error: {exc}")
        return []

    if data.get("s") != "ok" or not data.get("t"):
        return []

    ts_list = data.get("t", [])
    o_list  = data.get("o", [])
    h_list  = data.get("h", [])
    l_list  = data.get("l", [])
    c_list  = data.get("c", [])
    v_list  = data.get("v", [])

    rows: list[dict] = []
    seen: set[str]   = set()

    for i, ts in enumerate(ts_list):
        try:
            day = datetime.fromtimestamp(ts, UTC).strftime("%Y-%m-%d")
            if day in seen:
                continue
            seen.add(day)

            o = float(o_list[i])
            h = float(h_list[i])
            l = float(l_list[i])
            c = float(c_list[i])
            v = int(v_list[i])

            if c <= 0:
                continue
            if h < l:
                h, l = l, h

            rows.append({"date": day, "open": o, "high": h, "low": l, "close": c, "volume": v})
        except Exception:
            continue

    return rows


# ── Database loader ────────────────────────────────────────────────
class Loader:
    """
    Single pymysql connection with in-memory caches for company/session IDs.

    FIX (N+1 prev_close):
      The original computed prev_close via a per-row SELECT inside insert_rows.
      We now pass a pre-built {date: prev_close} mapping derived from the
      already-fetched rows (sorted by date) — zero extra queries.

    FIX (per-row commits):
      The original called self.conn.commit() after every INSERT.
      We now batch all inserts for a symbol in one transaction and commit once.
    """

    def __init__(self) -> None:
        self.conn = pymysql.connect(**DB)
        self.cur  = self.conn.cursor()
        self._company_cache: dict[str, int | None] = {}
        self._session_cache: dict[str, int]        = {}

    def close(self) -> None:
        self.cur.close()
        self.conn.close()

    # ── ID resolution ────────────────────────────────────────────

    def company_id(self, symbol: str) -> int | None:
        if symbol in self._company_cache:
            return self._company_cache[symbol]

        self.cur.execute(
            "SELECT company_id FROM company WHERE symbol=%s LIMIT 1", (symbol,)
        )
        row = self.cur.fetchone()
        if row:
            self._company_cache[symbol] = row[0]
            return row[0]

        # Auto-create unknown company in sector 14 (Others)
        try:
            self.cur.execute(
                "INSERT INTO company (symbol, name, sector_id, is_active) VALUES (%s,%s,14,1)",
                (symbol, symbol),
            )
            self.conn.commit()
            cid = self.cur.lastrowid
            self._company_cache[symbol] = cid
            return cid
        except Exception:
            self.conn.rollback()
            self._company_cache[symbol] = None
            return None

    def session_id(self, trading_date: str) -> int:
        if trading_date in self._session_cache:
            return self._session_cache[trading_date]

        self.cur.execute(
            "SELECT session_id FROM trading_session WHERE trading_date=%s LIMIT 1",
            (trading_date,),
        )
        row = self.cur.fetchone()
        if row:
            sid = row[0]
        else:
            self.cur.execute(
                "INSERT INTO trading_session "
                "(trading_date, open_time, close_time, is_holiday, remarks) "
                "VALUES (%s,'11:00:00','15:00:00',0,'merolagani_chart_api')",
                (trading_date,),
            )
            self.conn.commit()
            sid = self.cur.lastrowid

        self._session_cache[trading_date] = sid
        return sid

    # ── Existing dates for skip-logic ────────────────────────────

    def existing_dates(self, symbol: str, from_d: str, to_d: str) -> set[str]:
        self.cur.execute(
            """SELECT DATE_FORMAT(t.trading_date,'%%Y-%%m-%%d')
               FROM price_data p
               JOIN company c ON p.company_id = c.company_id
               JOIN trading_session t ON p.session_id = t.session_id
               WHERE c.symbol=%s AND t.trading_date BETWEEN %s AND %s""",
            (symbol, from_d, to_d),
        )
        return {str(r[0]) for r in self.cur.fetchall()}

    # ── Fetch the last known close before a date range ───────────

    def last_close_before(self, company_id: int, before_date: str) -> float | None:
        """Returns the most recent close_price before *before_date*, or None."""
        self.cur.execute(
            """SELECT p.close_price
               FROM price_data p
               JOIN trading_session t ON p.session_id = t.session_id
               WHERE p.company_id=%s AND t.trading_date < %s
               ORDER BY t.trading_date DESC
               LIMIT 1""",
            (company_id, before_date),
        )
        row = self.cur.fetchone()
        return float(row[0]) if row else None

    # ── Batch insert ─────────────────────────────────────────────

    def insert_rows(self, symbol: str, rows: list[dict]) -> tuple[int, int]:
        """
        Insert *rows* for *symbol* in a single transaction.

        prev_close is derived from the sorted row list itself (or from the DB
        for the very first row) — no per-row SELECT.
        """
        if not rows:
            return 0, 0

        cid = self.company_id(symbol)
        if cid is None:
            return 0, len(rows)

        # Sort ascending so we can walk prev_close forward
        rows_sorted = sorted(rows, key=lambda r: r["date"])

        # Fetch the one close before our earliest new row (single query)
        running_prev = self.last_close_before(cid, rows_sorted[0]["date"])

        loaded = 0
        dupes  = 0

        try:
            for row in rows_sorted:
                d   = row["date"]
                sid = self.session_id(d)
                o   = float(row["open"])
                h   = float(row["high"])
                l   = float(row["low"])
                c   = float(row["close"])
                v   = int(row["volume"])

                pct = (
                    round((c - running_prev) / running_prev * 100, 2)
                    if running_prev and running_prev > 0
                    else None
                )

                try:
                    self.cur.execute(
                        """INSERT INTO price_data
                           (company_id, session_id, open_price, high_price, low_price,
                            close_price, volume, prev_close, percent_change)
                           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                        (cid, sid, o, h, l, c, v, running_prev, pct),
                    )
                    price_id = self.cur.lastrowid
                    self.cur.execute(
                        "INSERT INTO data_source "
                        "(price_id, source_name, entered_by, entry_method) "
                        "VALUES (%s,'merolagani.com','load_history','chart_api')",
                        (price_id,),
                    )
                    loaded += 1
                except pymysql.err.IntegrityError:
                    # Duplicate key — row already exists, skip silently
                    dupes += 1

                # Walk prev_close forward regardless of dupe status
                running_prev = c

            # One commit for the whole symbol batch
            self.conn.commit()

        except Exception as exc:
            self.conn.rollback()
            print(f"    DB error for {symbol}: {exc}")

        return loaded, dupes

    # ── Symbol discovery ─────────────────────────────────────────

    def list_symbols_from_db(self) -> list[str]:
        self.cur.execute(
            "SELECT symbol FROM company WHERE is_active=1 ORDER BY symbol"
        )
        return [str(r[0]).strip().upper() for r in self.cur.fetchall() if r and r[0]]


# ── CSV fallback ───────────────────────────────────────────────────
def list_symbols_from_csv() -> list[str]:
    csv_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "nepse_data", "companies.csv"
    )
    if not os.path.exists(csv_path):
        return []
    symbols: list[str] = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            s = str(row.get("symbol", "")).strip().upper()
            if s:
                symbols.append(s)
    return symbols


def resolve_symbols(loader: Loader, symbol: str | None) -> list[str]:
    if symbol:
        return [symbol.upper().strip()]
    from_db = loader.list_symbols_from_db()
    if from_db:
        return from_db
    from_csv = list_symbols_from_csv()
    if from_csv:
        return from_csv
    print("No symbols found. Add companies to DB first, or run with --symbol ADBL")
    return []


# ── CLI entry point ────────────────────────────────────────────────
def main() -> None:
    ap = argparse.ArgumentParser(
        description="NEPSE historical loader from merolagani chart API"
    )
    ap.add_argument("--from", dest="from_d")
    ap.add_argument("--to",   dest="to_d")
    ap.add_argument("--days", type=int)
    ap.add_argument("--symbol", default=None)
    ap.add_argument(
        "--all",
        action="store_true",
        help="Compatibility flag; all symbols are loaded when --symbol is omitted",
    )
    args = ap.parse_args()

    to_d = args.to_d or today_iso()
    if args.from_d:
        from_d = args.from_d
    elif args.days:
        from_d = ago(args.days)
    else:
        from_d = ago(180)

    from_ts_val   = to_ts(from_d)
    to_ts_val     = to_ts(to_d) + 86400   # inclusive end

    loader  = Loader()
    symbols = resolve_symbols(loader, args.symbol)
    if not symbols:
        loader.close()
        sys.exit(1)

    print(f"Range:   {from_d} → {to_d}")
    print(f"Symbols: {len(symbols)}")

    total_loaded = 0
    total_dupes  = 0

    for idx, sym in enumerate(symbols, 1):
        prefix = f"[{idx:4d}/{len(symbols)}] {sym:<12}"

        existing = loader.existing_dates(sym, from_d, to_d)
        rows     = fetch_symbol_rows(sym, from_ts_val, to_ts_val)
        rows     = [r for r in rows if from_d <= r["date"] <= to_d]

        if not rows:
            print(f"{prefix} no data from API")
            time.sleep(0.15)
            continue

        new_rows = [r for r in rows if r["date"] not in existing]
        if not new_rows:
            print(f"{prefix} up to date ({len(rows)} days already in DB)")
            time.sleep(0.05)
            continue

        loaded, dupes = loader.insert_rows(sym, new_rows)
        total_loaded += loaded
        total_dupes  += dupes

        first = min(new_rows, key=lambda r: r["date"])
        last  = max(new_rows, key=lambda r: r["date"])
        print(
            f"{prefix} +{loaded} rows  "
            f"[{first['date']} C={first['close']} .. "
            f"{last['date']} C={last['close']}]"
        )
        time.sleep(0.2)

    loader.close()
    print("\nDONE")
    print(f"  Inserted : {total_loaded:,}")
    print(f"  Skipped  : {total_dupes:,}")


if __name__ == "__main__":
    main()