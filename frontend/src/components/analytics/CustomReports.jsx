import React, { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../common/Icon';
import { enterpriseAPI, jobsAPI, workableAPI } from '../../services/api';

const card = { padding: 16, borderRadius: 10, background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)' };
const subTitle = { fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 4px' };
const muted = { fontSize: 12, color: '#6b7280', margin: 0 };

export default function CustomReports() {
  const fileInputRef = useRef(null);
  const [selectedCohort, setSelectedCohort] = useState('all');
  const [timeRange, setTimeRange] = useState('quarter');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [integrationLoading, setIntegrationLoading] = useState('');
  const [branding, setBranding] = useState(() => loadFromStorage('enterpriseBranding', {
    orgName: 'Northbridge Career Services',
    accent: '#1d4ed8',
    domain: 'careers.northbridge.edu',
    whiteLabel: true,
  }));
  const [compliance, setCompliance] = useState(() => loadFromStorage('enterpriseCompliance', {
    soc2: true,
    ferpa: true,
    gdpr: false,
    dataRetention: true,
  }));
  const [integrations, setIntegrations] = useState(() => {
    const stored = loadFromStorage('enterpriseIntegrations', [
      { id: 'workable', name: 'Workable', status: 'Connected', lastSync: 'Never', type: 'ATS + job sync (RapidAPI)', jobsImported: 0 },
    ]);
    // Normalize any legacy Handshake entry to Workable
    const normalized = (stored || []).map((item) => {
      if (item.id === 'handshake') {
        return { ...item, id: 'workable', name: 'Workable', type: 'ATS + job sync (RapidAPI)' };
      }
      return item;
    });
    return normalized.slice(0, 1);
  });
  const [cohorts, setCohorts] = useState(() =>
    loadFromStorage('enterpriseCohorts', [
      { id: 'fellows', name: 'Tech Fellows 2025', size: 240, active: 226, placement: 62, response: 48, avgDays: 68, manager: 'Riley Shaw', focus: 'Software / DS', risk: 'Low' },
      { id: 'career-sprint', name: 'Career Sprint Q2', size: 180, active: 171, placement: 54, response: 39, avgDays: 74, manager: 'Priya Mehta', focus: 'Business / Ops', risk: 'Medium' },
      { id: 'veterans', name: 'Veterans Pathways', size: 90, active: 82, placement: 44, response: 51, avgDays: 63, manager: 'Chris Ward', focus: 'Cyber / IT', risk: 'Low' },
    ])
  );
  const [effectiveness, setEffectiveness] = useState(() =>
    loadFromStorage('enterpriseEffectiveness', [
      { label: 'Offer conversion', value: '32%', change: '+4% vs last quarter' },
      { label: 'Interview-to-offer speed', value: '21 days', change: '3 days faster' },
      { label: 'Avg. salary lift', value: '$18.5k', change: '+$2.1k vs baseline' },
      { label: 'Program ROI', value: '3.4x', change: 'Trending upward' },
    ])
  );
  const [roiRows, setRoiRows] = useState(() =>
    loadFromStorage('enterpriseRoiRows', [
      { program: 'Tech Fellows 2025', spend: '$420k', placements: 132, salaryLift: '$18.5k', roi: '3.4x', payback: '4.5 mo' },
      { program: 'Career Sprint Q2', spend: '$280k', placements: 96, salaryLift: '$14.2k', roi: '2.7x', payback: '5.2 mo' },
      { program: 'Veterans Pathways', spend: '$150k', placements: 61, salaryLift: '$16.8k', roi: '3.0x', payback: '4.1 mo' },
    ])
  );

  useEffect(() => persist('enterpriseBranding', branding), [branding]);
  useEffect(() => persist('enterpriseCompliance', compliance), [compliance]);
  useEffect(() => persist('enterpriseIntegrations', integrations), [integrations]);
  useEffect(() => persist('enterpriseCohorts', cohorts), [cohorts]);
  useEffect(() => persist('enterpriseEffectiveness', effectiveness), [effectiveness]);
  useEffect(() => persist('enterpriseRoiRows', roiRows), [roiRows]);

  useEffect(() => {
    fetchReports(timeRange);
  }, [timeRange]);

  const filteredCohorts = useMemo(() => {
    if (selectedCohort === 'all') return cohorts;
    return cohorts.filter((c) => c.id === selectedCohort);
  }, [selectedCohort, cohorts]);

  const fetchReports = async (range) => {
    setLoading(true);
    setError('');
    try {
      const data = await enterpriseAPI.getReports(range);
      if (data?.branding) setBranding((prev) => ({ ...prev, ...data.branding }));
      if (data?.compliance) setCompliance((prev) => ({ ...prev, ...data.compliance }));
      if (Array.isArray(data?.integrations)) setIntegrations(data.integrations);
      if (Array.isArray(data?.cohorts)) setCohorts(data.cohorts);
      const roiData = data?.roi || data?.roi_rows || data?.roiRows;
      if (Array.isArray(roiData)) setRoiRows(roiData);
      const effectData = data?.effectiveness || data?.metrics;
      if (Array.isArray(effectData)) setEffectiveness(effectData);
      setMessage(`Reports refreshed for ${range}`);
    } catch (err) {
      console.error('Enterprise reports fetch failed', err);
      setError(err?.message || 'Failed to load enterprise reports');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 3200);
    }
  };

  const handleReportGenerate = async (format) => {
    try {
      const payload = {
        generatedAt: new Date().toISOString(),
        timeRange,
        cohorts: filteredCohorts,
        roi: roiRows,
        effectiveness,
      };

      if (format === 'csv') {
        const csv = buildCohortCsv(filteredCohorts);
        downloadFile(csv, `program-report-${timeRange}.csv`, 'text/csv');
      } else {
        // placeholder for backend PDF export: currently exports JSON; swap to enterpriseAPI.exportReports when available
        downloadFile(JSON.stringify(payload, null, 2), `program-report-${timeRange}.json`, 'application/json');
      }

      setMessage(`Program effectiveness report exported (${format.toUpperCase()}) for ${timeRange}.`);
      setTimeout(() => setMessage(''), 3200);
    } catch (err) {
      setError('Failed to export report');
    }
  };

  const handleBulkAction = (action) => {
    setMessage(action);
    setTimeout(() => setMessage(''), 2600);
  };

  const toggleIntegration = async (integration) => {
    setIntegrationLoading(integration.id);
    setError('');
    try {
      let updated;
      if (integration.status === 'Connected') {
        updated = await workableAPI.disable();
        setIntegrations((prev) =>
          prev.map((item) =>
            item.id === integration.id
              ? { ...item, ...updated, status: 'Disabled', jobsImported: item.jobsImported ?? 0, lastSync: new Date().toISOString() }
              : item
          )
        );
      } else {
        updated = await workableAPI.sync();
        await handleSyncIntegration({ ...integration, ...updated }, { silent: true });
      }
      setMessage(`Integration ${updated?.status || 'updated'}`);
    } catch (err) {
      setError(err?.message || 'Failed to update integration');
    } finally {
      setIntegrationLoading('');
      setTimeout(() => setMessage(''), 2600);
    }
  };

  const toggleCompliance = (key) => {
    setCompliance((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSyncIntegration = async (integration, { silent } = {}) => {
    setIntegrationLoading(integration.id);
    try {
      let jobList = [];
      let count = 0;
      let lastSync = new Date().toISOString();

      if (integration.id === 'workable') {
        const syncResult = await workableAPI.sync();
        jobList = syncResult?.jobs || [];
        count = syncResult?.jobs_imported || jobList.length || 0;
        lastSync = syncResult?.last_sync || lastSync;

        try {
          const importResult = await workableAPI.importJobs(jobList);
          count = importResult?.imported ?? count;
          lastSync = importResult?.last_sync || lastSync;
          if (!silent) {
            setMessage(`Imported ${importResult?.imported ?? count} jobs from Workable`);
          }
        } catch (importErr) {
          console.warn('Workable import failed', importErr);
          setError(importErr?.message || 'Import failed after sync');
        }
      } else {
        const updated = await enterpriseAPI.syncIntegration(integration.id);
        const jobs = await jobsAPI.getJobs({ limit: 20, source: integration.id });
        jobList = Array.isArray(jobs) ? jobs : jobs?.results || jobs?.items || [];
        count = jobList.length || (typeof jobs?.count === 'number' ? jobs.count : 0);
        lastSync = new Date().toISOString();
        setIntegrations((prev) =>
          prev.map((item) =>
            item.id === integration.id
              ? { ...item, ...updated, status: 'Connected', lastSync }
              : item
          )
        );
      }

      setIntegrations((prev) =>
        prev.map((item) =>
          item.id === integration.id
            ? {
                ...item,
                status: 'Connected',
                jobsImported: count,
                lastSync,
              }
            : item
        )
      );
      if (!silent && !message) setMessage(`Synced ${count} jobs from ${integration.name || 'integration'}`);
    } catch (err) {
      setError(err?.message || 'Failed to sync; jobs not updated');
    } finally {
      setIntegrationLoading('');
      if (!silent) setTimeout(() => setMessage(''), 2600);
    }
  };

  const loadIntegrations = async () => {
    setIntegrationLoading('all');
    setIntegrationLoading('');
  };

  useEffect(() => {
    loadIntegrations();
  }, []);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleCsvUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result || '';
        const parsed = parseCohortCsv(text.toString());
        if (parsed.length) {
          setCohorts(parsed);
          setMessage(`Imported ${parsed.length} cohorts from CSV`);
        } else {
          setMessage('CSV parsed, but no rows found');
        }
      } catch (err) {
        console.error('CSV parse error', err);
        setMessage('Failed to parse CSV. Expected headers: name,size,active,placement,response,avgDays,manager,focus,risk');
      } finally {
        setTimeout(() => setMessage(''), 3200);
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const aggregateStats = [
    { label: 'Active cohorts', value: cohorts.length, icon: 'layers', highlight: '#2563eb' },
    { label: 'Job seekers', value: filteredCohorts.reduce((sum, c) => sum + c.active, 0), icon: 'users', highlight: '#0ea5e9' },
    { label: 'Avg. placement rate', value: `${Math.round(filteredCohorts.reduce((sum, c) => sum + c.placement, 0) / Math.max(filteredCohorts.length, 1))}%`, icon: 'target', highlight: '#16a34a' },
    { label: 'White-label ready', value: branding.whiteLabel ? 'On' : 'Off', icon: 'layout', highlight: '#9333ea' },
  ];

  return (
    <div style={{ display: 'grid', gap: 16, padding: 16, background: '#f8fafc' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800, color: '#0f172a' }}>Enterprise Program Command Center</h1>
          <p style={{ margin: 0, color: '#475569', fontSize: 13 }}>
            Manage large cohorts, enforce compliance, and ship enterprise-ready reporting for institutional partners.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <span style={{ padding: '4px 10px', borderRadius: 999, background: branding.accent, color: '#fff', fontWeight: 700, fontSize: 12 }}>
              {branding.orgName}
            </span>
            <span style={{ padding: '4px 10px', borderRadius: 999, background: branding.whiteLabel ? '#dcfce7' : '#f1f5f9', color: branding.whiteLabel ? '#166534' : '#334155', fontWeight: 700, fontSize: 12 }}>
              White label {branding.whiteLabel ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => fetchReports(timeRange)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontWeight: 600, cursor: 'pointer' }}
          >
            <Icon name="refresh" />
            Refresh data
          </button>
          <button
            type="button"
            onClick={() => handleReportGenerate('csv')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 8, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
          >
            <Icon name="download" />
            Export summary
          </button>
        </div>
      </div>

      {message && (
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #bfdbfe', background: '#eff6ff' }}>
          <Icon name="info" color="#1d4ed8" />
          <div>
            <div style={{ fontWeight: 700, color: '#1d4ed8' }}>Action queued</div>
            <div style={{ fontSize: 12, color: '#1e3a8a' }}>{message}</div>
          </div>
        </div>
      )}
      {loading && (
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #e5e7eb', background: '#f9fafb' }}>
          <Icon name="loader" style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ color: '#475569' }}>Loading enterprise data…</span>
        </div>
      )}
      {error && (
        <div style={{ ...card, border: '1px solid #fecdd3', background: '#fff1f2', color: '#b91c1c' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {aggregateStats.map((stat) => (
          <div key={stat.label} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: stat.highlight, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <Icon name={stat.icon} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>{stat.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <h2 style={subTitle}>Cohort administration</h2>
              <p style={muted}>Segment, monitor, and intervene across high-volume cohorts.</p>
            </div>
            <select
              value={selectedCohort}
              onChange={(e) => setSelectedCohort(e.target.value)}
              style={{ padding: 8, borderRadius: 8, border: '1px solid #e5e7eb', background: '#f8fafc' }}
            >
              <option value="all">All cohorts</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 8, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 12, color: '#475569', fontWeight: 700 }}>
            <div>Cohort</div>
            <div>Active</div>
            <div>Placement</div>
            <div>Response</div>
            <div>Avg. days</div>
            <div>Manager</div>
          </div>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {filteredCohorts.map((cohort) => (
              <div key={cohort.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 8, alignItems: 'center', padding: '12px 12px', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{cohort.name}</div>
                  <div style={{ ...muted, marginTop: 4 }}>Focus: {cohort.focus}</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>{cohort.active}/{cohort.size}</div>
                  <div style={muted}>At risk: {cohort.risk}</div>
                </div>
                <MetricPill value={`${cohort.placement}%`} tone={cohort.placement >= 60 ? 'success' : 'warn'} label="Placement" />
                <MetricPill value={`${cohort.response}%`} tone={cohort.response >= 45 ? 'success' : 'warn'} label="Response" />
                <div>
                  <div style={{ fontWeight: 700 }}>{cohort.avgDays}d</div>
                  <div style={muted}>to offer</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontWeight: 700 }}>{cohort.manager}</span>
                  <button
                    type="button"
                    onClick={() => handleBulkAction(`Playbook generated for ${cohort.name}`)}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f8fafc', fontSize: 12, cursor: 'pointer' }}
                  >
                    View actions
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div style={card}>
            <h2 style={subTitle}>Bulk onboarding</h2>
            <p style={muted}>Upload rosters, trigger SSO/SCIM, and manage account expirations.</p>
            <div style={{ display: 'grid', gap: 10 }}>
              <QuickAction
                icon="upload"
                title="CSV / SIS import"
                detail="Validate headers, auto-dedupe, and assign to cohorts."
                onClick={handleImportClick}
              />
              <QuickAction
                icon="users"
                title="SSO and SCIM sync"
                detail="Provision accounts nightly; auto-expire graduates."
                onClick={() => handleBulkAction('SCIM roster sync scheduled')}
              />
              <QuickAction
                icon="clock"
                title="Account lifecycle policies"
                detail="90-day inactivity locks, FERPA-safe archive rules."
                onClick={() => handleBulkAction('Account lifecycle policy enforced')}
              />
            </div>
          </div>

          <div style={card}>
            <h2 style={subTitle}>Program ROI + outcomes</h2>
            <p style={muted}>Quantify impact for institutions and sponsors.</p>
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              {effectiveness.map((item) => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.label}</div>
                    <div style={muted}>{item.change}</div>
                  </div>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...card, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={subTitle}>Aggregate reporting and program effectiveness</h2>
            <p style={muted}>Rollup metrics by cohort, institution, and funding partner.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid #e5e7eb', background: '#f8fafc' }}>
              <option value="quarter">Quarter to date</option>
              <option value="month">Month to date</option>
              <option value="semester">Semester</option>
              <option value="year">Year</option>
            </select>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleCsvUpload} />
            <button
              type="button"
              onClick={() => handleReportGenerate('csv')}
              style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
            >
              Export CSV
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {roiRows.map((row) => (
            <div key={row.program} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, background: '#f9fafb' }}>
              <div style={{ fontWeight: 800 }}>{row.program}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 13 }}>
                <span style={muted}>Program spend</span>
                <span style={{ fontWeight: 700 }}>{row.spend}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 13 }}>
                <span style={muted}>Placements</span>
                <span style={{ fontWeight: 700 }}>{row.placements}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 13 }}>
                <span style={muted}>Salary lift</span>
                <span style={{ fontWeight: 700 }}>{row.salaryLift}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 13 }}>
                <span style={muted}>ROI</span>
                <span style={{ fontWeight: 800, color: '#16a34a' }}>{row.roi}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 13 }}>
                <span style={muted}>Payback</span>
                <span style={{ fontWeight: 700 }}>{row.payback}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr', gap: 16 }}>
        <div style={card}>
          <h2 style={subTitle}>Institutional branding and white-label controls</h2>
          <p style={muted}>Customize partner experience for portals, reports, and outreach.</p>
          <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
            <label style={{ fontSize: 12, color: '#0f172a', fontWeight: 700 }}>
              Partner name
              <input
                type="text"
                value={branding.orgName}
                onChange={(e) => setBranding({ ...branding, orgName: e.target.value })}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', marginTop: 6 }}
              />
            </label>
            <label style={{ fontSize: 12, color: '#0f172a', fontWeight: 700 }}>
              Accent color
              <input
                type="color"
                value={branding.accent}
                onChange={(e) => setBranding({ ...branding, accent: e.target.value })}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', marginTop: 6, height: 44 }}
              />
            </label>
            <label style={{ fontSize: 12, color: '#0f172a', fontWeight: 700 }}>
              Custom domain
              <input
                type="text"
                value={branding.domain}
                onChange={(e) => setBranding({ ...branding, domain: e.target.value })}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', marginTop: 6 }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
              <input type="checkbox" checked={branding.whiteLabel} onChange={() => setBranding({ ...branding, whiteLabel: !branding.whiteLabel })} />
              Enable white-label (hide CareerOS branding)
            </label>
          </div>
          <div style={{ marginTop: 10, padding: 10, borderRadius: 8, border: '1px dashed #e5e7eb', background: '#f8fafc' }}>
            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Preview</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, background: branding.accent }} />
              <span style={{ fontSize: 12, color: '#334155' }}>{branding.domain}</span>
              <span style={{ fontSize: 12, color: branding.whiteLabel ? '#15803d' : '#ef4444', fontWeight: 700 }}>
                {branding.whiteLabel ? 'Brand stripped' : 'CareerOS visible'}
              </span>
            </div>
          </div>
        </div>

        <div style={card}>
          <h2 style={subTitle}>Compliance and data security</h2>
          <p style={muted}>Enforce institutional requirements and export audit evidence.</p>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            <ComplianceToggle label="SOC 2 controls" checked={compliance.soc2} onToggle={() => toggleCompliance('soc2')} />
            <ComplianceToggle label="FERPA / student privacy" checked={compliance.ferpa} onToggle={() => toggleCompliance('ferpa')} />
            <ComplianceToggle label="GDPR data handling" checked={compliance.gdpr} onToggle={() => toggleCompliance('gdpr')} />
            <ComplianceToggle label="Data retention & purge policy" checked={compliance.dataRetention} onToggle={() => toggleCompliance('dataRetention')} />
          </div>
          <button
            type="button"
            onClick={() => {
              const payload = { compliance, branding, integrations, exportedAt: new Date().toISOString() };
              downloadFile(JSON.stringify(payload, null, 2), 'compliance-audit.json', 'application/json');
              handleBulkAction('Compliance evidence pack generated');
            }}
            style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid #111827', background: '#111827', color: '#fff', fontWeight: 700, cursor: 'pointer', width: '100%' }}
          >
            Download audit packet
          </button>
        </div>

        <div style={card}>
          <h2 style={subTitle}>Integrations</h2>
          <p style={muted}>Connect ATS, SIS, LMS, and HRIS to keep records in sync.</p>
          <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
            {integrations.map((integration) => (
              <div key={integration.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, background: '#f9fafb', display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{integration.name}</div>
                    <div style={{ ...muted, marginTop: 2 }}>{integration.type}</div>
                    <div style={{ ...muted, marginTop: 2 }}>Source: jobs via /enterprise/integrations/{integration.id}/sync + /jobs?source={integration.id}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      disabled={integrationLoading === integration.id}
                      onClick={() => toggleIntegration(integration)}
                      style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #2563eb', background: '#fff', color: '#1d4ed8', fontWeight: 700, cursor: 'pointer', opacity: integrationLoading === integration.id ? 0.6 : 1 }}
                    >
                      {integration.status === 'Connected' ? 'Disable' : 'Connect'}
                    </button>
                    <button
                      type="button"
                      disabled={integrationLoading === integration.id}
                      onClick={() => handleSyncIntegration(integration)}
                      style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#111827', fontWeight: 700, cursor: 'pointer', opacity: integrationLoading === integration.id ? 0.6 : 1 }}
                    >
                      Sync now
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, alignItems: 'center' }}>
                  <StatusPill status={integration.status} />
                  <span style={{ color: '#475569' }}>Last sync: {integration.lastSync || '—'} | Jobs imported: {integration.jobsImported ?? 0}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        <InsightCard
          icon="bar-chart"
          title="Program optimization"
          items={[
            'Shift 20% of coaching hours to Tech Fellows to accelerate offers.',
            'Automate recruiter follow-ups for cohorts with sub-45% response rate.',
            'Increase outreach benchmarks to 12 apps/week for Career Sprint.',
          ]}
        />
        <InsightCard
          icon="book"
          title="Best practices playbooks"
          items={[
            'Embed alumni panels in week 3 for momentum.',
            'Trigger offer negotiation training once interviews exceed 2 per candidate.',
            'Share anonymized wins with partners weekly to reinforce ROI narrative.',
          ]}
        />
        <InsightCard
          icon="shield"
          title="Risk controls"
          items={[
            'Enable forced MFA for admin roles.',
            'Archive inactive accounts after 90 days to stay FERPA aligned.',
            'Export quarterly audit logs to partner security teams.',
          ]}
        />
      </div>
    </div>
  );
}

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load from storage', key, e);
    return fallback;
  }
}

