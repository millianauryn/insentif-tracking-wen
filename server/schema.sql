-- SQLite schema for incentive tracking
-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('superadmin', 'officer', 'observer')),
    parent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    sales_code TEXT,
    position_id INTEGER REFERENCES positions(id) ON DELETE SET NULL,
    avatar_key TEXT,
    avatar_letter TEXT,
    avatar_color TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Divisions master data
CREATE TABLE IF NOT EXISTS divisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    code TEXT UNIQUE,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Principals master data
CREATE TABLE IF NOT EXISTS principals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    code TEXT,
    address TEXT,
    division_id INTEGER REFERENCES divisions(id) ON DELETE SET NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Regions master data
CREATE TABLE IF NOT EXISTS regions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Branches master data
CREATE TABLE IF NOT EXISTS branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    code TEXT,
    address TEXT,
    city TEXT,
    region_id INTEGER REFERENCES regions(id) ON DELETE SET NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Branch-Divisions junction (many-to-many)
CREATE TABLE IF NOT EXISTS branch_divisions (
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    division_id INTEGER NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
    is_primary INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (branch_id, division_id)
);

-- Brands master data
CREATE TABLE IF NOT EXISTS brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    principal_id INTEGER NOT NULL REFERENCES principals(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (principal_id, name)
);

-- Document formats
CREATE TABLE IF NOT EXISTS document_formats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    version TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Criteria definitions (master criteria controlled by Super Admin)
CREATE TABLE IF NOT EXISTS criteria_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    target_unit TEXT,
    formula TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Incentive documents
CREATE TABLE IF NOT EXISTS incentive_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    format_id INTEGER REFERENCES document_formats(id) ON DELETE SET NULL,
    division_id INTEGER REFERENCES divisions(id) ON DELETE SET NULL,
    salesman TEXT,
    product TEXT,
    period TEXT,
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Final')),
    wilayah TEXT,
    insentif_total REAL,
    kwitansi TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Golongan rows (flexible rows for groups and products)
CREATE TABLE IF NOT EXISTS golongan_rows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL REFERENCES incentive_documents(id) ON DELETE CASCADE,
    label TEXT,

    parent_id INTEGER REFERENCES golongan_rows(id) ON DELETE CASCADE,
    principal_id INTEGER REFERENCES principals(id) ON DELETE SET NULL,
    brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
    target REAL,
    achievement REAL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_group INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Document criteria rows (immutable snapshot per document)
CREATE TABLE IF NOT EXISTS document_criteria_rows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL REFERENCES incentive_documents(id) ON DELETE CASCADE,
    criteria_id INTEGER NOT NULL REFERENCES criteria_definitions(id) ON DELETE RESTRICT,
    label TEXT NOT NULL,
    target_unit TEXT,
    formula TEXT,
    target_value REAL,
    achievement_value REAL,
    percentage REAL,
    status TEXT,
    incentive_amount REAL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- Audit logs for corrections and privileged mutations
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Jabatan User (positions: BM/SPV/SALES with hierarchy and branch)
CREATE TABLE IF NOT EXISTS positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sales_code TEXT,
    position_type TEXT NOT NULL CHECK (position_type IN ('BM', 'SPV', 'SALES')),
    join_date TEXT,
    parent_position_id INTEGER REFERENCES positions(id) ON DELETE SET NULL,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Position criteria junction (each position has its own kriteria set)
CREATE TABLE IF NOT EXISTS position_criteria (
    position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
    criteria_id INTEGER NOT NULL REFERENCES criteria_definitions(id) ON DELETE CASCADE,
    PRIMARY KEY (position_id, criteria_id)
);

-- User-branch junction (many-to-many for Akun)
CREATE TABLE IF NOT EXISTS user_branches (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, branch_id)
);

-- Position-branch junction (many-to-many for Jabatan User)
CREATE TABLE IF NOT EXISTS position_branches (
    position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    PRIMARY KEY (position_id, branch_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_golongan_rows_document_id ON golongan_rows(document_id);
CREATE INDEX IF NOT EXISTS idx_golongan_rows_parent_id ON golongan_rows(parent_id);
CREATE INDEX IF NOT EXISTS idx_document_criteria_rows_document_id ON document_criteria_rows(document_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_positions_parent ON positions(parent_position_id);
CREATE INDEX IF NOT EXISTS idx_positions_branch ON positions(branch_id);
CREATE INDEX IF NOT EXISTS idx_user_branches_user ON user_branches(user_id);
CREATE INDEX IF NOT EXISTS idx_user_branches_branch ON user_branches(branch_id);
CREATE INDEX IF NOT EXISTS idx_position_branches_position ON position_branches(position_id);
CREATE INDEX IF NOT EXISTS idx_position_branches_branch ON position_branches(branch_id);
CREATE INDEX IF NOT EXISTS idx_position_criteria_position ON position_criteria(position_id);
CREATE INDEX IF NOT EXISTS idx_position_criteria_criteria ON position_criteria(criteria_id);
CREATE TABLE IF NOT EXISTS branch_regions (
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    region_id INTEGER NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    PRIMARY KEY (branch_id, region_id)
);
CREATE INDEX IF NOT EXISTS idx_branch_divisions_branch ON branch_divisions(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_divisions_division ON branch_divisions(division_id);
CREATE INDEX IF NOT EXISTS idx_branch_regions_branch ON branch_regions(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_regions_region ON branch_regions(region_id);
CREATE INDEX IF NOT EXISTS idx_branch_regions_branch ON branch_regions(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_regions_region ON branch_regions(region_id);