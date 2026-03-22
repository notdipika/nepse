-- ════════════════════════════════════════════════════════════════════
--  NEPSE Dashboard — Complete Database Setup
--  DBMS Project: Nepal Stock Exchange Analytics System
--
--  Concepts demonstrated:
--    • Normalized relational schema (3NF)
--    • Primary keys, foreign keys, unique constraints
--    • Indexes for query optimization
--    • Views (virtual tables)
--    • Stored procedures (encapsulated business logic)
--    • Functions (reusable calculations)
--    • Triggers (automated data integrity)
--    • Transactions (ACID compliance)
--    • Events (scheduled automation)
--
--  Usage:
--    mysql -u root -p < setup_databases.sql
-- ════════════════════════════════════════════════════════════════════

SET FOREIGN_KEY_CHECKS = 0;

-- ─────────────────────────────────────────────────────────────────
--  1. AUTH DATABASE
-- ─────────────────────────────────────────────────────────────────
CREATE DATABASE IF NOT EXISTS auth_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE auth_db;

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100)         NOT NULL,
  email         VARCHAR(150)         NOT NULL UNIQUE,
  password_hash VARCHAR(255)         NOT NULL,
  role          ENUM('admin','user') NOT NULL DEFAULT 'user',
  created_at    TIMESTAMP            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP            NOT NULL DEFAULT CURRENT_TIMESTAMP
                                     ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email)
) COMMENT='Stores dashboard user accounts';

CREATE TABLE IF NOT EXISTS sessions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT          NOT NULL,
  session_token VARCHAR(255) NOT NULL UNIQUE,
  expires       DATETIME     NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (session_token)
) COMMENT='NextAuth session storage';


-- ─────────────────────────────────────────────────────────────────
--  2. NEPSE DATABASE
-- ─────────────────────────────────────────────────────────────────
CREATE DATABASE IF NOT EXISTS nepse_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE nepse_db;

-- ── 2a. CORE TABLES ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sector (
  sector_id   INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT         DEFAULT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) COMMENT='NEPSE sector classifications (e.g., Commercial Bank, Hydropower)';

CREATE TABLE IF NOT EXISTS company (
  company_id   INT AUTO_INCREMENT PRIMARY KEY,
  symbol       VARCHAR(20)  NOT NULL UNIQUE,
  name         VARCHAR(150) NOT NULL,
  sector_id    INT          NOT NULL DEFAULT 14,  -- defaults to Others
  listed_date  DATE         DEFAULT NULL,
  total_shares BIGINT       DEFAULT NULL,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sector_id) REFERENCES sector(sector_id),
  INDEX idx_symbol   (symbol),
  INDEX idx_sector   (sector_id),
  INDEX idx_active   (is_active)
) COMMENT='NEPSE-listed companies with sector classification';

CREATE TABLE IF NOT EXISTS trading_session (
  session_id   INT  AUTO_INCREMENT PRIMARY KEY,
  trading_date DATE NOT NULL UNIQUE,
  open_time    TIME DEFAULT '11:00:00',
  close_time   TIME DEFAULT '15:00:00',
  is_holiday   TINYINT(1)   NOT NULL DEFAULT 0,
  remarks      VARCHAR(200) DEFAULT NULL,
  INDEX idx_date    (trading_date),
  INDEX idx_holiday (is_holiday, trading_date)
) COMMENT='Each NEPSE trading session (Sun–Thu, 11:00–15:00 NPT)';

