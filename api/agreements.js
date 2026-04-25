import express from 'express';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

// POST /api/agreements — save a parsed agreement
export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { companyName, covenants, facilityDetails } = req.body;
      if (!companyName || !covenants) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const { data, error } = await supabase
        .from('agreements')
        .insert({ company_name: companyName, covenants, facility_details: facilityDetails || {} })
        .select()
        .single();
      if (error) throw error;
      return res.json(data);
    } catch (err) {
      console.error('Store error:', err);
      return res.status(500).json({ error: 'Failed to store agreement' });
    }
  }

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('agreements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return res.json(data || []);
    } catch (err) {
      console.error('Fetch error:', err);
      return res.status(500).json({ error: 'Failed to fetch agreements' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

module.exports = handler;
