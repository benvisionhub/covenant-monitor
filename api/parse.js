import express from 'express';
import cors from 'cors';
import pdfParse from 'pdf-parse';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import { Buffer } from 'buffer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://your-project.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'your-anon-key'
);

// Parse PDF text
async function extractText(pdfBuffer) {
  const data = await pdfParse(Buffer.from(pdfBuffer));
  return data.text;
}

// Extract numeric value from text with context
function extractNumber(text, patterns) {
  for (const pattern of patterns) {
    const regex = new RegExp(pattern, 'i');
    const match = text.match(regex);
    if (match) {
      const num = match[1].replace(/[,$%]/g, '').replace(/–/g, '-');
      const parsed = parseFloat(num);
      if (!isNaN(parsed)) return { value: parsed, context: match[0] };
    }
  }
  return null;
}

// Detect covenant type from text
function detectCovenantType(section) {
  const lower = section.toLowerCase();
  if (lower.includes('leverage') || lower.includes('debt/ebitda') || lower.includes('total debt/ebitda')) return 'leverage_ratio';
  if (lower.includes('interest coverage') || lower.includes('ebitda/interest') || lower.includes('debt service')) return 'interest_coverage';
  if (lower.includes('current ratio') || lower.includes('liquidity') || lower.includes('working capital')) return 'liquidity';
  if (lower.includes('minimum net worth') || lower.includes('tangible net worth') || lower.includes('equity')) return 'net_worth';
  if (lower.includes('debt payment') || lower.includes('amortization')) return 'debt_payment';
  if (lower.includes('capital expenditure') || lower.includes('capex')) return 'capex';
  return 'other';
}

// Extract all covenants from text
function extractCovenants(text) {
  const covenants = [];
  
  // Common covenant patterns
  const patterns = [
    // Leverage
    { type: 'leverage_ratio', patterns: [
      /(?:total debt|total net debt|debt)[\s\S]{0,100}?(?:shall not exceed|may not exceed|maximum|less than|<|=)\s*([\d.]+)\s*(?:x|times)?/i,
      /(?:leverage|debt\/ebitda|total leverage)[\s\S]{0,100}?(?:shall not exceed|may not exceed|maximum|less than|<|=)\s*([\d.]+)\s*(?:x|times)?/i,
      /(?:shall maintain|maintain|not exceed)[\s\S]{0,80}?(?:leverage|debt)[\s\S]{0,40}?(?:less than|<|=)\s*([\d.]+)\s*(?:x|times)?/i,
    ]},
    // Interest coverage
    { type: 'interest_coverage', patterns: [
      /(?:interest coverage|ebitda[\s\S]{0,20}interest|debt service)[\s\S]{0,100}?(?:shall not be less than|minimum|>|=)\s*([\d.]+)\s*(?:x|times)?/i,
      /(?:shall maintain)[\s\S]{0,80}?(?:interest coverage|ebitda)[\s\S]{0,40}?(?:greater than|>|=)\s*([\d.]+)\s*(?:x|times)?/i,
    ]},
    // Liquidity / Current Ratio
    { type: 'liquidity', patterns: [
      /(?:current ratio|liquidity)[\s\S]{0,100}?(?:shall not be less than|minimum|>|=)\s*([\d.]+)/i,
      /(?:shall maintain)[\s\S]{0,80}?(?:current ratio|liquidity)[\s\S]{0,40}?(?:greater than|>|=)\s*([\d.]+)/i,
    ]},
    // Net Worth
    { type: 'net_worth', patterns: [
      /(?:minimum net worth|tangible net worth|net worth)[\s\S]{0,100}?(?:shall not be less than|minimum|>|=)\s*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:million|billion)?/i,
    ]},
    // Capex
    { type: 'capex', patterns: [
      /(?:capital expenditure|capex|capEx)[\s\S]{0,100}?(?:shall not exceed|maximum|less than|<|=)\s*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:million|billion)?/i,
    ]},
  ];

  for (const { type, patterns: rulePatterns } of patterns) {
    for (const pattern of rulePatterns) {
      const matches = text.match(new RegExp(pattern, 'gi'));
      if (matches) {
        for (const match of matches) {
          const numbers = match.match(/[\d,]+\.?\d*/g);
          if (numbers) {
            covenants.push({
              type,
              description: match.substring(0, 200),
              threshold: parseFloat(numbers[numbers.length - 1].replace(/,/g, '')),
              operator: match.toLowerCase().includes('not be less than') || match.toLowerCase().includes('greater than') || match.toLowerCase().includes('exceed') ? 'max' : 'min',
              raw_text: match.substring(0, 300),
            });
          }
        }
      }
    }
  }

  return covenants;
}