CREATE TABLE IF NOT EXISTS price_data (
  price_id       INT  AUTO_INCREMENT PRIMARY KEY,
  company_id     INT          NOT NULL,
  session_id     INT          NOT NULL,
  open_price     DECIMAL(10,2) NOT NULL,
  high_price     DECIMAL(10,2) NOT NULL,
  low_price      DECIMAL(10,2) NOT NULL,
  close_price    DECIMAL(10,2) NOT NULL,
  volume         BIGINT        NOT NULL DEFAULT 0,
  turnover       DECIMAL(16,2) DEFAULT NULL,
  prev_close     DECIMAL(10,2) DEFAULT NULL,
  percent_change DECIMAL(7,2)  DEFAULT NULL,
  UNIQUE KEY uq_company_session (company_id, session_id),
  FOREIGN KEY (company_id) REFERENCES company(company_id)  ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES trading_session(session_id) ON DELETE CASCADE,
  INDEX idx_company_session (company_id, session_id),
  INDEX idx_session         (session_id),
  INDEX idx_close           (close_price),
  INDEX idx_turnover        (turnover),
  INDEX idx_pct_change      (percent_change)
) COMMENT='OHLCV price records — one row per company per trading day';

CREATE TABLE IF NOT EXISTS data_source (
  source_id    INT AUTO_INCREMENT PRIMARY KEY,
  price_id     INT          NOT NULL UNIQUE,
  source_name  VARCHAR(80)  NOT NULL DEFAULT 'OmitNomis/ShareSansarScraper',
  entered_by   VARCHAR(80)  DEFAULT NULL,
  entered_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  entry_method VARCHAR(30)  DEFAULT 'excel_archive',
  FOREIGN KEY (price_id) REFERENCES price_data(price_id) ON DELETE CASCADE
) COMMENT='Audit trail — tracks where each price record came from';

CREATE TABLE IF NOT EXISTS watchlist (
  watchlist_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT       NOT NULL,
  company_id   INT       NOT NULL,
  added_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes        TEXT      DEFAULT NULL,
  UNIQUE KEY uq_user_company (user_id, company_id),
  FOREIGN KEY (company_id) REFERENCES company(company_id) ON DELETE CASCADE,
  INDEX idx_user (user_id)
) COMMENT='Per-user stock watchlists';

-- ── 2b. AUDIT / STATISTICS TABLE ─────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_market_summary (
  summary_id      INT AUTO_INCREMENT PRIMARY KEY,
  trading_date    DATE          NOT NULL UNIQUE,
  total_turnover  DECIMAL(18,2) DEFAULT 0,
  total_volume    BIGINT        DEFAULT 0,
  total_companies INT           DEFAULT 0,
  gainers         INT           DEFAULT 0,
  losers          INT           DEFAULT 0,
  neutral         INT           DEFAULT 0,
  avg_change_pct  DECIMAL(7,2)  DEFAULT 0,
  computed_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_date (trading_date)
) COMMENT='Pre-aggregated daily market statistics for fast dashboard queries';


-- ─────────────────────────────────────────────────────────────────
--  3. SEED SECTORS
-- ─────────────────────────────────────────────────────────────────
INSERT IGNORE INTO sector (sector_id, name) VALUES
  (1,  'Commercial Bank'),
  (2,  'Corporate Debentures'),
  (3,  'Development Bank'),
  (4,  'Finance'),
  (5,  'Government Bonds'),
  (6,  'Hotel & Tourism'),
  (7,  'Hydropower'),
  (8,  'Investment'),
  (9,  'Life Insurance'),
  (10, 'Manufacturing and Processing'),
  (11, 'Microfinance'),
  (12, 'Mutual Fund'),
  (13, 'Non-Life Insurance'),
  (14, 'Others'),
  (15, 'Preference Share'),
  (16, 'Promoter Share'),
  (17, 'Trading');


-- ─────────────────────────────────────────────────────────────────
--  4. VIEWS  (virtual tables — computed on read)
-- ─────────────────────────────────────────────────────────────────

-- Latest price for every active company
CREATE OR REPLACE VIEW v_latest_prices AS
SELECT
  c.company_id,
  c.symbol,
  c.name                                                    AS company_name,
  s.name                                                    AS sector,
  p.open_price,
  p.high_price,
  p.low_price,
  p.close_price,
  p.volume,
  p.turnover,
  p.prev_close,
  COALESCE(p.percent_change,
    ROUND(((p.close_price - p.open_price) / NULLIF(p.open_price,0)) * 100, 2)
  )                                                         AS percent_change,
  t.trading_date
