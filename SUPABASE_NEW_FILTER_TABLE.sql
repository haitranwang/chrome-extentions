-- SQL Script to create new_filter table for tracking all filters used
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard

-- ============================================
-- Create new_filter table
-- ============================================
CREATE TABLE IF NOT EXISTS public.new_filter (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  filter_url text NOT NULL,
  chain text,
  CONSTRAINT new_filter_pkey PRIMARY KEY (id)
);

-- ============================================
-- Create index for faster queries
-- ============================================
CREATE INDEX IF NOT EXISTS idx_new_filter_created_at ON public.new_filter(created_at);
CREATE INDEX IF NOT EXISTS idx_new_filter_chain ON public.new_filter(chain);

-- ============================================
-- Enable Row Level Security
-- ============================================
ALTER TABLE public.new_filter ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Create Policies
-- ============================================

-- Allow public INSERT (anyone can add filter data)
CREATE POLICY "Allow public insert access"
ON public.new_filter
FOR INSERT
TO public
WITH CHECK (true);

-- Allow public SELECT (can read own filters)
CREATE POLICY "Allow public read access"
ON public.new_filter
FOR SELECT
TO public
USING (true);

-- Optional: Only allow DELETE for specific users if needed later
-- For now, DELETE is restricted to maintain data integrity

-- ============================================
-- Grant permissions
-- ============================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.new_filter TO anon, authenticated;