function persist(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Failed to persist', key, e);
  }
}

function parseCohortCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const [headerLine, ...rows] = lines;
  const headers = headerLine.split(',').map((h) => h.trim().toLowerCase());
  const required = ['name', 'size', 'active', 'placement', 'response', 'avgdays', 'manager', 'focus', 'risk'];
  const missing = required.filter((h) => !headers.includes(h));
  if (missing.length) throw new Error(`Missing headers: ${missing.join(', ')}`);

  return rows.map((line, idx) => {
    const cells = line.split(',');
    const cellMap = headers.reduce((acc, h, i) => ({ ...acc, [h]: cells[i] || '' }), {});
    return {
      id: `csv-${idx}-${cellMap.name}`,
      name: cellMap.name,
      size: Number(cellMap.size) || 0,
      active: Number(cellMap.active) || 0,
      placement: Number(cellMap.placement) || 0,
      response: Number(cellMap.response) || 0,
      avgDays: Number(cellMap.avgdays) || 0,
      manager: cellMap.manager || 'Unknown',
      focus: cellMap.focus || 'General',
      risk: cellMap.risk || 'Unknown',
    };
  });
}

function buildCohortCsv(data) {
  const headers = ['name', 'size', 'active', 'placement', 'response', 'avgDays', 'manager', 'focus', 'risk'];
  const rows = data.map((c) =>
    [c.name, c.size, c.active, c.placement, c.response, c.avgDays, c.manager, c.focus, c.risk].join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function MetricPill({ value, tone = 'neutral', label }) {
  const tones = {
    success: { bg: '#ecfdf3', text: '#166534' },
    warn: { bg: '#fff7ed', text: '#c2410c' },
    neutral: { bg: '#f1f5f9', text: '#0f172a' },
  };
  const palette = tones[tone] || tones.neutral;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontWeight: 700 }}>{value}</div>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 999, background: palette.bg, color: palette.text, fontSize: 12, width: 'fit-content' }}>
        <Icon name="activity" color={palette.text} />
        {label}
      </span>
    </div>
  );
}