FROM price_data p
JOIN company          c ON p.company_id  = c.company_id
JOIN sector           s ON c.sector_id   = s.sector_id
JOIN trading_session  t ON p.session_id  = t.session_id
WHERE t.trading_date = (
  SELECT MAX(ts2.trading_date)
  FROM   price_data p2
  JOIN   trading_session ts2 ON p2.session_id = ts2.session_id
  WHERE  p2.company_id = c.company_id
)
AND c.is_active = 1;

-- 52-week high / low per active company
CREATE OR REPLACE VIEW v_52week_range AS
SELECT
  c.symbol,
  c.name,
  s.name                                AS sector,
  MAX(p.high_price)                     AS week52_high,
  MIN(p.low_price)                      AS week52_low,
  MAX(p.high_price) - MIN(p.low_price)  AS price_range,
  COUNT(DISTINCT t.trading_date)        AS trading_days
FROM price_data p
JOIN company          c ON p.company_id = c.company_id
JOIN sector           s ON c.sector_id  = s.sector_id
JOIN trading_session  t ON p.session_id = t.session_id
WHERE t.trading_date >= DATE_SUB(CURDATE(), INTERVAL 52 WEEK)
  AND c.is_active = 1
GROUP BY c.company_id, c.symbol, c.name, s.name;

-- Top gainers for the latest trading session
CREATE OR REPLACE VIEW v_top_gainers AS
SELECT symbol, company_name, sector, close_price, percent_change, volume, turnover, trading_date
FROM   v_latest_prices
WHERE  percent_change > 0
ORDER  BY percent_change DESC
LIMIT  20;

-- Top losers for the latest trading session
CREATE OR REPLACE VIEW v_top_losers AS
SELECT symbol, company_name, sector, close_price, percent_change, volume, turnover, trading_date
FROM   v_latest_prices
WHERE  percent_change < 0
ORDER  BY percent_change ASC
LIMIT  20;

-- Sector-level aggregation for the latest day
CREATE OR REPLACE VIEW v_sector_summary AS
SELECT
  s.name                        AS sector,
  COUNT(DISTINCT c.company_id)  AS companies,
  SUM(p.turnover)               AS total_turnover,
  SUM(p.volume)                 AS total_volume,
  ROUND(AVG(COALESCE(p.percent_change,0)), 2) AS avg_change,
  SUM(p.percent_change > 0)     AS gainers,
  SUM(p.percent_change < 0)     AS losers,
  SUM(p.percent_change = 0)     AS neutral
FROM price_data p
JOIN company          c  ON p.company_id = c.company_id
JOIN sector           s  ON c.sector_id  = s.sector_id
JOIN trading_session  ts ON p.session_id = ts.session_id
WHERE ts.trading_date = (SELECT MAX(trading_date) FROM trading_session WHERE is_holiday = 0)
  AND c.is_active = 1
GROUP BY s.sector_id, s.name
ORDER BY total_turnover DESC;


-- ─────────────────────────────────────────────────────────────────
--  5. STORED FUNCTIONS
-- ─────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS fn_price_change_pct;
DELIMITER $$
CREATE FUNCTION fn_price_change_pct(current_price DECIMAL(10,2), prev_price DECIMAL(10,2))
RETURNS DECIMAL(7,2)
DETERMINISTIC
COMMENT 'Returns percentage change between two prices'
BEGIN
  IF prev_price IS NULL OR prev_price = 0 THEN
    RETURN NULL;
  END IF;
  RETURN ROUND(((current_price - prev_price) / prev_price) * 100, 2);
END$$

DROP FUNCTION IF EXISTS fn_trading_days_between;
DELIMITER $$
CREATE FUNCTION fn_trading_days_between(from_date DATE, to_date DATE)
RETURNS INT
READS SQL DATA
COMMENT 'Counts actual NEPSE trading sessions between two dates'
BEGIN
  DECLARE cnt INT;
  SELECT COUNT(*) INTO cnt
  FROM   trading_session
  WHERE  trading_date BETWEEN from_date AND to_date
    AND  is_holiday = 0;
  RETURN cnt;
