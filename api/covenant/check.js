import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

const COVENANT_LABELS = {
  leverage_ratio: 'Leverage Ratio',
  interest_coverage: 'Interest Coverage',
  liquidity: 'Liquidity Ratio',
  net_worth: 'Net Worth',
  debt_payment: 'Debt Payment',
  capex: 'CapEx',
  other: 'Other',
};

// POST /api/covenant/check
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { agreementId, financials } = req.body;
    if (!agreementId) {
      return res.status(400).json({ error: 'Agreement ID required' });
    }

    // Fetch agreement from Supabase
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
      const metric = financials ? financials[cov.type] : undefined;
      if (metric === undefined || metric === null || metric === '') {
        return { ...cov, status: 'unknown', current: null };
      }

      const current = parseFloat(metric);
      if (isNaN(current)) {
        return { ...cov, status: 'unknown', current: null };
      }

      let status;
      const threshold = parseFloat(cov.threshold);

      if (cov.operator === 'max') {
        status = current <= threshold ? 'pass' : 'breach';
      } else {
        status = current >= threshold ? 'pass' : 'breach';
      }

      return {
        ...cov,
        current,
        status,
        headroom: cov.operator === 'max'
          ? +(threshold - current).toFixed(2)
          : +(current - threshold).toFixed(2),
      };
    });

    return res.json({
      results,
      summary: {
        pass: results.filter(r => r.status === 'pass').length,
        breach: results.filter(r => r.status === 'breach').length,
        unknown: results.filter(r => r.status === 'unknown').length,
      },
    });
  } catch (err) {
    console.error('Check error:', err);
    return res.status(500).json({ error: 'Failed to check covenants' });
  }
}

module.exports = handler;
