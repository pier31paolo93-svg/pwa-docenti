-- Pre-deploy ACL hardening. Keep the 16 published migrations unchanged.
-- Trigger execution does not require the application roles to have direct EXECUTE.
revoke all on function private.validate_assessment_completeness()
from public, anon, authenticated;