END$$
DELIMITER ;


-- ─────────────────────────────────────────────────────────────────
--  6. STORED PROCEDURES
-- ─────────────────────────────────────────────────────────────────

-- Upsert a price record safely inside a transaction
DROP PROCEDURE IF EXISTS sp_upsert_price;
DELIMITER $$
CREATE PROCEDURE sp_upsert_price(
  IN p_symbol       VARCHAR(20),
  IN p_date         DATE,
  IN p_open         DECIMAL(10,2),
  IN p_high         DECIMAL(10,2),
  IN p_low          DECIMAL(10,2),
  IN p_close        DECIMAL(10,2),
  IN p_volume       BIGINT,
  IN p_turnover     DECIMAL(16,2),
  IN p_prev_close   DECIMAL(10,2),
  IN p_pct_change   DECIMAL(7,2)
)
COMMENT 'Idempotently inserts or updates one OHLCV row with ACID guarantee'
BEGIN
  DECLARE v_company_id INT;
  DECLARE v_session_id INT;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  -- Resolve company
  SELECT company_id INTO v_company_id FROM company WHERE symbol = p_symbol LIMIT 1;
  IF v_company_id IS NULL THEN
    INSERT INTO company (symbol, name, sector_id) VALUES (p_symbol, p_symbol, 14);
    SET v_company_id = LAST_INSERT_ID();
  END IF;

  -- Resolve session
  INSERT IGNORE INTO trading_session (trading_date) VALUES (p_date);
  SELECT session_id INTO v_session_id FROM trading_session WHERE trading_date = p_date;

  -- Upsert price data
  INSERT INTO price_data
    (company_id, session_id, open_price, high_price, low_price, close_price, volume, turnover, prev_close, percent_change)
  VALUES
    (v_company_id, v_session_id, p_open, p_high, p_low, p_close, p_volume, p_turnover, p_prev_close, p_pct_change)
  ON DUPLICATE KEY UPDATE
    open_price     = VALUES(open_price),
    high_price     = VALUES(high_price),
    low_price      = VALUES(low_price),
    close_price    = VALUES(close_price),
    volume         = VALUES(volume),
    turnover       = VALUES(turnover),
    prev_close     = VALUES(prev_close),
    percent_change = VALUES(percent_change);

  COMMIT;
END$$

-- Get price history for a company over a date range
DROP PROCEDURE IF EXISTS sp_get_price_history;
DELIMITER $$
CREATE PROCEDURE sp_get_price_history(
  IN p_symbol    VARCHAR(20),
  IN p_from_date DATE,
  IN p_to_date   DATE
)
COMMENT 'Returns OHLCV history for a symbol within a date range'
BEGIN
  SELECT
    t.trading_date                        AS date,
    p.open_price                          AS open,
    p.high_price                          AS high,
    p.low_price                           AS low,
    p.close_price                         AS close,
    p.volume,
    p.turnover,
    COALESCE(p.percent_change,
      fn_price_change_pct(p.close_price, p.prev_close)) AS pct_change
  FROM price_data      p
  JOIN trading_session t ON p.session_id  = t.session_id
  JOIN company         c ON p.company_id  = c.company_id
  WHERE c.symbol       = UPPER(p_symbol)
    AND t.trading_date BETWEEN p_from_date AND p_to_date
  ORDER BY t.trading_date ASC;
END$$

