-- Create security definer function to check if user is admin FIRST
-- This function executes with owner privileges, avoiding RLS recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- Drop all policies that depend on profiles.role column
DROP POLICY IF EXISTS "reservations_select_own_or_admin" ON public.reservations;
DROP POLICY IF EXISTS "reservations_update_admin" ON public.reservations;
DROP POLICY IF EXISTS "reservations_delete_admin" ON public.reservations;
DROP POLICY IF EXISTS "Admin can update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admin can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;

-- Now drop the role column
ALTER TABLE public.profiles DROP COLUMN role;

-- Recreate policies using the new security definer function
CREATE POLICY "profiles_select_policy" 
ON public.profiles 
FOR SELECT 
USING (id = auth.uid() OR public.is_admin());

-- Fix reservations policies
CREATE POLICY "reservations_select_own_or_admin" 
ON public.reservations 
FOR SELECT 
USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "reservations_update_admin" 
ON public.reservations 
FOR UPDATE 
USING (public.is_admin());

CREATE POLICY "reservations_delete_admin" 
ON public.reservations 
FOR DELETE 
USING (public.is_admin());

-- Fix bookings table RLS - replace public access with proper policies
DROP POLICY IF EXISTS "bookings_select_policy" ON public.bookings;

-- Allow users to view their own bookings by email, or admins to view all
CREATE POLICY "Users can view own bookings or admins view all" 
ON public.bookings 
FOR SELECT 
USING (customer_email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR public.is_admin());

CREATE POLICY "Admin can update bookings" 
ON public.bookings 
FOR UPDATE 
USING (public.is_admin());

-- Fix user_roles policies
CREATE POLICY "Admin can view all roles" 
ON public.user_roles 
FOR SELECT 
USING (public.is_admin());

-- Enable RLS on vehicles table and create policies
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Allow public read access to vehicles (needed for browsing)
CREATE POLICY "Anyone can view vehicles" 
ON public.vehicles 
FOR SELECT 
USING (true);

-- Only admins can modify vehicles
CREATE POLICY "Admins can insert vehicles" 
ON public.vehicles 
FOR INSERT 
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update vehicles" 
ON public.vehicles 
FOR UPDATE 
USING (public.is_admin());

CREATE POLICY "Admins can delete vehicles" 
ON public.vehicles 
FOR DELETE 
USING (public.is_admin());

-- Enable RLS on contact_form and contact_messages
ALTER TABLE public.contact_form ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Contact forms: anyone can insert, only admins can view
CREATE POLICY "Anyone can submit contact form" 
ON public.contact_form 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins can view contact forms" 
ON public.contact_form 
FOR SELECT 
USING (public.is_admin());

CREATE POLICY "Anyone can submit contact message" 
ON public.contact_messages 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins can view contact messages" 
ON public.contact_messages 
FOR SELECT 
USING (public.is_admin());;
