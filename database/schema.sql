CREATE TABLE IF NOT EXISTS accounts (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  subject_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  email VARCHAR(254) COLLATE utf8mb4_bin NOT NULL,
  display_name VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  expires BIGINT UNSIGNED NOT NULL,
  KEY sessions_expiry (expires),
  FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS entries (
  owner CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  kind VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  title VARCHAR(300) NOT NULL,
  payload LONGTEXT NOT NULL CHECK (JSON_VALID(payload)),
  status ENUM('draft','review','complete') NOT NULL,
  preset VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  updated BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (owner, id),
  KEY entries_owner_updated (owner, updated),
  KEY entries_shared (owner, preset, status),
  FOREIGN KEY (owner) REFERENCES accounts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS viewers (
  owner CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  preset VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  email VARCHAR(254) COLLATE utf8mb4_bin NOT NULL,
  PRIMARY KEY (owner, preset, email),
  KEY viewers_email (email),
  FOREIGN KEY (owner, preset) REFERENCES entries (owner, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
