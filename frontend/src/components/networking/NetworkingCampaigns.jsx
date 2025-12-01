import React, { useEffect, useMemo, useState } from 'react';
import Icon from '../common/Icon';
import ConfirmDialog from '../common/ConfirmDialog';
import './NetworkingCampaigns.css';

const LOCAL_STORAGE_KEY = 'resumerocket.networkingCampaigns.v2';

const sentimentScore = {
  cold: 20,
  neutral: 55,
  warm: 75,
  excited: 90,
};

const loadCampaignsFromStorage = () => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (error) {
    console.warn('Failed to parse stored campaigns', error);
  }
  return [];
};

const numberOrZero = (value) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatDate = (value) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const NetworkingCampaigns = () => {
  const [campaigns, setCampaigns] = useState(loadCampaignsFromStorage);
  const [selectedCampaignId, setSelectedCampaignId] = useState(() => loadCampaignsFromStorage()[0]?.id || null);
  const [filters, setFilters] = useState({ status: 'all', targetType: 'all' });
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    targetType: 'company',
    targetFocus: '',
    outreachTarget: 25,
    meetingsGoal: 5,
    warmIntroGoal: 3,
    relationshipFocus: '',
    startDate: '',
    endDate: '',
  });
  const [outreachForm, setOutreachForm] = useState({
    date: '',
    channel: 'Email',
    outreachCount: '',
    responses: '',
    meetings: '',
    sentiment: 'neutral',
    notes: '',
  });
  const [strategyForm, setStrategyForm] = useState({
    summary: '',
    dueDate: '',
  });
  const [abTestForm, setAbTestForm] = useState({
    name: '',
    hypothesis: '',
    variantA: 'Messaging A',
    variantB: 'Messaging B',
    sendA: '',
    sendB: '',
    responsesA: '',
    responsesB: '',
  });
  const [jobLinkForm, setJobLinkForm] = useState({
    title: '',
    company: '',
    stage: 'prospect',
  });
  const [activePage, setActivePage] = useState('overview');
  const [pendingDeleteCampaign, setPendingDeleteCampaign] = useState(null);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(campaigns));
  }, [campaigns]);

  useEffect(() => {
    if (!selectedCampaignId && campaigns.length) {
      setSelectedCampaignId(campaigns[0].id);
    }
  }, [campaigns, selectedCampaignId]);

  useEffect(() => {
    if (selectedCampaignId && !campaigns.find((campaign) => campaign.id === selectedCampaignId)) {
      setSelectedCampaignId(campaigns[0]?.id || null);
    }
  }, [campaigns, selectedCampaignId]);

  useEffect(() => {
    if (selectedCampaignId) {
      setActivePage('overview');
    }
  }, [selectedCampaignId]);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) || null,
    [campaigns, selectedCampaignId]
  );

  const summary = useMemo(() => {
    if (!campaigns.length) {
      return {
        activeCount: 0,
        avgResponse: 0,
        goalCoverage: 0,
        warmRelationships: 0,
        totalOutreach: 0,
        totalResponses: 0,
        bestCampaign: null,
      };
    }

    const totalOutreach = campaigns.reduce((sum, campaign) => sum + numberOrZero(campaign.metrics?.outreachVolume), 0);
    const totalResponses = campaigns.reduce((sum, campaign) => sum + numberOrZero(campaign.metrics?.responses), 0);
    const totalMeetings = campaigns.reduce((sum, campaign) => sum + numberOrZero(campaign.metrics?.meetings), 0);
    const totalMeetingsGoal = campaigns.reduce((sum, campaign) => sum + numberOrZero(campaign.goals?.targetMeetings), 0);

    const bestCampaign = campaigns.reduce(
      (acc, campaign) => {
        const outreach = numberOrZero(campaign.metrics?.outreachVolume);
        const responses = numberOrZero(campaign.metrics?.responses);
        const responseRate = outreach ? Math.round((responses / outreach) * 100) : 0;
        if (responseRate > acc.rate) {
          return { name: campaign.name, rate: responseRate };
        }
        return acc;
      },
      { name: '', rate: 0 }
    );

    return {
      activeCount: campaigns.filter((campaign) => campaign.status === 'active').length,
      avgResponse: totalOutreach ? Math.round((totalResponses / totalOutreach) * 100) : 0,
      goalCoverage: totalMeetingsGoal ? Math.min(100, Math.round((totalMeetings / totalMeetingsGoal) * 100)) : 0,
      warmRelationships: campaigns.filter((campaign) => numberOrZero(campaign.metrics?.relationshipQuality) >= 70).length,
      totalOutreach,
      totalResponses,
      bestCampaign: bestCampaign.rate ? bestCampaign : null,
    };
  }, [campaigns]);

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((campaign) => {
      const matchStatus = filters.status === 'all' || campaign.status === filters.status;
      const matchType = filters.targetType === 'all' || campaign.targetType === filters.targetType;
      return matchStatus && matchType;
    });
  }, [campaigns, filters]);

  const updateCampaign = (campaignId, updater) => {
    setCampaigns((prev) =>
      prev.map((item) => {
        if (item.id !== campaignId) return item;
        return updater(item);
      })
    );
  };

  const handleCampaignSubmit = (event) => {
    event.preventDefault();
    const payload = {
      id: `cmp-${Date.now()}`,
      name: newCampaign.name.trim(),
      targetType: newCampaign.targetType,
      targetFocus: newCampaign.targetFocus.trim(),
      status: 'active',
      timeline: { start: newCampaign.startDate, end: newCampaign.endDate },
      goals: {
        outreachTarget: numberOrZero(newCampaign.outreachTarget),
        targetMeetings: numberOrZero(newCampaign.meetingsGoal),
        warmIntroductions: numberOrZero(newCampaign.warmIntroGoal),
        relationshipFocus: newCampaign.relationshipFocus.trim(),
      },
      metrics: {
        outreachVolume: 0,
        responses: 0,
        meetings: 0,
        warmIntroductions: 0,
        relationshipQuality: 60,
        influenceScore: 0,
      },
      relationships: [],
      outreachLog: [],
      strategyAdjustments: [],
      abTests: [],
      linkedRoles: [],
    };

    setCampaigns((prev) => [payload, ...prev]);
    setSelectedCampaignId(payload.id);
    setNewCampaign({
      name: '',
      targetType: 'company',
      targetFocus: '',
      outreachTarget: 25,
      meetingsGoal: 5,
      warmIntroGoal: 3,
      relationshipFocus: '',
      startDate: '',
      endDate: '',
    });
  };

  const requestDeleteCampaign = (campaign) => {
    setPendingDeleteCampaign(campaign);
  };

  const confirmDeleteCampaign = () => {
    if (!pendingDeleteCampaign) return;
    setCampaigns((prev) => prev.filter((campaign) => campaign.id !== pendingDeleteCampaign.id));
    setPendingDeleteCampaign(null);
  };

  const handleOutreachSubmit = (event) => {
    event.preventDefault();
    if (!selectedCampaign) return;

    const entry = {
      id: `log-${Date.now()}`,
      date: outreachForm.date || new Date().toISOString().slice(0, 10),
      channel: outreachForm.channel,
      outreach: numberOrZero(outreachForm.outreachCount),
      responses: numberOrZero(outreachForm.responses),
      meetings: numberOrZero(outreachForm.meetings),
      sentiment: outreachForm.sentiment,
      notes: outreachForm.notes.trim(),
    };

    updateCampaign(selectedCampaign.id, (campaign) => {
      const updatedOutreach = campaign.metrics.outreachVolume + entry.outreach;
      const updatedResponses = campaign.metrics.responses + entry.responses;
      const updatedMeetings = campaign.metrics.meetings + entry.meetings;
      const updatedQuality = entry.outreach
        ? Math.min(
            100,
            Math.round(
              (campaign.metrics.relationshipQuality * 0.7) +
                ((sentimentScore[entry.sentiment] || 60) * 0.3)
            )
          )
        : campaign.metrics.relationshipQuality;

      return {
        ...campaign,
        outreachLog: [entry, ...campaign.outreachLog],
        metrics: {
          ...campaign.metrics,
          outreachVolume: updatedOutreach,
          responses: updatedResponses,
          meetings: updatedMeetings,
          warmIntroductions: campaign.metrics.warmIntroductions + (entry.sentiment === 'warm' || entry.sentiment === 'excited' ? entry.responses : 0),
          relationshipQuality: updatedQuality,
        },
      };
    });

    setOutreachForm({
      date: '',
      channel: 'Email',
      outreachCount: '',
      responses: '',
      meetings: '',
      sentiment: 'neutral',
      notes: '',
    });
  };

  const handleDeleteOutreach = (logId) => {
    if (!selectedCampaign) return;
    updateCampaign(selectedCampaign.id, (campaign) => {
      const target = campaign.outreachLog.find((entry) => entry.id === logId);
      if (!target) return campaign;
      const warmDelta = (target.sentiment === 'warm' || target.sentiment === 'excited') ? target.responses : 0;
      return {
        ...campaign,
        outreachLog: campaign.outreachLog.filter((entry) => entry.id !== logId),
        metrics: {
          ...campaign.metrics,
          outreachVolume: Math.max(0, campaign.metrics.outreachVolume - target.outreach),
          responses: Math.max(0, campaign.metrics.responses - target.responses),
          meetings: Math.max(0, campaign.metrics.meetings - target.meetings),
          warmIntroductions: Math.max(0, campaign.metrics.warmIntroductions - warmDelta),
        },
      };
    });
  };

  const handleStrategySubmit = (event) => {
    event.preventDefault();
    if (!selectedCampaign || !strategyForm.summary.trim()) return;

    const entry = {
      id: `adj-${Date.now()}`,
      summary: strategyForm.summary.trim(),
      status: 'Active',
      owner: 'You',
      dueDate: strategyForm.dueDate || '',
    };

    updateCampaign(selectedCampaign.id, (campaign) => ({
      ...campaign,
      strategyAdjustments: [entry, ...campaign.strategyAdjustments],
    }));

    setStrategyForm({ summary: '', dueDate: '' });
  };

  const handleDeleteAdjustment = (adjustmentId) => {
    if (!selectedCampaign) return;
    updateCampaign(selectedCampaign.id, (campaign) => ({
      ...campaign,
      strategyAdjustments: campaign.strategyAdjustments.filter((item) => item.id !== adjustmentId),
    }));
  };

  const toggleStrategyStatus = (adjustmentId) => {
    if (!selectedCampaign) return;
    updateCampaign(selectedCampaign.id, (campaign) => ({
      ...campaign,
      strategyAdjustments: campaign.strategyAdjustments.map((item) =>
        item.id === adjustmentId ? { ...item, status: item.status === 'Complete' ? 'Active' : 'Complete' } : item
      ),
    }));
  };

  const handleAbTestSubmit = (event) => {
    event.preventDefault();
    if (!selectedCampaign) return;
    const entry = {
      id: `ab-${Date.now()}`,
      name: abTestForm.name.trim() || 'Untitled experiment',
      hypothesis: abTestForm.hypothesis.trim(),
      status: 'running',
      variants: [
        { id: 'A', label: abTestForm.variantA || 'Variant A', outreach: abTestForm.sendA || '', responses: abTestForm.responsesA || '' },
        { id: 'B', label: abTestForm.variantB || 'Variant B', outreach: abTestForm.sendB || '', responses: abTestForm.responsesB || '' },
      ],
    };

    updateCampaign(selectedCampaign.id, (campaign) => ({
      ...campaign,
      abTests: [entry, ...campaign.abTests],
    }));

    setAbTestForm({
      name: '',
      hypothesis: '',
      variantA: 'Messaging A',
      variantB: 'Messaging B',
      sendA: '',
      sendB: '',
      responsesA: '',
      responsesB: '',
    });
  };

  const handleDeleteAbTest = (abTestId) => {
    if (!selectedCampaign) return;
    updateCampaign(selectedCampaign.id, (campaign) => ({
      ...campaign,
      abTests: campaign.abTests.filter((test) => test.id !== abTestId),
    }));
  };

  const handleUpdateVariant = (abTestId, variantId, field, value) => {
    if (!selectedCampaign) return;
    updateCampaign(selectedCampaign.id, (campaign) => ({
      ...campaign,
      abTests: campaign.abTests.map((test) => {
        if (test.id !== abTestId) return test;
        return {
          ...test,
          variants: test.variants.map((variant) => {
            if (variant.id !== variantId) return variant;
            return {
              ...variant,
              [field]: value,
            };
          }),
        };
      }),
    }));
  };

  const handleVariantBlur = (abTestId, variantId, field, value) => {
    if (value === '' || value === null || value === undefined) {
      handleUpdateVariant(abTestId, variantId, field, '0');
    }
  };

  const handleJobLinkSubmit = (event) => {
    event.preventDefault();
    if (!selectedCampaign || !jobLinkForm.title.trim()) return;
    const entry = {
      id: `role-${Date.now()}`,
      title: jobLinkForm.title.trim(),
      company: jobLinkForm.company.trim(),
      stage: jobLinkForm.stage,
    };

    updateCampaign(selectedCampaign.id, (campaign) => ({
      ...campaign,
      linkedRoles: [entry, ...campaign.linkedRoles],
    }));

    setJobLinkForm({
      title: '',
      company: '',
      stage: 'prospect',
    });
  };

  const handleDeleteRole = (roleId) => {
    if (!selectedCampaign) return;
    updateCampaign(selectedCampaign.id, (campaign) => ({
      ...campaign,
      linkedRoles: campaign.linkedRoles.filter((role) => role.id !== roleId),
    }));
  };

  const handleRelationshipQualityChange = (value) => {
    if (!selectedCampaign) return;
    updateCampaign(selectedCampaign.id, (campaign) => ({
      ...campaign,
      metrics: { ...campaign.metrics, relationshipQuality: value },
    }));
  };

  const computeResponseRate = (campaign) => {
    const outreach = numberOrZero(campaign.metrics?.outreachVolume);
    const responses = numberOrZero(campaign.metrics?.responses);
    if (!outreach) return 0;
    return Math.round((responses / outreach) * 100);
  };

  const computeTimelineProgress = (campaign) => {
    const start = campaign?.timeline?.start ? new Date(campaign.timeline.start) : null;
    const end = campaign?.timeline?.end ? new Date(campaign.timeline.end) : null;
    if (!start || !end || Number.isNaN(start) || Number.isNaN(end) || end <= start) {
      return 0;
    }
    const total = end - start;
    const elapsed = Math.min(Math.max(Date.now() - start, 0), total);
    return Math.round((elapsed / total) * 100);
  };

  const campaignInsights = (campaign) => {
    if (!campaign) return [];
    const responseRate = computeResponseRate(campaign);
    const meetingsGoal = numberOrZero(campaign.goals?.targetMeetings);
    const meetingsProgress = meetingsGoal
      ? Math.round(Math.min(100, (campaign.metrics.meetings / meetingsGoal) * 100))
      : 0;
    const warmTarget = numberOrZero(campaign.goals?.warmIntroductions);
    const warmProgress = warmTarget
      ? Math.round(Math.min(100, (campaign.metrics.warmIntroductions / warmTarget) * 100))
      : 0;

    return [
      `Response rate is ${responseRate}% with ${campaign.metrics.responses} positive replies.`,
      meetingsGoal ? `${meetingsProgress}% of the meeting goal achieved (${campaign.metrics.meetings}/${meetingsGoal}).` : 'Set a meeting goal to track progress.',
      warmTarget ? `${warmProgress}% of warm introductions hit.` : 'Define a warm introduction goal to unlock this insight.',
      campaign.metrics.relationshipQuality >= 75
        ? 'Relationships are trending warm—queue deeper conversations.'
        : 'Relationship score is cooling; schedule value-add follow ups.',
    ];
  };

  const detailPages = [
    { id: 'overview', label: 'Overview' },
    { id: 'outreach', label: 'Outreach' },
    { id: 'experiments', label: 'Experiments' },
    { id: 'outcomes', label: 'Outcomes' },
  ];

  const renderOverviewPage = () => {
    if (!selectedCampaign) return null;
    return (
      <>
        <div className="campaign-card focus-card">
          <div className="card-header space-between">
            <div>
              <p className="eyebrow">{selectedCampaign.targetType === 'company' ? 'Company play' : 'Industry play'}</p>
              <h2>{selectedCampaign.name}</h2>
              <p className="helper-text">{selectedCampaign.targetFocus || 'Describe the accounts you are targeting.'}</p>
            </div>
            <div className="response-pill">
              <Icon name="activity" /> {computeResponseRate(selectedCampaign)}% response
            </div>
          </div>
          <div className="campaign-meta-grid">
            <div className="meta-item meta-item--timeline">
              <span className="label">Timeline</span>
              <strong className="timeline-range">
                <span>{formatDate(selectedCampaign.timeline.start)}</span>
                <span className="timeline-arrow">→</span>
                <span>{formatDate(selectedCampaign.timeline.end)}</span>
              </strong>
              <div className="progress-bar">
                <div style={{ width: `${computeTimelineProgress(selectedCampaign)}%` }} />
              </div>
            </div>
            <div className="meta-item">
              <span className="label">Relationship focus</span>
              <strong>{selectedCampaign.goals.relationshipFocus || "Define the relationship outcome you're after."}</strong>
            </div>
            <div className="meta-item meta-item--slider">
              <span className="label">Relationship quality</span>
              <strong>{selectedCampaign.metrics.relationshipQuality}</strong>
              <input
                type="range"
                min="0"
                max="100"
                value={selectedCampaign.metrics.relationshipQuality}
                onChange={(event) => handleRelationshipQualityChange(Number(event.target.value))}
              />
            </div>
          </div>
          <div className="campaign-stat-grid">
            <div className="stat-item">
              <span>Outreach</span>
              <strong>{selectedCampaign.metrics.outreachVolume}</strong>
              <small>Target {selectedCampaign.goals.outreachTarget || 0}</small>
              <div className="progress-bar small">
                <div style={{ width: `${selectedCampaign.goals.outreachTarget ? Math.min(100, Math.round((selectedCampaign.metrics.outreachVolume / selectedCampaign.goals.outreachTarget) * 100)) : 0}%` }} />
              </div>
            </div>
            <div className="stat-item">
              <span>Meetings</span>
              <strong>{selectedCampaign.metrics.meetings}</strong>
              <small>Goal {selectedCampaign.goals.targetMeetings || 0}</small>
              <div className="progress-bar small">
                <div style={{ width: `${selectedCampaign.goals.targetMeetings ? Math.min(100, Math.round((selectedCampaign.metrics.meetings / selectedCampaign.goals.targetMeetings) * 100)) : 0}%` }} />
              </div>
            </div>
            <div className="stat-item">
              <span>Warm introductions</span>
              <strong>{selectedCampaign.metrics.warmIntroductions}</strong>
              <small>Goal {selectedCampaign.goals.warmIntroductions || 0}</small>
              <div className="progress-bar small">
                <div style={{ width: `${selectedCampaign.goals.warmIntroductions ? Math.min(100, Math.round((selectedCampaign.metrics.warmIntroductions / selectedCampaign.goals.warmIntroductions) * 100)) : 0}%` }} />
              </div>
            </div>
          </div>
        </div>
        <div className="campaign-card">
          <div className="card-header">
            <h3><Icon name="users" /> Relationship insights</h3>
          </div>
          <ul className="insights-list">
            {campaignInsights(selectedCampaign).map((insight, index) => (
              <li key={index}>
                <strong>Insight {index + 1}</strong>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
          <div className="relationships">
            {selectedCampaign.relationships?.map((relationship) => (
              <div key={relationship.id} className="relationship-item">
                <div>
                  <strong>{relationship.name}</strong>
                  <span className="helper-text">Quality score {relationship.quality}</span>
                </div>
                <div className="progress-bar small">
                  <div style={{ width: `${Math.min(100, relationship.quality)}%` }} />
                </div>
              </div>
            ))}
            {!selectedCampaign.relationships?.length && <div className="empty-state">Add highlights to track the strongest advocates.</div>}
          </div>
        </div>
      </>
    );
  };

  const renderOutreachPage = () => {
    if (!selectedCampaign) return null;
    return (
      <div className="campaign-card">
        <div className="card-header space-between">
          <h3><Icon name="mail" /> Outreach log</h3>
        </div>
        <form className="form-row" onSubmit={handleOutreachSubmit}>
          <input type="date" value={outreachForm.date} onChange={(event) => setOutreachForm((prev) => ({ ...prev, date: event.target.value }))} />
          <select value={outreachForm.channel} onChange={(event) => setOutreachForm((prev) => ({ ...prev, channel: event.target.value }))}>
            <option>Email</option>
            <option>LinkedIn DM</option>
            <option>Warm Intro</option>
            <option>Event Follow-up</option>
            <option>Call</option>
          </select>
          <input
            type="number"
            placeholder="Outreach"
            value={outreachForm.outreachCount}
            onChange={(event) => setOutreachForm((prev) => ({ ...prev, outreachCount: event.target.value }))}
            min="0"
          />
          <input
            type="number"
            placeholder="Responses"
            value={outreachForm.responses}
            onChange={(event) => setOutreachForm((prev) => ({ ...prev, responses: event.target.value }))}
            min="0"
          />
          <input
            type="number"
            placeholder="Meetings"
            value={outreachForm.meetings}
            onChange={(event) => setOutreachForm((prev) => ({ ...prev, meetings: event.target.value }))}
            min="0"
          />
          <select value={outreachForm.sentiment} onChange={(event) => setOutreachForm((prev) => ({ ...prev, sentiment: event.target.value }))}>
            <option value="cold">Cold</option>
            <option value="neutral">Neutral</option>
            <option value="warm">Warm</option>
            <option value="excited">Excited</option>
          </select>
          <input
            type="text"
            placeholder="Notes"
            value={outreachForm.notes}
            onChange={(event) => setOutreachForm((prev) => ({ ...prev, notes: event.target.value }))}
          />
          <button type="submit" className="primary-button secondary">
            <Icon name="plus" /> Log
          </button>
        </form>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Channel</th>
                <th>Outreach</th>
                <th>Responses</th>
                <th>Meetings</th>
                <th>Sentiment</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {selectedCampaign.outreachLog.map((log) => (
                <tr key={log.id}>
                  <td>{formatDate(log.date)}</td>
                  <td>{log.channel}</td>
                  <td>{log.outreach}</td>
                  <td>{log.responses}</td>
                  <td>{log.meetings}</td>
                  <td><span className={`sentiment sentiment-${log.sentiment}`}>{log.sentiment}</span></td>
                  <td>{log.notes}</td>
                  <td className="actions-cell">
                    <button type="button" className="icon-button danger" aria-label="Delete outreach" onClick={() => handleDeleteOutreach(log.id)}>
                      <Icon name="trash" size="sm" />
                    </button>
                  </td>
                </tr>
              ))}
              {!selectedCampaign.outreachLog.length && (
                <tr>
                  <td colSpan="8" className="empty-state-cell">No outreach logged yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderExperimentsPage = () => {
    if (!selectedCampaign) return null;
    return (
      <div className="campaign-card two-column">
        <div>
          <div className="card-header">
            <h3><Icon name="activity" /> Strategy adjustments</h3>
          </div>
          <form className="form-row" onSubmit={handleStrategySubmit}>
            <input
              type="text"
              placeholder="Example: Focus on alumni referrals"
              value={strategyForm.summary}
              onChange={(event) => setStrategyForm((prev) => ({ ...prev, summary: event.target.value }))}
              required
            />
            <input
              type="date"
              value={strategyForm.dueDate}
              onChange={(event) => setStrategyForm((prev) => ({ ...prev, dueDate: event.target.value }))}
            />
            <button type="submit" className="primary-button secondary">
              <Icon name="plus" /> Add
            </button>
          </form>
          <ul className="adjustments-list">
            {selectedCampaign.strategyAdjustments.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.summary}</strong>
                  <span className="helper-text">Due {item.dueDate ? formatDate(item.dueDate) : 'TBD'}</span>
                </div>
                <div className="list-actions">
                  <button className={`status-pill status-${item.status === 'Complete' ? 'complete' : 'active'}`} type="button" onClick={() => toggleStrategyStatus(item.id)}>
                    {item.status}
                  </button>
                  <button type="button" className="icon-button danger" aria-label="Delete adjustment" onClick={() => handleDeleteAdjustment(item.id)}>
                    <Icon name="trash" size="sm" />
                  </button>
                </div>
              </li>
            ))}
            {!selectedCampaign.strategyAdjustments.length && <li className="empty-state">No adjustments logged yet.</li>}
          </ul>
        </div>
        <div>
          <div className="card-header">
            <h3><Icon name="compare" /> A/B tests</h3>
          </div>
          <form className="ab-form" onSubmit={handleAbTestSubmit}>
            <input
              type="text"
              className="rounded-input"
              placeholder="Experiment name"
              value={abTestForm.name}
              onChange={(event) => setAbTestForm((prev) => ({ ...prev, name: event.target.value }))}
            />
            <textarea
              rows="2"
              placeholder="Hypothesis"
              value={abTestForm.hypothesis}
              onChange={(event) => setAbTestForm((prev) => ({ ...prev, hypothesis: event.target.value }))}
            />
            <div className="grid-2">
                      <label>
                        Variant A label
                        <input
                          type="text"
                          className="rounded-input"
                          value={abTestForm.variantA}
                          onChange={(event) => setAbTestForm((prev) => ({ ...prev, variantA: event.target.value }))}
                        />
                      </label>
                      <label>
                        Variant B label
                        <input
                          type="text"
                          className="rounded-input"
                          value={abTestForm.variantB}
                          onChange={(event) => setAbTestForm((prev) => ({ ...prev, variantB: event.target.value }))}
                        />
                      </label>
                    </div>
                    <div className="grid-2">
                      <label>
                        Variant A outreach / responses
                        <div className="grid-2 tight">
                          <input
                            type="number"
                            min="0"
                            placeholder="Outreach"
                            className="rounded-input"
                            value={abTestForm.sendA}
                            onChange={(event) => setAbTestForm((prev) => ({ ...prev, sendA: event.target.value }))}
                          />
                          <input
                            type="number"
                            min="0"
                            placeholder="Responses"
                            className="rounded-input"
                            value={abTestForm.responsesA}
                            onChange={(event) => setAbTestForm((prev) => ({ ...prev, responsesA: event.target.value }))}
                          />
                        </div>
                      </label>
                      <label>
                        Variant B outreach / responses
                        <div className="grid-2 tight">
                          <input
                            type="number"
                            min="0"
                            placeholder="Outreach"
                            className="rounded-input"
                            value={abTestForm.sendB}
                            onChange={(event) => setAbTestForm((prev) => ({ ...prev, sendB: event.target.value }))}
                          />
                          <input
                            type="number"
                            min="0"
                            placeholder="Responses"
                            className="rounded-input"
                            value={abTestForm.responsesB}
                            onChange={(event) => setAbTestForm((prev) => ({ ...prev, responsesB: event.target.value }))}
                          />
                        </div>
                      </label>
            </div>
            <button type="submit" className="primary-button secondary">
              <Icon name="plus" /> Track test
            </button>
          </form>
          <div className="ab-tests">
                    {selectedCampaign.abTests.map((test) => (
                      <div className="ab-test-card" key={test.id}>
                        <div className="ab-test-header">
                          <div>
                            <strong>{test.name}</strong>
                            <p>{test.hypothesis}</p>
                          </div>
                          <div className="list-actions">
                            <span className={`status-pill status-${test.status}`}>{test.status}</span>
                            <button type="button" className="icon-button danger" aria-label="Delete A/B test" onClick={() => handleDeleteAbTest(test.id)}>
                              <Icon name="trash" size="sm" />
                            </button>
                          </div>
                        </div>
                <div className="variants">
                  {test.variants.map((variant) => {
                    const outreachVal = variant.outreach === '' ? 0 : numberOrZero(variant.outreach);
                    const responseVal = variant.responses === '' ? 0 : numberOrZero(variant.responses);
                    const rate = outreachVal ? Math.round((responseVal / outreachVal) * 100) : 0;
                    return (
                      <div key={variant.id} className="variant-card">
                        <div className="variant-header">
                          <strong>{variant.label}</strong>
                          <span className="variant-rate">{rate}%</span>
                        </div>
                        <div className="variant-inputs">
                          <label>
                            Outreach
                            <input
                              type="number"
                              min="0"
                              value={variant.outreach}
                              onChange={(event) => handleUpdateVariant(test.id, variant.id, 'outreach', event.target.value)}
                              onBlur={(event) => handleVariantBlur(test.id, variant.id, 'outreach', event.target.value)}
                            />
                          </label>
                          <label>
                            Responses
                            <input
                              type="number"
                              min="0"
                              value={variant.responses}
                              onChange={(event) => handleUpdateVariant(test.id, variant.id, 'responses', event.target.value)}
                              onBlur={(event) => handleVariantBlur(test.id, variant.id, 'responses', event.target.value)}
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {!selectedCampaign.abTests.length && <div className="empty-state">No experiments logged yet.</div>}
          </div>
        </div>
      </div>
    );
  };

  const renderOutcomesPage = () => {
    if (!selectedCampaign) return null;
    return (
      <div className="campaign-card two-column">
        <div>
          <div className="card-header">
            <h3><Icon name="briefcase" /> Job outcomes</h3>
          </div>
          <form className="form-row" onSubmit={handleJobLinkSubmit}>
            <input
              type="text"
              placeholder="Role title"
              value={jobLinkForm.title}
              onChange={(event) => setJobLinkForm((prev) => ({ ...prev, title: event.target.value }))}
              required
            />
            <input
              type="text"
              placeholder="Company"
              value={jobLinkForm.company}
              onChange={(event) => setJobLinkForm((prev) => ({ ...prev, company: event.target.value }))}
            />
            <select value={jobLinkForm.stage} onChange={(event) => setJobLinkForm((prev) => ({ ...prev, stage: event.target.value }))}>
              <option value="prospect">Prospecting</option>
              <option value="applied">Applied</option>
              <option value="interview">Interviewing</option>
              <option value="offer">Offer</option>
            </select>
            <button type="submit" className="primary-button secondary">
              <Icon name="plus" /> Link role
            </button>
          </form>
          <div className="linked-roles">
                    {selectedCampaign.linkedRoles.map((role) => (
                      <div key={role.id} className="role-card">
                        <div>
                          <strong>{role.title}</strong>
                          <span className="helper-text">{role.company || 'Company TBD'}</span>
                        </div>
                        <div className="list-actions">
                          <span className={`status-pill status-${role.stage}`}>{role.stage}</span>
                          <button type="button" className="icon-button danger" aria-label="Delete linked role" onClick={() => handleDeleteRole(role.id)}>
                            <Icon name="trash" size="sm" />
                          </button>
                        </div>
                      </div>
                    ))}
            {!selectedCampaign.linkedRoles.length && <div className="empty-state">Link job targets to show impact.</div>}
          </div>
        </div>
        <div>
          <div className="card-header">
            <h3><Icon name="chart" /> Portfolio summary</h3>
          </div>
          <ul className="insights-list">
            <li>
              <strong>Total outreach logged</strong>
              <span>{summary.totalOutreach} touchpoints</span>
            </li>
            <li>
              <strong>Total responses</strong>
              <span>{summary.totalResponses}</span>
            </li>
            <li>
              <strong>Best responder</strong>
              <span>{summary.bestCampaign ? `${summary.bestCampaign.name} (${summary.bestCampaign.rate}%)` : 'Log more outreach to compare'}</span>
            </li>
            <li>
              <strong>Warm relationship plays</strong>
              <span>{summary.warmRelationships}</span>
            </li>
          </ul>
        </div>
      </div>
    );
  };

  const renderActivePage = () => {
    switch (activePage) {
      case 'overview':
        return renderOverviewPage();
      case 'outreach':
        return renderOutreachPage();
      case 'experiments':
        return renderExperimentsPage();
      case 'outcomes':
        return renderOutcomesPage();
      default:
        return null;
    }
  };

  return (
    <div className="networking-campaigns">
      <div className="campaigns-hero">
        <div>
          <h1>Networking Campaigns</h1>
          <p>Design targeted outreach plays, measure response quality, and link every relationship push to job outcomes.</p>
        </div>
        <div className="hero-metrics">
          <div className="hero-metric">
            <span>Active campaigns</span>
            <strong>{summary.activeCount}</strong>
            <small>Goal coverage {summary.goalCoverage}%</small>
          </div>
          <div className="hero-metric">
            <span>Avg response rate</span>
            <strong>{summary.avgResponse}%</strong>
            <small>{summary.totalResponses} replies / {summary.totalOutreach} touchpoints</small>
          </div>
          <div className="hero-metric">
            <span>Warm relationship plays</span>
            <strong>{summary.warmRelationships}</strong>
            <small>Campaigns ≥70 quality</small>
          </div>
        </div>
      </div>

      <div className="campaigns-grid">
        <section className="campaigns-column">
          <div className="campaign-card">
            <div className="card-header">
              <h3><Icon name="target" /> Launch a campaign</h3>
              <span className="helper-text">Create plans for a company or an industry cluster.</span>
            </div>
            <form className="form-grid" onSubmit={handleCampaignSubmit}>
              <label>
                Campaign name
                <input
                  type="text"
                  value={newCampaign.name}
                  onChange={(event) => setNewCampaign((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Example: Bay Area PM leaders"
                  required
                />
              </label>
              <label>
                Target focus
                <input
                  type="text"
                  value={newCampaign.targetFocus}
                  onChange={(event) => setNewCampaign((prev) => ({ ...prev, targetFocus: event.target.value }))}
                  placeholder="Stripe, Brex, Ramp..."
                />
              </label>
              <label>
                Target type
                <select
                  value={newCampaign.targetType}
                  onChange={(event) => setNewCampaign((prev) => ({ ...prev, targetType: event.target.value }))}
                >
                  <option value="company">Company-focused</option>
                  <option value="industry">Industry-focused</option>
                </select>
              </label>
              <div className="grid-2">
                <label>
                  Starts
                  <input
                    type="date"
                    value={newCampaign.startDate}
                    onChange={(event) => setNewCampaign((prev) => ({ ...prev, startDate: event.target.value }))}
                  />
                </label>
                <label>
                  Target wrap date
                  <input
                    type="date"
                    value={newCampaign.endDate}
                    onChange={(event) => setNewCampaign((prev) => ({ ...prev, endDate: event.target.value }))}
                  />
                </label>
              </div>
              <div className="grid-3">
                <label>
                  Outreach target
                  <input
                    type="number"
                    min="0"
                    value={newCampaign.outreachTarget}
                    onChange={(event) => setNewCampaign((prev) => ({ ...prev, outreachTarget: event.target.value }))}
                  />
                </label>
                <label>
                  Meeting goal
                  <input
                    type="number"
                    min="0"
                    value={newCampaign.meetingsGoal}
                    onChange={(event) => setNewCampaign((prev) => ({ ...prev, meetingsGoal: event.target.value }))}
                  />
                </label>
                <label>
                  Warm intro goal
                  <input
                    type="number"
                    min="0"
                    value={newCampaign.warmIntroGoal}
                    onChange={(event) => setNewCampaign((prev) => ({ ...prev, warmIntroGoal: event.target.value }))}
                  />
                </label>
              </div>
              <label>
                Relationship focus
                <textarea
                  rows="2"
                  value={newCampaign.relationshipFocus}
                  onChange={(event) => setNewCampaign((prev) => ({ ...prev, relationshipFocus: event.target.value }))}
                  placeholder="Ex: Earn sponsor-level mentors and referrals."
                />
              </label>
              <button type="submit" className="primary-button">
                <Icon name="plus" /> Add campaign
              </button>
            </form>
          </div>

          <div className="campaign-card">
            <div className="card-header space-between">
              <div>
                <h3><Icon name="users" /> Campaign roster</h3>
                <p className="helper-text">Filter, compare response rates, and open a plan.</p>
              </div>
              <div className="filters">
                <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="complete">Complete</option>
                </select>
                <select value={filters.targetType} onChange={(event) => setFilters((prev) => ({ ...prev, targetType: event.target.value }))}>
                  <option value="all">All types</option>
                  <option value="company">Company</option>
                  <option value="industry">Industry</option>
                </select>
              </div>
            </div>
            <div className="campaign-roster">
              {filteredCampaigns.map((campaign) => {
                const responseRate = computeResponseRate(campaign);
                return (
                  <button
                    key={campaign.id}
                    className={`roster-card ${campaign.id === selectedCampaignId ? 'active' : ''}`}
                    onClick={() => setSelectedCampaignId(campaign.id)}
                  >
                    <div className="roster-header">
                      <h4>{campaign.name}</h4>
                      <div className="roster-actions">
                        <span className={`status-pill status-${campaign.status}`}>{campaign.status}</span>
                        <button
                          type="button"
                          className="icon-button icon-button--ghost"
                          aria-label="Delete campaign"
                          onClick={(event) => { event.stopPropagation(); requestDeleteCampaign(campaign); }}
                        >
                          <Icon name="trash" size="sm" />
                        </button>
                      </div>
                    </div>
                    <p className="target-line">{campaign.targetFocus}</p>
                    <div className="roster-metrics">
                      <span><Icon name="activity" /> {responseRate || 0}% response</span>
                      <span><Icon name="calendar" /> {campaign.metrics.meetings} meetings</span>
                      <span><Icon name="users" /> {campaign.metrics.warmIntroductions} warm leads</span>
                    </div>
                  </button>
                );
              })}
              {!filteredCampaigns.length && (
                <div className="empty-state">No campaigns match this filter.</div>
              )}
            </div>
          </div>

        </section>

        <section className="campaigns-column details">
          {!selectedCampaign && (
            <div className="campaign-card placeholder">
              <h3>Select a campaign</h3>
              <p>Create or pick a campaign to see outreach analytics, A/B tests, and job links.</p>
            </div>
          )}

          {selectedCampaign && (
            <>
              <div className="page-tabs">
                {detailPages.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`page-tab ${activePage === tab.id ? 'active' : ''}`}
                    onClick={() => setActivePage(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {renderActivePage()}
            </>
          )}
        </section>
      </div>
      <ConfirmDialog
        isOpen={Boolean(pendingDeleteCampaign)}
        onClose={() => setPendingDeleteCampaign(null)}
        onConfirm={confirmDeleteCampaign}
        title="Delete campaign"
        message={`Are you sure you want to delete "${pendingDeleteCampaign?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
};

export default NetworkingCampaigns;
