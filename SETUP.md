# Quick Setup Guide

## Prerequisites
- Node.js 18+ installed
- A Supabase account

## Step-by-Step Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Set up Supabase
1. Go to [supabase.com](https://supabase.com) and create a new project
2. In your Supabase project, go to the SQL Editor
3. Copy and paste the contents of `database-schema.sql` and run it
4. Go to Settings > API to get your project URL and anon key

### 3. Configure Environment
1. Copy `env.example` to `.env.local`
2. Fill in your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

### 4. Run the Application
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## What You'll See
- A dropdown to select between Brand Alpha, Brand Beta, and Brand Gamma
- An inventory dashboard showing products with editable fields
- Automatic calculations for final stock and available stock
- Summary cards showing totals across all products

## Testing the System
1. Select different brands from the dropdown
2. Change the date to see different inventory data
3. Edit the input fields to see real-time updates
4. Watch the calculated values update automatically

## Troubleshooting
- Make sure your Supabase project URL and anon key are correct
- Check that the database schema was created successfully
- Verify that sample data was inserted
- Check the browser console for any errors