-- Recompute daily_market_summary for a given date
DROP PROCEDURE IF EXISTS sp_refresh_daily_summary;
DELIMITER $$
CREATE PROCEDURE sp_refresh_daily_summary(IN p_date DATE)
COMMENT 'Aggregates market stats for one trading day into daily_market_summary'
BEGIN
  INSERT INTO daily_market_summary
    (trading_date, total_turnover, total_volume, total_companies, gainers, losers, neutral, avg_change_pct)
  SELECT
    ts.trading_date,
    COALESCE(SUM(p.turnover),0),
    COALESCE(SUM(p.volume),0),
    COUNT(*),
    SUM(COALESCE(p.percent_change,0) > 0),
    SUM(COALESCE(p.percent_change,0) < 0),
    SUM(COALESCE(p.percent_change,0) = 0),
    ROUND(AVG(COALESCE(p.percent_change,0)),2)
  FROM price_data      p
  JOIN trading_session ts ON p.session_id = ts.session_id
  JOIN company         c  ON p.company_id = c.company_id
  WHERE ts.trading_date = p_date
    AND c.is_active = 1
  ON DUPLICATE KEY UPDATE
    total_turnover  = VALUES(total_turnover),
    total_volume    = VALUES(total_volume),
    total_companies = VALUES(total_companies),
    gainers         = VALUES(gainers),
    losers          = VALUES(losers),
    neutral         = VALUES(neutral),
    avg_change_pct  = VALUES(avg_change_pct),
    computed_at     = CURRENT_TIMESTAMP;
END$$

-- Assign correct sectors based on known NEPSE symbol patterns
DROP PROCEDURE IF EXISTS sp_fix_sectors;
DELIMITER $$
CREATE PROCEDURE sp_fix_sectors()
COMMENT 'Reclassifies companies into correct NEPSE sectors from Others'
BEGIN
  -- Commercial Banks
  UPDATE company SET sector_id = 1
  WHERE sector_id = 14
    AND symbol IN ('NABIL','EBL','NICA','SBI','ADBL','BOKL','CCBL','CBL','CZBIL',
                   'GBIME','HBL','KBL','LBL','MBL','NBB','NBL','NCCB','NIB','NMB',
                   'PCBL','PRVU','SANB','SCB','SRBL','SHBL','MAXA','MEGA','NIMB',
                   'JBNL','SUNBL','LBBL','BNBL','SHINE');

  -- Development Banks
  UPDATE company SET sector_id = 3
  WHERE sector_id = 14
    AND symbol IN ('DDBL','EDBL','GBBL','GRDBL','ICFC','JBBL','KBBL','LSBBL',
                   'MLBL','MNBBL','MPBL','MRGD','NABBC','ODBL','SADBL','SAPDBL',
                   'SBBL','SDBL','SINDU','SPDBL','SSBL','TBBL','WBBL','CORBL',
                   'KSBBL','RIPDBL','SSDBL','PBBL','BPCL','EDCL','RBBI','HAMRO');

  -- Finance
  UPDATE company SET sector_id = 4
  WHERE sector_id = 14
    AND symbol IN ('CFCL','GUFL','GFCL','ICC','IFIC','JFL','MFIL','NFCL','PROFL',
                   'SFCL','SIFC','SKFL','UFL','AFCL','BFC','CBFIN','CMF','NCFL',
                   'NFIL','PAFAN','MPFL','RLFL','SVFL');

  -- Microfinance
  UPDATE company SET sector_id = 11
  WHERE sector_id = 14
    AND symbol IN ('MFBS','SMFBS','GMFBS','RMDC','SWMF','UNLB','WNLB','NICLBSL',
                   'MLBSL','SKDBL','FOWAD','NIRDHAN','NSLBBL','SWBBL','GILBSL',
                   'SLBSL','AKPL','GLBSL','JBLB','KMFL','NESDO','NMFBS','SDESI',
                   'SLBBL','SMFL','CBBL');

  -- Life Insurance
  UPDATE company SET sector_id = 9
  WHERE sector_id = 14
    AND symbol IN ('ALICL','CLI','GLICL','ILI','JLIC','LICN','MLIC','NLIC',
                   'PCLI','PMLI','SNLI','SLI','RNLI','SRLI','NILI','ULIF',
                   'PLIT','NWCL');

  -- Non-Life Insurance
  UPDATE company SET sector_id = 13
  WHERE sector_id = 14
    AND symbol IN ('AIL','HGICL','HGI','IGI','LGIL','NIC','NLICL','NIL',
                   'PICL','PLIC','PRIN','RBCL','RIMCL','SALICL','SGIC',
                   'SICL','SLICL','TICL','UAIL','API','SEIT');

  -- Hydropower
  UPDATE company SET sector_id = 7
  WHERE sector_id = 14
    AND symbol IN ('AHPC','BARUN','BEDC','BHPL','BHL','CHCL','DHPL','DOLTI',
                   'HDHPC','HPPL','HURJA','KBHPL','KPCL','LBHPL','MBJCL',
                   'MKCL','MKJC','MMKJL','NHDL','NHPC','NPCBL','NYADI','PPCL',
                   'RADHI','RHCL','RIDI','RURU','SANJEN','SAHAS','SJCL','SMPL',
                   'SPDL','SRPL','SSHL','TMHL','UHEWA','UPCL','USHEC','USHL',
                   'YETI','NGPL','KKHC','UPPER','BPCL','HPPL');

  -- Hotel & Tourism
  UPDATE company SET sector_id = 6
  WHERE sector_id = 14
    AND symbol IN ('EVRL','OHL','TRH','YHL','MHCL','SHIVM','SHL');

  -- Manufacturing & Processing
  UPDATE company SET sector_id = 10
  WHERE sector_id = 14
    AND symbol IN ('BSML','HDL','GCIL','BNHC','NTC','STC','NIFRA','UNL',
                   'SAIL','NBBL','SHIVAM');

  -- Investment
  UPDATE company SET sector_id = 8
  WHERE sector_id = 14
    AND symbol IN ('CHDC','CIT','HIDCL','NIL');

  -- Trading
  UPDATE company SET sector_id = 17
  WHERE sector_id = 14
    AND symbol IN ('BBC','STC','NRIC');

  -- Mutual Fund (symbols typically end in digits or contain 'MF')
  UPDATE company SET sector_id = 12
  WHERE sector_id = 14
    AND (symbol REGEXP '^[A-Z]+(MF[0-9]+|MF)$' OR symbol LIKE '%MULF%');

  SELECT CONCAT('Sector fix complete. Companies still in Others: ',
    COUNT(*)) AS result
  FROM company WHERE sector_id = 14 AND is_active = 1;
