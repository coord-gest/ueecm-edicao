-- Enable RLS on realtime.messages and restrict to authenticated users
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "realtime_authenticated_read" ON realtime.messages;
DROP POLICY IF EXISTS "realtime_authenticated_write" ON realtime.messages;

-- Only authenticated users can receive realtime messages
CREATE POLICY "realtime_authenticated_read"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);

-- Only authenticated users can broadcast/send realtime messages
CREATE POLICY "realtime_authenticated_write"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (true);
