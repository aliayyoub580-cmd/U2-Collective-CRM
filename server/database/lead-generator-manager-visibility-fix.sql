-- Make existing Lead Generator leads visible in the Manager portal when the
-- CRM has exactly one active Manager. With multiple Managers, ownership stays
-- unassigned so Admin can choose the correct Manager explicitly.

BEGIN;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS lead_id BIGINT REFERENCES leads(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_tasks_lead_id ON tasks(lead_id);

UPDATE leads
SET manager_id = (
      SELECT MIN(id)
      FROM users
      WHERE role = 'Manager' AND status = 'active'
      HAVING COUNT(*) = 1
    ),
    current_owner_id = (
      SELECT MIN(id)
      FROM users
      WHERE role = 'Manager' AND status = 'active'
      HAVING COUNT(*) = 1
    ),
    workflow_status = 'assigned_to_manager',
    assigned_to_manager_at = COALESCE(assigned_to_manager_at, NOW()),
    manager_assignment_notes = COALESCE(
      manager_assignment_notes,
      'Automatic ownership backfill: only active Manager'
    ),
    updated_at = NOW()
WHERE manager_id IS NULL
  AND lead_generator_id IS NOT NULL
  AND COALESCE(workflow_status, 'new') = 'new'
  AND (SELECT COUNT(*) FROM users WHERE role = 'Manager' AND status = 'active') = 1;

COMMIT;

-- Verification: these should be zero when there is exactly one active Manager.
SELECT id, lead_id, lead_generator_id, manager_id, workflow_status
FROM leads
WHERE lead_generator_id IS NOT NULL AND manager_id IS NULL;