END$$
DELIMITER ;


-- ─────────────────────────────────────────────────────────────────
--  7. TRIGGERS  (automated data integrity)
-- ─────────────────────────────────────────────────────────────────

-- Ensure high >= low and high >= open/close on every insert/update
DROP TRIGGER IF EXISTS trg_price_data_validate_before_insert;
DELIMITER $$
CREATE TRIGGER trg_price_data_validate_before_insert
BEFORE INSERT ON price_data
FOR EACH ROW
BEGIN
  -- Swap high/low if inverted
  IF NEW.high_price < NEW.low_price THEN
    SET @tmp = NEW.high_price;
    SET NEW.high_price = NEW.low_price;
    SET NEW.low_price  = @tmp;
  END IF;
  -- Clamp: high must be >= open and close
  IF NEW.high_price < NEW.open_price  THEN SET NEW.high_price = NEW.open_price;  END IF;
  IF NEW.high_price < NEW.close_price THEN SET NEW.high_price = NEW.close_price; END IF;
  -- Clamp: low must be <= open and close
  IF NEW.low_price > NEW.open_price   THEN SET NEW.low_price  = NEW.open_price;  END IF;
  IF NEW.low_price > NEW.close_price  THEN SET NEW.low_price  = NEW.close_price; END IF;
  -- Auto-compute percent_change if missing
  IF NEW.percent_change IS NULL AND NEW.prev_close IS NOT NULL AND NEW.prev_close > 0 THEN
    SET NEW.percent_change = ROUND(((NEW.close_price - NEW.prev_close) / NEW.prev_close) * 100, 2);
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_price_data_validate_before_update;
DELIMITER $$
CREATE TRIGGER trg_price_data_validate_before_update
BEFORE UPDATE ON price_data
FOR EACH ROW
BEGIN
  IF NEW.high_price < NEW.low_price THEN
    SET @tmp = NEW.high_price;
    SET NEW.high_price = NEW.low_price;
    SET NEW.low_price  = @tmp;
  END IF;
  IF NEW.high_price < NEW.open_price  THEN SET NEW.high_price = NEW.open_price;  END IF;
  IF NEW.high_price < NEW.close_price THEN SET NEW.high_price = NEW.close_price; END IF;
  IF NEW.low_price  > NEW.open_price  THEN SET NEW.low_price  = NEW.open_price;  END IF;
  IF NEW.low_price  > NEW.close_price THEN SET NEW.low_price  = NEW.close_price; END IF;
  IF NEW.percent_change IS NULL AND NEW.prev_close IS NOT NULL AND NEW.prev_close > 0 THEN
    SET NEW.percent_change = ROUND(((NEW.close_price - NEW.prev_close) / NEW.prev_close) * 100, 2);
  END IF;
