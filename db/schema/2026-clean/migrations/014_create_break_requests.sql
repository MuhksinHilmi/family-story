-- 014_create_break_requests.sql
-- Break relationship requests (divorce/wrong data)
-- Requires spouse confirmation before breaking marriage connection

CREATE TABLE IF NOT EXISTS break_requests (
    id BIGSERIAL PRIMARY KEY,
    requester_node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    spouse_node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    marriage_id INTEGER NOT NULL REFERENCES marriages(id) ON DELETE CASCADE,
    reason TEXT NOT NULL CHECK (reason IN ('divorce', 'wrong_data')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_break_requests_spouse_node_id ON break_requests(spouse_node_id);
CREATE INDEX IF NOT EXISTS idx_break_requests_status ON break_requests(status);
CREATE INDEX IF NOT EXISTS idx_break_requests_requester ON break_requests(requester_node_id);

COMMENT ON TABLE break_requests IS 'Break relationship requests requiring spouse confirmation';