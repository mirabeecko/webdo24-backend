-- Fix infinite recursion in profiles RLS policy
DROP POLICY IF EXISTS "profiles_select_self_or_admin" ON profiles;

-- Create fixed policy without recursion
CREATE POLICY "profiles_select_policy" ON profiles
FOR SELECT
USING (
  id = auth.uid() 
  OR 
  role = 'admin'
);

-- Ensure bookings policies work without auth requirement for reads
DROP POLICY IF EXISTS "Users can view all bookings for admin" ON bookings;

CREATE POLICY "bookings_select_policy" ON bookings
FOR SELECT
USING (true);;