END$$
DELIMITER ;

-- Auto-refresh daily_market_summary after new price data is inserted
DROP TRIGGER IF EXISTS trg_refresh_summary_after_insert;
DELIMITER $$
CREATE TRIGGER trg_refresh_summary_after_insert
AFTER INSERT ON price_data
FOR EACH ROW
BEGIN
  DECLARE v_date DATE;
  SELECT trading_date INTO v_date
  FROM   trading_session WHERE session_id = NEW.session_id LIMIT 1;
  IF v_date IS NOT NULL THEN
    CALL sp_refresh_daily_summary(v_date);
  END IF;
END$$
DELIMITER ;


-- ─────────────────────────────────────────────────────────────────
--  8. SCHEDULED EVENT  (runs automatically if event_scheduler=ON)
-- ─────────────────────────────────────────────────────────────────
SET GLOBAL event_scheduler = ON;

DROP EVENT IF EXISTS evt_weekly_sector_fix;
DELIMITER $$
CREATE EVENT evt_weekly_sector_fix
ON SCHEDULE EVERY 1 WEEK
STARTS (DATE(NOW()) + INTERVAL 1 DAY)
COMMENT 'Re-runs sector classification every week for new companies'
DO
BEGIN
  CALL sp_fix_sectors();
END$$
DELIMITER ;


-- ─────────────────────────────────────────────────────────────────
--  9. RUN INITIAL DATA SETUP
-- ─────────────────────────────────────────────────────────────────
-- Fix any companies already loaded that are stuck in 'Others'
CALL sp_fix_sectors();

SET FOREIGN_KEY_CHECKS = 1;

-- ─────────────────────────────────────────────────────────────────
--  10. VERIFY
-- ─────────────────────────────────────────────────────────────────
SELECT 'auth_db tables:' AS '';
SELECT table_name, table_rows, table_comment
FROM   information_schema.tables
WHERE  table_schema = 'auth_db'
ORDER  BY table_name;

SELECT 'nepse_db tables:' AS '';
SELECT table_name, table_rows, table_comment
FROM   information_schema.tables
WHERE  table_schema = 'nepse_db'
ORDER  BY table_name;

SELECT 'nepse_db views:' AS '';
SELECT table_name AS view_name
FROM   information_schema.views
WHERE  table_schema = 'nepse_db';

SELECT 'Stored procedures:' AS '';
SELECT routine_name, routine_comment
FROM   information_schema.routines
WHERE  routine_schema = 'nepse_db'
  AND  routine_type   = 'PROCEDURE';

SELECT 'Functions:' AS '';
SELECT routine_name, routine_comment
FROM   information_schema.routines
WHERE  routine_schema = 'nepse_db'
  AND  routine_type   = 'FUNCTION';

SELECT 'Triggers:' AS '';
SELECT trigger_name, event_manipulation, action_timing
FROM   information_schema.triggers
WHERE  trigger_schema = 'nepse_db';

SELECT 'Sectors seeded:' AS '';
SELECT sector_id, name FROM sector ORDER BY sector_id;

SELECT '✓ NEPSE Dashboard database setup complete.' AS status;