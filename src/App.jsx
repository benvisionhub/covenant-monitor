import { useState, useRef } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const COVENANT_LABELS = {
  leverage_ratio: 'Leverage Ratio (Debt/EBITDA)',
  interest_coverage: 'Interest Coverage',
  liquidity: 'Liquidity Ratio',
  net_worth: 'Net Worth',
  debt_payment: 'Debt Payment',
  capex: 'CapEx Limit',
};

const STATUS_COLORS = {
  pass: '#22c55e',
  breach: '#ef4444',
  unknown: '#94a3b8',
};

export default function App() {
  const [activeTab, setActiveTab] = useState('upload');
  const [agreements, setAgreements] = useState([]);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [error, setError] = useState(null);
  const [loadingAgreements, setLoadingAgreements] = useState(false);
  const fileInputRef = useRef(null);

  // Covenant check state
  const [checkMetrics, setCheckMetrics] = useState({});
  const [checkResults, setCheckResults] = useState(null);
  const [checking, setChecking] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setUploadedFile(file);
      setParsedData(null);
      setError(null);
    } else {
      setError('Please upload a PDF file');
    }
  };

  const handleParse = async () => {
    if (!uploadedFile) return;
    setParsing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);
      const res = await fetch(`${API_URL}/api/parse`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Parse failed');
      setParsedData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setParsing(false);
    }
  };

  const handleSave = async () => {
    if (!parsedData) return;
    try {
      const res = await fetch(`${API_URL}/api/agreements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: parsedData.companyName,
          covenants: parsedData.covenants,
          facilityDetails: parsedData.facilityDetails,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setParsedData(null);
      setUploadedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setActiveTab('agreements');
    } catch (err) {
      setError(err.message);
    }
  };

  const loadAgreements = async () => {
    setLoadingAgreements(true);
    try {
      const res = await fetch(`${API_URL}/api/agreements`);
      const data = await res.json();
      setAgreements(Array.isArray(data) ? data : []);
    } catch {
      setAgreements([]);
    } finally {
      setLoadingAgreements(false);
    }
  };

  const handleCheck = async (agreementId) => {
    setChecking(true);
    setCheckResults(null);
    try {
      const res = await fetch(`${API_URL}/api/covenant/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agreementId, financials: checkMetrics }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCheckResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">📋</span>
            <span className="logo-text">Covenant<span className="logo-accent">IQ</span></span>
          </div>
          <nav className="nav">
            <button className={`nav-btn ${activeTab === 'upload' ? 'active' : ''}`} onClick={() => setActiveTab('upload')}>Upload</button>
            <button className={`nav-btn ${activeTab === 'agreements' ? 'active' : ''}`} onClick={() => { setActiveTab('agreements'); loadAgreements(); }}>Agreements</button>
          </nav>
        </div>
      </header>

      <main className="main">
        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="upload-view">
            <div className="hero">
              <h1>Upload Credit Agreement</h1>
              <p>Paste your credit agreement PDF. We extract the covenants automatically — no manual encoding needed.</p>
            </div>

            {!parsedData ? (
              <div className="upload-zone">
                <div className="file-input-wrapper">
                  <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileChange} className="file-input" />
                  <div className="file-input-display">
                    {uploadedFile ? (
                      <div className="file-selected">
                        <span className="file-icon">📄</span>
                        <span className="file-name">{uploadedFile.name}</span>
                        <span className="file-size">({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                      </div>
                    ) : (
                      <div className="file-placeholder">
                        <span className="upload-icon">⬆️</span>
                        <span>Drop PDF here or click to browse</span>
                        <span className="upload-hint">Max 10MB</span>
                      </div>
                    )}
                  </div>
                </div>
                <button className="btn-primary" onClick={handleParse} disabled={!uploadedFile || parsing}>
                  {parsing ? '⏳ Parsing...' : 'Extract Covenants'}
                </button>
              </div>
            ) : (
              <div className="parsed-results">
                <div className="result-header">
                  <div>
                    <h2>{parsedData.companyName}</h2>
                    <p className="result-summary">{parsedData.summary}</p>
                  </div>
                  <div className="result-actions">
                    <button className="btn-secondary" onClick={() => { setParsedData(null); setUploadedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>Upload Another</button>
                    <button className="btn-primary" onClick={handleSave}>Save Agreement</button>
                  </div>
                </div>

                {parsedData.facilityDetails && Object.keys(parsedData.facilityDetails).length > 0 && (
                  <div className="facility-card">
                    <h3>Facility Details</h3>
                    <div className="facility-grid">
                      {parsedData.facilityDetails.loanAmount && (
                        <div className="facility-item"><span className="facility-label">Loan Amount</span><span className="facility-value">${parsedData.facilityDetails.loanAmount.toFixed(1)}M</span></div>
                      )}
                      {parsedData.facilityDetails.maturity && (
                        <div className="facility-item"><span className="facility-label">Maturity</span><span className="facility-value">{parsedData.facilityDetails.maturity}</span></div>
                      )}
                      {parsedData.facilityDetails.interestRate && (
                        <div className="facility-item"><span className="facility-label">Interest Rate</span><span className="facility-value">{parsedData.facilityDetails.interestRate}</span></div>
                      )}
                    </div>
                  </div>
                )}

                <div className="covenants-list">
                  <h3>Detected Covenants ({parsedData.covenants.length})</h3>
                  {parsedData.covenants.length === 0 ? (
                    <div className="no-covenants">
                      <p>No structured covenants detected. This may be a covenant-lite agreement or the PDF format wasn't readable.</p>
                      <p className="no-covenants-hint">Try a different PDF or manually add covenants after saving.</p>
                    </div>
                  ) : (
                    parsedData.covenants.map((cov, i) => (
                      <div key={i} className="covenant-card">
                        <div className="covenant-header">
                          <span className="covenant-type">{COVENANT_LABELS[cov.type] || cov.type}</span>
                          <span className={`covenant-threshold ${cov.operator}`}>
                            {cov.operator === 'max' ? '≤' : '≥'} {cov.threshold}
                          </span>
                        </div>
                        <p className="covenant-text">{cov.raw_text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'agreements' && (
          <div className="agreements-view">
            <div className="hero">
              <h1>Saved Agreements</h1>
              <p>Select an agreement to check compliance against current financials.</p>
            </div>

            {loadingAgreements ? (
              <div className="loading">Loading...</div>
            ) : agreements.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">📋</span>
                <h3>No agreements yet</h3>
                <p>Upload a credit agreement to get started.</p>
                <button className="btn-primary" onClick={() => setActiveTab('upload')}>Upload First Agreement</button>
              </div>
            ) : (
              <div className="agreements-list">
                {agreements.map((agg) => (
                  <div key={agg.id} className="agreement-card">
                    <div className="agreement-header">
                      <h3>{agg.company_name}</h3>
                      <span className="agreement-date">{new Date(agg.created_at).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="agreement-covenants-summary">
                      <span className="cov-count">{agg.covenants?.length || 0} covenants detected</span>
                    </div>

                    {agg.facility_details && Object.keys(agg.facility_details).length > 0 && (
                      <div className="agreement-facility">
                        {agg.facility_details.loanAmount && <span>${agg.facility_details.loanAmount.toFixed(1)}M</span>}
                        {agg.facility_details.maturity && <span>Matures {agg.facility_details.maturity}</span>}
                      </div>
                    )}

                    <div className="check-section">
                      <h4>Check Compliance</h4>
                      <div className="metrics-grid">
                        {(agg.covenants || []).map((cov, i) => (
                          <div key={i} className="metric-input">
                            <label>{COVENANT_LABELS[cov.type] || cov.type}</label>
                            <input
                              type="number"
                              placeholder={cov.operator === 'max' ? `Max: ${cov.threshold}` : `Min: ${cov.threshold}`}
                              value={checkMetrics[cov.type] || ''}
                              onChange={(e) => setCheckMetrics({ ...checkMetrics, [cov.type]: e.target.value })}
                            />
                          </div>
                        ))}
                      </div>
                      <button className="btn-primary" onClick={() => handleCheck(agg.id)} disabled={checking}>
                        {checking ? 'Checking...' : 'Check Compliance'}
                      </button>
                    </div>

                    {checkResults && (
                      <div className="check-results">
                        <h4>Results</h4>
                        <div className="results-summary">
                          <span className="pass-count">✅ {checkResults.summary.pass} Pass</span>
                          <span className="breach-count">❌ {checkResults.summary.breach} Breach</span>
                        </div>
                        {checkResults.results.map((r, i) => (
                          <div key={i} className="result-item" style={{ borderLeftColor: STATUS_COLORS[r.status] }}>
                            <span className="result-type">{COVENANT_LABELS[r.type] || r.type}</span>
                            <span className="result-values">
                              Current: <strong>{r.current}</strong> | Threshold: <strong>{r.operator === 'max' ? '≤' : '≥'}{r.threshold}</strong>
                            </span>
                            <span className={`result-status ${r.status}`}>{r.status.toUpperCase()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="footer">
        <p>CovenantIQ MVP · Built with AI · {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
