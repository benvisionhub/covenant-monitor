import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://your-project.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'your-anon-key'
);

// Check covenant compliance given financial metrics
router.post('/check', async (req, res) => {
  try {
    const { agreementId, financials } = req.body;
    
    // Fetch the agreement
    const { data: agreement, error } = await supabase
      .from('agreements')
      .select('*')
      .eq('id', agreementId)
      .single();
    
    if (error || !agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    const covenants = agreement.covenants || [];
    const results = covenants.map(cov => {
      const metric = financials[cov.type];
      if (metric === undefined) return { ...cov, status: 'unknown', current: null };
      
      const current = parseFloat(metric);
      let status;
      
      if (cov.operator === 'max') {
        status = current <= cov.threshold ? 'pass' : 'breach';
      } else {
        status = current >= cov.threshold ? 'pass' : 'breach';
      }
      
      return {
        ...cov,
        current,
        status,
        headroom: cov.operator === 'max' 
          ? cov.threshold - current 
          : current - cov.threshold,
      };
    });

    res.json({ results, summary: { pass: results.filter(r => r.status === 'pass').length, breach: results.filter(r => r.status === 'breach').length } });
  } catch (err) {
    console.error('Check error:', err);
    res.status(500).json({ error: 'Failed to check covenants' });
  }
});

export default router;
