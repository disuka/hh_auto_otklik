CREATE TABLE IF NOT EXISTS t_disa_logs (
    id BIGSERIAL PRIMARY KEY,
    project VARCHAR(50) NOT NULL,
    level VARCHAR(10) NOT NULL,
    message TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

select * 
from disa_logger_sh.t_disa_logs