function QuickAction({ icon, title, detail, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: 'left',
        borderRadius: 10,
        border: '1px solid #e5e7eb',
        padding: 10,
        background: '#f8fafc',
        cursor: 'pointer',
        display: 'grid',
        gap: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: '#e0f2fe', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} />
        </span>
        <span style={{ fontWeight: 800, color: '#0f172a' }}>{title}</span>
      </div>
      <span style={{ fontSize: 12, color: '#475569' }}>{detail}</span>
    </button>
  );
}

function StatusPill({ status }) {
  const palette = {
    Connected: { bg: '#ecfdf3', text: '#15803d', icon: 'check' },
    'Action required': { bg: '#fef3c7', text: '#c2410c', icon: 'alert-circle' },
    Pending: { bg: '#e0f2fe', text: '#075985', icon: 'clock' },
    Disabled: { bg: '#f1f5f9', text: '#475569', icon: 'x' },
  }[status] || { bg: '#f1f5f9', text: '#0f172a', icon: 'info' };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: palette.bg, color: palette.text, fontSize: 12 }}>
      <Icon name={palette.icon} />
      {status}
    </span>
  );
}

function ComplianceToggle({ label, checked, onToggle }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb', fontSize: 13, fontWeight: 700 }}>
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={onToggle} />
    </label>
  );
}

function InsightCard({ icon, title, items }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, background: '#f9fafb', display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800 }}>
        <span style={{ width: 32, height: 32, borderRadius: 10, background: '#e0f2fe', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} />
        </span>
        {title}
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
        {items.map((item, index) => (
          <li key={index} style={{ fontSize: 13, color: '#0f172a' }}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
