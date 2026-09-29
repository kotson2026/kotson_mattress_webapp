-- =============================================================================
-- KOTSON PRODUCTION POSTGRESQL / SUPABASE MIGRATION 008
-- WORKFORCE, SHIFTS, ATTENDANCE, LEAVE, SALARY STRUCTURES & PAYROLL
-- =============================================================================

CREATE TABLE IF NOT EXISTS attendance_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    employee_name VARCHAR(255) NOT NULL,
    employee_email VARCHAR(255) NOT NULL,
    manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
    date VARCHAR(20) NOT NULL,
    shift_name VARCHAR(150) NOT NULL DEFAULT 'Standard Day Shift (09:30 AM - 06:30 PM)',
    clock_in_at TIMESTAMPTZ,
    clock_out_at TIMESTAMPTZ,
    breaks JSONB NOT NULL DEFAULT '[]'::JSONB,
    status VARCHAR(50) NOT NULL DEFAULT 'present',
    gross_minutes NUMERIC(8, 2) NOT NULL DEFAULT 0.0,
    break_minutes NUMERIC(8, 2) NOT NULL DEFAULT 0.0,
    net_minutes NUMERIC(8, 2) NOT NULL DEFAULT 0.0,
    is_late BOOLEAN NOT NULL DEFAULT FALSE,
    is_early_departure BOOLEAN NOT NULL DEFAULT FALSE,
    is_test_data BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_att_sessions_emp_date ON attendance_sessions(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_att_sessions_date ON attendance_sessions(date);

CREATE TABLE IF NOT EXISTS attendance_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    employee_name VARCHAR(255) NOT NULL,
    date VARCHAR(20) NOT NULL,
    requested_clock_in TIMESTAMPTZ NOT NULL,
    requested_clock_out TIMESTAMPTZ NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewer_note TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_att_corr_emp ON attendance_corrections(employee_id);
CREATE INDEX IF NOT EXISTS idx_att_corr_status ON attendance_corrections(status);

CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    employee_name VARCHAR(255) NOT NULL,
    employee_email VARCHAR(255) NOT NULL,
    manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
    leave_type_code VARCHAR(50) NOT NULL,
    leave_type_label VARCHAR(100) NOT NULL,
    from_date VARCHAR(20) NOT NULL,
    to_date VARCHAR(20) NOT NULL,
    days_count NUMERIC(5, 2) NOT NULL DEFAULT 1.0,
    is_half_day BOOLEAN NOT NULL DEFAULT FALSE,
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewer_note TEXT,
    reviewed_at TIMESTAMPTZ,
    is_test_data BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_emp ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_requests(status);

CREATE TABLE IF NOT EXISTS salary_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    monthly_gross_paise BIGINT NOT NULL DEFAULT 3500000,
    basic_paise BIGINT NOT NULL DEFAULT 1750000,
    hra_paise BIGINT NOT NULL DEFAULT 875000,
    special_allowance_paise BIGINT NOT NULL DEFAULT 875000,
    standard_deductions_paise BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_salary_emp ON salary_structures(employee_id);

CREATE TABLE IF NOT EXISTS payroll_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    working_days INT NOT NULL DEFAULT 26,
    total_gross_paise BIGINT NOT NULL DEFAULT 0,
    total_deductions_paise BIGINT NOT NULL DEFAULT 0,
    total_net_paise BIGINT NOT NULL DEFAULT 0,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    payment_reference VARCHAR(150),
    is_test_data BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_periods_month ON payroll_periods(month);

CREATE TABLE IF NOT EXISTS payroll_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id UUID NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
    month VARCHAR(20) NOT NULL,
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    employee_name VARCHAR(255) NOT NULL,
    employee_role VARCHAR(100) NOT NULL DEFAULT 'EMPLOYEE',
    manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
    working_days INT NOT NULL DEFAULT 26,
    present_days NUMERIC(5, 2) NOT NULL DEFAULT 26.0,
    paid_leaves NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
    unpaid_leaves NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
    half_days INT NOT NULL DEFAULT 0,
    absent_days NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
    gross_salary_paise BIGINT NOT NULL DEFAULT 3500000,
    lop_deduction_paise BIGINT NOT NULL DEFAULT 0,
    overtime_paise BIGINT NOT NULL DEFAULT 0,
    incentives_paise BIGINT NOT NULL DEFAULT 0,
    deductions_paise BIGINT NOT NULL DEFAULT 0,
    net_payable_paise BIGINT NOT NULL DEFAULT 3500000,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    notes TEXT,
    is_test_data BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_rec_period ON payroll_records(period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_rec_emp ON payroll_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_rec_month ON payroll_records(month);
