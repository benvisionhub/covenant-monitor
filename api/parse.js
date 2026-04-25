import express from 'express';
import cors from 'cors';
import pdfParse from 'pdf-parse';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import { Buffer } from 'buffer';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.raw({ type: 'application/pdf', limit: '10mb' }));

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

async function extractText(data) {
  const parsed = await pdfParse(Buffer.from(data));
  return parsed.text;
}

function detectCovenantType(section) {
  const lower = section.toLowerCase();
  if (lower.includes('leverage') || lower.includes('debt/ebitda') || lower.includes('total debt')) return 'leverage_ratio';
  if (lower.includes('interest coverage') || lower.includes('ebitda/interest') || lower.includes('debt service')) return 'interest_coverage';
  if (lower.includes('current ratio') || lower.includes('liquidity') || lower.includes('working capital')) return 'liquidity';
  if (lower.includes('minimum net worth') || lower.includes('tangible net worth') || lower.includes('net worth')) return 'net_worth';
  if (lower.includes('capital expenditure') || lower.includes('capex')) return 'capex';
  if (lower.includes('debt payment') || lower.includes('amortization')) return 'debt_payment';
  return 'other';
}

function extractCovenants(text) {
  const covenants = [];
  const patterns = [
    { type: 'leverage_ratio', patterns: [
      /(?:total debt|total net debt)[\s\S]{0,100}?(?:shall not exceed|may not exceed|maximum|less than|<)\s*([\d.]+)\s*(?:x|times)?/gi,
      /(?:leverage|debt\/ebitda|total leverage)[\s\S]{0,100}?(?:shall not exceed|may not exceed|maximum|less than|<)\s*([\d.]+)\s*(?:x|times)?/gi,
    ]},
    { type: 'interest_coverage', patterns: [
      /(?:interest coverage|ebitda[\s\S]{0,20}interest|debt service coverage)[\s\S]{0,100}?(?:shall not be less than|minimum|greater than|>)\s*([\d.]+)\s*(?:x|times)?/gi,
    ]},
    { type: 'liquidity', patterns: [
      /(?:current ratio|liquidity)[\s\S]{0,100}?(?:shall not be less than|minimum|greater than|>)\s*([\d.]+)/gi,
    ]},
    { type: 'net_worth', patterns: [
      /(?:minimum net worth|tangible net worth|net worth)[\s\S]{0,100}?(?:shall not be less than|minimum|greater than|>)\s*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:million|billion)?/gi,
    ]},
    { type: 'capex', patterns: [
      /(?:capital expenditure|capex)[\s\S]{0,100}?(?:shall not exceed|maximum|less than|<)\s*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:million|billion)?/gi,
    ]},
  ];

  for (const { type, patterns: rulePatterns } of patterns) {
    for (const pattern of rulePatterns) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(text)) !== null) {
        const numStr = match[1].replace(/,/g, '');
        const threshold = parseFloat(numStr);
        if (!isNaN(threshold) && threshold > 0 && threshold < 10000) {
          covenants.push({
            type,
            description: match[0].substring(0, 200),
            threshold,
            operator: match[0].toLowerCase().includes('not be less than') || match[0].toLowerCase().includes('greater than') || match[0].toLowerCase().includes('exceed') && !match[0].toLowerCase().includes('not exceed') ? 'max' : 'min',
            raw_text: match[0].substring(0, 300),
          });
        }
      }
    }
  }

  return covenants;
}

function extractCompanyName(text) {
  const patterns = [
    /(?:borrower|company|issuer)[\s\S]{0,50}?(?:name|corporation|inc|llc|ltd)[:\n]\s*([A-Z][A-Za-z\s&,\.]+(?:Inc|Corp|LLC|Ltd|Corporation)?)/i,
    /^([A-Z][A-Za-z\s&,\.]+(?:Inc|Corp|LLC|Ltd|Corporation)?)\s*$/m,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim().substring(0, 100);
  }
  return 'Credit Agreement';
}

function extractFacilityDetails(text) {
  const details = {};
  const amountPatterns = [
    /(?:aggregate|max(?:imum)?)[\s\S]{0,30}?(?:commitment|principal|loan|facility)[\s\S]{0,30}?\$?([\d,]+(?:\.\d+)?)\s*(?:million|billion)?/i,
    /\$([\d,]+(?:\.\d+)?)\s*(?:million|billion)[\s\S]{0,30}?(?:facility|loan|commitment)/i,
  ];
  for (const p of amountPatterns) {
    const m = text.match(p);
    if (m) { details.loanAmount = parseFloat(m[1].replace(/,/g,'')) * (m[0].includes('billion') ? 1000 : m[0].includes('million') ? 1 : 0.001); break; }
  }
  const maturityPatterns = [
    /(?:maturity|date)[\s\S]{0,50}?\b(\w+\s+\d{1,2},?\s+\d{4})\b/i,
    /(?:maturity)[\s\S]{0,50}?\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/i,
  ];
  for (const p of maturityPatterns) {
    const m = text.match(p);
    if (m) { details.maturity = m[1]; break; }
  }
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

// POST /api/parse — parse a credit agreement PDF
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let pdfData;
    if (req.body) {
      pdfData = req.body;
    } else if (req.rawBody) {
      pdfData = req.rawBody;
    } else {
      return res.status(400).json({ error: 'No PDF data provided' });
    }

    const text = await extractText(pdfData);
    const covenants = extractCovenants(text);
    const companyName = extractCompanyName(text);
    const facilityDetails = extractFacilityDetails(text);

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
    res.status(500).json({ error: 'Failed to parse PDF: ' + err.message });
  }
}

module.exports = handler;
