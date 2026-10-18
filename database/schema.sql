-- Bengaluru Climate Risk Scanner: MySQL schema (XAMPP)
-- Spatial layers live in GeoServer; business records live here.
-- The two are joined on (portfolio_id, property_id).

CREATE DATABASE IF NOT EXISTS climaterisk CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE climaterisk;

CREATE TABLE IF NOT EXISTS portfolios (
  portfolio_id INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  uploaded_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- property_id is only unique within a portfolio: two banks (or two uploads)
-- can both use 'P-0001', so the key is (portfolio_id, property_id).
CREATE TABLE IF NOT EXISTS properties (
  portfolio_id INT          NOT NULL,
  property_id  VARCHAR(20)  NOT NULL,
  latitude     DECIMAL(9,6) NOT NULL,
  longitude    DECIMAL(9,6) NOT NULL,
  loan_value   DECIMAL(14,2) NOT NULL,
  flood_class  TINYINT,                       -- 1 Low, 2 Medium, 3 High
  heat_class   TINYINT,                       -- 1 Low, 2 Medium, 3 High
  risk_score   DECIMAL(3,2),                  -- 0.6 x flood + 0.4 x heat
  risk_level   ENUM('Low','Medium','High'),   -- High whenever flood_class = 3
  PRIMARY KEY (portfolio_id, property_id),
  FOREIGN KEY (portfolio_id) REFERENCES portfolios(portfolio_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reports (
  report_id    INT AUTO_INCREMENT PRIMARY KEY,
  portfolio_id INT NOT NULL,
  high_share   DECIMAL(5,2),                  -- % of loan value in High-risk locations
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (portfolio_id) REFERENCES portfolios(portfolio_id) ON DELETE CASCADE
);