// Extract company name from PDF
function extractCompanyName(text) {
  // Look for common patterns
  const patterns = [
    /(?:borrower|company|issuer)[\s\S]{0,50}?(?:name|corporation|inc|llc|ltd)\s*[:\n]\s*([A-Z][A-Za-z\s&,\.]+(?:Inc|Corp|LLC|Ltd|Corporation)?)/i,
    /^([A-Z][A-Za-z\s&,\.]+(?:Inc|Corp|LLC|Ltd|Corporation))\s*$/m,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim().substring(0, 100);
  }
  return 'Unknown Company';
}

// Extract facility details
function extractFacilityDetails(text) {
  const details = {};
  
  // Loan amount
  const amountPatterns = [
    /(?:aggregate|max(?:imum)?)[\s\S]{0,30}?(?:commitment|principal|loan|facility)[\s\S]{0,30}?\$?([\d,]+(?:\.\d+)?)\s*(?:million|billion)?/i,
    /\$([\d,]+(?:\.\d+)?)\s*(?:million|billion)[\s\S]{0,30}?(?:facility|loan|commitment)/i,
  ];
  for (const p of amountPatterns) {
    const m = text.match(p);
    if (m) { details.loanAmount = parseFloat(m[1].replace(/,/g,'')) * (m[0].includes('billion') ? 1000 : 1); break; }
  }

  // Maturity
  const maturityPatterns = [
    /(?:maturity|date)[\s\S]{0,50}?\b(\w+\s+\d{1,2},?\s+\d{4})\b/i,
    /(?:maturity)[\s\S]{0,50}?\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/i,
  ];
  for (const p of maturityPatterns) {
    const m = text.match(p);
    if (m) { details.maturity = m[1]; break; }
  }

  // Interest rate
  const ratePatterns = [
    /(?:interest rate)[\s\S]{0,50}?\b(\d+\.?\d*)\s*%/i,
    /(?:LIBOR|SOFR)[\s\S]{0,30}?\+?\s*(\d+\.?\d*)\s*%/i,
  ];
  for (const p of ratePatterns) {
    const m = text.match(p);
    if (m) { details.interestRate = m[1] + '%'; break; }
  }

  return details;
}

// Upload and parse a credit agreement PDF
router.post('/parse', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const text = await extractText(req.file.buffer);
    const covenants = extractCovenants(text);
    const companyName = extractCompanyName(text);
    const facilityDetails = extractFacilityDetails(text);

    // Remove duplicates by type
    const seen = new Set();
    const uniqueCovenants = covenants.filter(c => {
      if (seen.has(c.type)) return false;
      seen.add(c.type);
      return true;
    });

    res.json({
      companyName,
      facilityDetails,
      covenantCount: uniqueCovenants.length,
      covenants: uniqueCovenants,
      summary: `Found ${uniqueCovenants.length} covenants for ${companyName}`,
    });
  } catch (err) {
    console.error('Parse error:', err);
    res.status(500).json({ error: 'Failed to parse PDF' });
  }
});

// Store parsed result
router.post('/agreements', async (req, res) => {
  try {
    const { companyName, covenants, facilityDetails } = req.body;
    const { data, error } = await supabase
      .from('agreements')
      .insert({ company_name: companyName, covenants, facility_details: facilityDetails })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Store error:', err);
    res.status(500).json({ error: 'Failed to store' });
  }
});

// Get all agreements
router.get('/agreements', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('agreements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch' });
  }
});

export default router;
