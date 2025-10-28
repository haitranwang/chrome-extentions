-- SQL Script to setup Row Level Security Policies for dexscreener-filter table
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard

-- ============================================
-- STEP 1: Enable RLS (if not already enabled)
-- ============================================
ALTER TABLE public."dexscreener-filter" ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 2: Create Policy to allow SELECT for all users
-- ============================================
CREATE POLICY "Allow public read access"
ON public."dexscreener-filter"
FOR SELECT
TO public
USING (true);

-- ============================================
-- STEP 3: Create Policy to allow INSERT for all users
-- ============================================
CREATE POLICY "Allow public insert access"
ON public."dexscreener-filter"
FOR INSERT
TO public
WITH CHECK (true);

-- ============================================
-- STEP 4: Create Policy to allow DELETE for all users
-- ============================================
CREATE POLICY "Allow public delete access"
ON public."dexscreener-filter"
FOR DELETE
TO public
USING (true);

-- ============================================
-- Alternative: If you want to restrict DELETE to only the user who inserted
-- ============================================
-- This would require an additional column to track user
-- For now, we'll allow public delete for simplicity

