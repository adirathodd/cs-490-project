import React, { useEffect, useMemo, useState } from 'react';
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor, MouseSensor, TouchSensor, useDroppable, DragOverlay } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { jobsAPI } from '../../services/api';
import Icon from '../common/Icon';
import '../profile/ProfileForm.css';
import './JobsPipeline.css';

const STAGES = [
  { key: 'interested', label: 'Interested', color: '#edf2ff' },
  { key: 'applied', label: 'Applied', color: '#e6fffa' },
  { key: 'phone_screen', label: 'Phone Screen', color: '#fffbea' },
  { key: 'interview', label: 'Interview', color: '#f0fff4' },
  { key: 'offer', label: 'Offer', color: '#fefce8' },
  { key: 'rejected', label: 'Rejected', color: '#fff5f5' },
];

const toProperCase = (value) => {
  if (!value || typeof value !== 'string') return value || '';
  return value
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const getMatchScoreTone = (score) => {
  if (score >= 80) return 'is-strong';
  if (score >= 60) return 'is-medium';
  return 'is-low';
};

function daysInStage(job) {
  if (typeof job.days_in_stage === 'number') return job.days_in_stage;
  if (!job.last_status_change) return 0;
  const t = new Date(job.last_status_change).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - t) / (1000 * 60 * 60 * 24)));
}

const JobCard = ({ job, selected, onToggleSelect, onOpenDetails, compact = false, dragHandle }) => {
  const score = typeof job.match_score === 'number' ? job.match_score : Number(job.match_score);
  const matchTone = Number.isFinite(score) ? getMatchScoreTone(score) : null;
  const jobType = job.job_type ? toProperCase(job.job_type.replace(/_/g, ' ')) : 'N/A';
  const title = job.title ? toProperCase(job.title) : 'Untitled Role';
  const company = job.company_name ? toProperCase(job.company_name) : 'Unknown Company';

  return (
    <div
      className={`pipeline-job-card${selected ? ' is-selected' : ''}${compact ? ' is-compact' : ''}${onToggleSelect ? ' is-selectable' : ''}`}
      data-testid={`job-card-${job.id}`}
      onClick={onToggleSelect}
      role={onToggleSelect ? 'button' : undefined}
      tabIndex={onToggleSelect ? 0 : undefined}
      onKeyDown={(e) => {
        if (!onToggleSelect) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggleSelect();
        }
      }}
    >
      <div className="pipeline-job-header">
        <div>
          <p className="pipeline-job-title">{title}</p>
          <p className="pipeline-job-company">@ {company}</p>
        </div>
        <div className="pipeline-job-actions">
          {Number.isFinite(score) && (
            <span
              className={`pipeline-match-badge ${matchTone}`}
              title={`Match Score: ${Math.round(score)}%${job.match_grade ? ` - ${job.match_grade}` : ''}`}
            >
              {Math.round(score)}%
            </span>
          )}
          {dragHandle}
          {job.posting_url ? (
            <a
              className="pipeline-icon-button"
              href={job.posting_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              title="Open job link"
            >
              <Icon name="link" size="sm" />
            </a>
          ) : null}
          <button
            type="button"
            className="pipeline-icon-button"
            onClick={(e) => { e.stopPropagation(); onOpenDetails?.(job); }}
            onMouseDown={(e) => e.stopPropagation()}
            title="View details"
          >
            <Icon name="info" size="sm" />
          </button>
        </div>
      </div>
      <div className="pipeline-job-meta">
        <span>{job.location ? toProperCase(job.location) : '—'}</span>
        <span>{jobType}</span>
      </div>
      <div className="pipeline-job-stage">
        <span>Days in stage</span>
        <strong>{daysInStage(job)}</strong>
      </div>
      {job.application_deadline && (() => {
        const d = new Date(job.application_deadline);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        let color = '#94a3b8';
        if (job.status === 'interested') {
          color = '#059669';
          if (diff < 0) color = '#dc2626';
          else if (diff <= 3) color = '#f59e0b';
        }
        return (
          <div className="pipeline-deadline">
            <span className="pipeline-deadline-indicator" style={{ background: color }} aria-hidden="true" />
            <span title={`Application deadline: ${job.application_deadline}`}>
              {diff < 0 ? `Overdue by ${Math.abs(diff)}d` : `${diff}d left`}
            </span>
          </div>
        );
      })()}
    </div>
  );
};

// Draggable/sortable wrapper for a job card using dnd-kit
const SortableJobCard = ({ job, selected, onToggleSelect, onOpenDetails, compact = false }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: job.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: 'grab',
    zIndex: isDragging ? 10 : undefined,
    touchAction: 'none',
  };
  const handle = (
    <span
      className="pipeline-drag-indicator"
      onClick={(e) => e.stopPropagation()}
      title="Drag"
      aria-label="Drag handle"
    >
      <Icon name="grip" size="sm" />
    </span>
  );
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <JobCard job={job} selected={selected} onToggleSelect={onToggleSelect} onOpenDetails={onOpenDetails} compact={compact} dragHandle={handle} />
    </div>
  );
};

// Droppable container to allow dropping into empty columns
const DroppableColumn = ({ id, children, isEmpty }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`pipeline-droppable${isOver ? ' is-over' : ''}`}>
      {children}
      {isOver && isEmpty && (
        <div className="pipeline-droppable-empty">Drop here</div>
      )}
    </div>
  );
};

export default function JobsPipeline() {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 1 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 1 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const [jobsByStage, setJobsByStage] = useState({});
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [activeId, setActiveId] = useState(null);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState({}); // stageKey -> boolean
  const [sortByRecency, setSortByRecency] = useState({}); // stageKey -> boolean
  const [openMenu, setOpenMenu] = useState(null); // stageKey | null
  const [compact, setCompact] = useState(false);
  const [detailJob, setDetailJob] = useState(null);
  const [pendingMoveTarget, setPendingMoveTarget] = useState(null); // target stage key awaiting confirmation
  const getStageCount = (key) => counts[key] ?? (jobsByStage[key]?.length || 0);
  // threshold can be configured via localStorage key 'pipeline_move_threshold'
  const getConfiguredThreshold = () => {
    try {
      const v = localStorage.getItem('pipeline_move_threshold');
      const n = Number(v);
      if (!Number.isNaN(n) && n > 0) return n;
    } catch {}
    return 5;
  };
  // eslint-disable-next-line no-unused-vars
  const [LARGE_MOVE_THRESHOLD, setLargeMoveThreshold] = useState(getConfiguredThreshold());
  // hovered column key for badge visibility
  const [hoveredStage, setHoveredStage] = useState(null);

  const visibleStages = useMemo(() => {
    if (filter === 'all') return STAGES;
    if (filter === 'interviewing') {
      const allowed = new Set(['phone_screen', 'interview']);
      return STAGES.filter(s => allowed.has(s.key));
    }
    return STAGES.filter(s => s.key === filter);
  }, [filter]);

  const load = async () => {
    setLoading(true);
    try {
      // Load all jobs and bucket them client-side
      const resp = await jobsAPI.getJobs();
      const list = Array.isArray(resp) ? resp : (Array.isArray(resp?.results) ? resp.results : []);
      const bucket = STAGES.reduce((acc, s) => ({ ...acc, [s.key]: [] }), {});
      (list || []).forEach((j) => {
        const key = j.status || 'interested';
        if (!bucket[key]) bucket[key] = [];
        bucket[key].push(j);
      });
      setJobsByStage(bucket);
      try {
        const c = await jobsAPI.getJobStats();
        setCounts(c || {});
      } catch {}
      setError('');
    } catch (e) {
      const msg = e?.message || e?.error?.message || 'Failed to load pipeline';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    // restore UI prefs
    try {
      const c = localStorage.getItem('pipeline_collapsed');
      const s = localStorage.getItem('pipeline_sort');
      const cp = localStorage.getItem('pipeline_compact');
      if (c) setCollapsed(JSON.parse(c));
      if (s) setSortByRecency(JSON.parse(s));
      if (cp) setCompact(cp === '1');
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem('pipeline_collapsed', JSON.stringify(collapsed)); } catch {}
  }, [collapsed]);
  useEffect(() => {
    try { localStorage.setItem('pipeline_sort', JSON.stringify(sortByRecency)); } catch {}
  }, [sortByRecency]);
  useEffect(() => {
    try { localStorage.setItem('pipeline_compact', compact ? '1' : '0'); } catch {}
  }, [compact]);

  const findJobById = (id) => {
    for (const key of Object.keys(jobsByStage)) {
      const j = (jobsByStage[key] || []).find((x) => x.id === id);
      if (j) return j;
    }
    return null;
  };

  const filteredAndSorted = (stageKey) => {
    let list = Array.from(jobsByStage[stageKey] || []);
    const term = search.trim().toLowerCase();
    if (term) {
      list = list.filter((j) =>
        (j.title || '').toLowerCase().includes(term) ||
        (j.company_name || '').toLowerCase().includes(term) ||
        (j.location || '').toLowerCase().includes(term)
      );
    }
    if (sortByRecency[stageKey]) {
      list.sort((a, b) => {
        const ta = a.last_status_change ? new Date(a.last_status_change).getTime() : 0;
        const tb = b.last_status_change ? new Date(b.last_status_change).getTime() : 0;
        return tb - ta;
      });
    }
    return list;
  };

  const onDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (!active || !over) return;
    const fromId = active?.data?.current?.sortable?.containerId;
    // If hovering over an item, its containerId is where we dropped; otherwise fall back to over.id (a container)
    const toId = over?.data?.current?.sortable?.containerId ?? over?.id;
    if (!fromId || !toId) return;

    const activeId = active.id;
    const overId = over.id;

    // Reorder within the same column
    if (fromId === toId) {
      if (activeId === overId) return;
      // If the column is currently sorted or filtered, skip manual reordering to avoid confusing state
      const term = search.trim();
      if (sortByRecency[fromId] || term) return;
      setJobsByStage((prev) => {
        const list = Array.from(prev[fromId] || []);
        const oldIndex = list.findIndex((j) => j.id === activeId);
        const newIndex = list.findIndex((j) => j.id === overId);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return { ...prev, [fromId]: arrayMove(list, oldIndex, newIndex) };
      });
      return; // No server call needed for pure reordering
    }

    // Move across different columns
    const jobId = activeId;
    setJobsByStage((prev) => {
      const fromList = Array.from(prev[fromId] || []);
      const toList = Array.from(prev[toId] || []);
      const idx = fromList.findIndex((j) => j.id === jobId);
      if (idx === -1) return prev;
      const [moved] = fromList.splice(idx, 1);
      moved.status = toId;
      moved.last_status_change = new Date().toISOString();

      // If we dropped over an item, insert before it; otherwise add to top
      const overIndex = toList.findIndex((j) => j.id === overId);
      if (overIndex >= 0) {
        toList.splice(overIndex, 0, moved);
      } else {
        toList.unshift(moved);
      }
      return { ...prev, [fromId]: fromList, [toId]: toList };
    });

    try {
      await jobsAPI.updateJob(jobId, { status: toId });
      try { setCounts(await jobsAPI.getJobStats()); } catch {}
    } catch (e) {
      await load();
    }
  };
  const onDragStart = (event) => {
    setActiveId(event?.active?.id ?? null);
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  // perform the actual API call to move selected jobs
  // perform the actual API call to move selected jobs, capture previous statuses for undo
  const performMoveSelected = async (target) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    // snapshot previous statuses
    const prevStatuses = {};
    ids.forEach((id) => { const j = findJobById(id); if (j) prevStatuses[id] = j.status; });
    try {
      await jobsAPI.bulkUpdateStatus(ids, target);
      // keep undo data available (ids + prevStatuses) for a short period
      setUndoData({ ids, prevStatuses });
      setShowUndo(true);
      // clear selection and modal
      setSelected(new Set());
      setPendingMoveTarget(null);
      await load();
      // clear undo after timeout
      setTimeout(() => { setShowUndo(false); setUndoData(null); }, 6000);
    } catch (e) {
      setError(e?.message || e?.error?.message || 'Bulk move failed');
    }
  };

  // state for undo snackbar
  const [undoData, setUndoData] = useState(null);
  const [showUndo, setShowUndo] = useState(false);
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const [deadlineValue, setDeadlineValue] = useState(''); // YYYY-MM-DD

  // Undo state for bulk-deadline operations
  const [undoDeadlineData, setUndoDeadlineData] = useState(null);
  const [showUndoDeadline, setShowUndoDeadline] = useState(false);

  // perform bulk deadline update for selected jobs (properly scoped here)
  const performBulkDeadline = async (deadline) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    // capture previous deadlines to allow undo
    const prevDeadlines = {};
    ids.forEach((id) => { const j = findJobById(id); if (j) prevDeadlines[id] = j.application_deadline ?? null; });
    try {
      await jobsAPI.bulkUpdateDeadline(ids, deadline || null);
      setUndoDeadlineData({ ids, prevDeadlines });
      setShowUndoDeadline(true);
      setSelected(new Set());
      setShowDeadlineModal(false);
      await load();
      setTimeout(() => { setShowUndoDeadline(false); setUndoDeadlineData(null); }, 6000);
    } catch (e) {
      setError('Failed to update deadlines');
    }
  };

  const handleUndoDeadline = async () => {
    if (!undoDeadlineData) return;
    const { ids, prevDeadlines } = undoDeadlineData;
    try {
      await Promise.all(ids.map((id) => jobsAPI.updateJob(id, { application_deadline: prevDeadlines[id] })));
      setShowUndoDeadline(false);
      setUndoDeadlineData(null);
      await load();
    } catch (e) {
      setError('Undo failed');
    }
  };

  // start move flow; if large, request confirmation first
  const initiateMoveSelected = (target) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (ids.length > LARGE_MOVE_THRESHOLD) {
      setPendingMoveTarget(target);
    } else {
      performMoveSelected(target);
    }
  };

  // Undo handler exposed to snackbar: performs the per-job updates to restore previous statuses
  const handleUndo = async () => {
    if (!undoData) return;
    const { ids, prevStatuses } = undoData;
    try {
      await Promise.all(ids.map((id) => jobsAPI.updateJob(id, { status: prevStatuses[id] })));
      setShowUndo(false);
      setUndoData(null);
      await load();
    } catch (e) {
      setError('Undo failed');
    }
  };

  const totalJobs = STAGES.reduce((acc, stage) => acc + getStageCount(stage.key), 0);
  const interviewingJobs = getStageCount('phone_screen') + getStageCount('interview');
  const offerJobs = getStageCount('offer');

  return (
    <div className="pipeline-page">
      <div className="pipeline-shell">
        <div className="page-backbar">
          <a
            className="btn-back"
            href="/jobs"
            aria-label="Back to jobs"
            title="Back to jobs"
          >
            ← Back
          </a>
        </div>

        <section className="pipeline-hero">
          <div>
            <p className="pipeline-hero-eyebrow">Opportunity tracker</p>
            <h1>Job Pipeline</h1>
            <p className="pipeline-hero-subtitle">Stay on top of every application stage. Drag cards between columns or use bulk actions for faster updates.</p>
          </div>
          <div className="pipeline-hero-actions">
            <a className="btn-back pipeline-primary-action" href="/jobs">+ Add Job</a>
            <button className="btn-back" type="button" onClick={() => setCompact((p) => !p)}>
              <Icon name={compact ? 'layers' : 'grip'} size="sm" /> {compact ? 'Cozy cards' : 'Compact cards'}
            </button>
          </div>
        </section>

        {error && (
          <div className="error-banner" role="alert"><span className="error-icon">!</span><span>{error}</span></div>
        )}

        <section className="pipeline-stats">
          <button
            type="button"
            className={`pipeline-stat ${filter === 'all' ? 'is-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            <Icon name="layers" size="lg" />
            <div>
              <span>Total jobs</span>
              <strong>{totalJobs}</strong>
            </div>
          </button>
          <button
            type="button"
            className={`pipeline-stat ${filter === 'interviewing' ? 'is-active' : ''}`}
            onClick={() => setFilter('interviewing')}
          >
            <Icon name="briefcase" size="lg" />
            <div>
              <span>Interviewing</span>
              <strong>{interviewingJobs}</strong>
            </div>
          </button>
          <button
            type="button"
            className={`pipeline-stat ${filter === 'offer' ? 'is-active' : ''}`}
            onClick={() => setFilter('offer')}
          >
            <Icon name="thumbs-up" size="lg" />
            <div>
              <span>Offers</span>
              <strong>{offerJobs}</strong>
            </div>
          </button>
        </section>

        <section className="pipeline-toolbar" aria-label="Pipeline controls">
          <div className="pipeline-control pipeline-control--grow">
            <label htmlFor="pipeline-search">Search jobs</label>
            <div className="pipeline-input-with-icon">
              <Icon name="search" size="sm" />
              <input
                id="pipeline-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, company, or location"
              />
            </div>
          </div>
          <div className="pipeline-control">
            <label htmlFor="pipeline-filter">Filter by status</label>
            <select id="pipeline-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="interviewing">Interviewing (Phone + Interview)</option>
              {STAGES.map((s) => (<option key={s.key} value={s.key}>{s.label}</option>))}
            </select>
          </div>
          <div className="pipeline-control pipeline-control--bulk">
            <label>Bulk actions</label>
            <div className="pipeline-bulk-actions">
              <button className="btn-back" type="button" onClick={() => setBulkMode(!bulkMode)}>
                {bulkMode ? 'Done Selecting' : 'Select Multiple'}
              </button>
              {bulkMode && (
                <>
                  <button className="btn-back" type="button" onClick={() => setShowDeadlineModal(true)} disabled={selected.size === 0}>Set deadline</button>
                  <button
                    className="btn-back"
                    type="button"
                    onClick={async () => {
                      if (selected.size === 0) return;
                      try {
                        const ids = Array.from(selected);
                        await jobsAPI.bulkUpdateDeadline(ids, null);
                        setSelected(new Set());
                        await load();
                      } catch (e) {
                        setError('Failed to clear deadlines');
                      }
                    }}
                    disabled={selected.size === 0}
                  >
                    Clear deadlines
                  </button>
                </>
              )}
            </div>
          </div>
        </section>

        <section
          className="pipeline-columns"
          style={{ '--stage-count': visibleStages.length }}
        >
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
            {visibleStages.map((stage) => {
              const visibleList = !collapsed[stage.key] ? filteredAndSorted(stage.key) : [];
              const droppableEmpty = !collapsed[stage.key] && visibleList.length === 0;
              const stageCount = getStageCount(stage.key);
              return (
                <div key={stage.key} className="pipeline-column" style={{ '--stage-color': stage.color }}>
                  <div className="pipeline-column-scroll">
                    <header className="pipeline-column-header">
                      <div className="pipeline-column-title">
                        <span className="pipeline-column-dot" aria-hidden="true" />
                        <div>
                          <h3>{stage.label}</h3>
                          <span title="count">{stageCount} active</span>
                        </div>
                      </div>
                      <div className="pipeline-column-controls">
                        {bulkMode ? (() => {
                          const sel = Array.from(selected);
                          let checked = false;
                          let indeterminate = false;
                          if (sel.length > 0) {
                            const inThis = sel.map((id) => findJobById(id)?.status === stage.key);
                            checked = inThis.every(Boolean);
                            indeterminate = inThis.some(Boolean) && !checked;
                          }
                          return (
                            <div
                              className="pipeline-stage-bulk"
                              onMouseEnter={() => setHoveredStage(stage.key)}
                              onMouseLeave={() => setHoveredStage(null)}
                            >
                              <input
                                type="checkbox"
                                title={`Move selected jobs to ${stage.label}`}
                                aria-label={`Move selected jobs to ${stage.label}`}
                                disabled={selected.size === 0}
                                checked={checked}
                                onChange={(e) => { e.stopPropagation(); initiateMoveSelected(stage.key); }}
                                ref={(el) => { if (el) el.indeterminate = indeterminate; }}
                              />
                              {selected.size > 0 && (
                                <span
                                  className="pipeline-stage-badge"
                                  role="status"
                                  style={{ opacity: hoveredStage === stage.key ? 1 : 0 }}
                                  data-testid={`move-badge-${stage.key}`}
                                >
                                  {selected.size}
                                </span>
                              )}
                            </div>
                          );
                        })() : null}
                        <button
                          type="button"
                          className="pipeline-icon-button"
                          aria-label={`Column options for ${stage.label}`}
                          onClick={() => setOpenMenu((prev) => (prev === stage.key ? null : stage.key))}
                        >⋯</button>
                        {openMenu === stage.key && (
                          <div className="pipeline-column-menu">
                            <button
                              type="button"
                              onClick={() => {
                                setSortByRecency((p) => ({ ...p, [stage.key]: !p[stage.key] }));
                                setOpenMenu(null);
                              }}
                            >{sortByRecency[stage.key] ? 'Unsort' : 'Sort by recency'}</button>
                            <button
                              type="button"
                              onClick={() => {
                                setCollapsed((p) => ({ ...p, [stage.key]: !p[stage.key] }));
                                setOpenMenu(null);
                              }}
                            >{collapsed[stage.key] ? 'Expand' : 'Collapse'}</button>
                          </div>
                        )}
                      </div>
                    </header>
                    <div className="pipeline-column-body">
                      <SortableContext id={stage.key} items={visibleList.map((j) => j.id)} strategy={verticalListSortingStrategy}>
                        <DroppableColumn id={stage.key} isEmpty={droppableEmpty}>
                          {visibleList.map((job) => (
                            <SortableJobCard
                              key={job.id}
                              job={job}
                              selected={bulkMode && selected.has(job.id)}
                              onToggleSelect={bulkMode ? () => toggleSelect(job.id) : undefined}
                              onOpenDetails={(j) => setDetailJob(j)}
                              compact={compact}
                            />
                          ))}
                          {loading && <p className="pipeline-empty">Loading…</p>}
                          {!loading && droppableEmpty && <p className="pipeline-empty">No jobs</p>}
                        </DroppableColumn>
                      </SortableContext>
                    </div>
                  </div>
                </div>
              );
            })}

            <DragOverlay>
              {activeId ? (
                <div style={{ cursor: 'grabbing' }}>
                  {(() => {
                    const j = findJobById(activeId);
                    return j ? <JobCard job={j} selected={false} compact={compact} /> : null;
                  })()}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </section>

        {pendingMoveTarget && (
          <>
            <div className="pipeline-modal-overlay" onClick={() => setPendingMoveTarget(null)} />
            <div
              className="pipeline-modal"
              role="dialog"
              aria-modal="true"
              onKeyDown={(e) => {
                if (e.key === 'Escape') setPendingMoveTarget(null);
              }}
            >
              <h3>Confirm bulk move</h3>
              <p>You're moving {Array.from(selected).length} jobs to <strong>{STAGES.find((s) => s.key === pendingMoveTarget)?.label}</strong>. This action cannot be undone.</p>
              <div className="pipeline-modal-actions">
                <button className="btn-back" type="button" onClick={() => setPendingMoveTarget(null)}>Cancel</button>
                <button className="btn-back pipeline-primary-action" type="button" onClick={() => performMoveSelected(pendingMoveTarget)}>Confirm</button>
              </div>
            </div>
          </>
        )}

        {showDeadlineModal && (
          <>
            <div className="pipeline-modal-overlay" onClick={() => setShowDeadlineModal(false)} />
            <div className="pipeline-modal" role="dialog" aria-modal="true">
              <h3>Set deadline for selected jobs</h3>
              <p>Choose a date to apply to the selected jobs (or leave blank to cancel):</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="date" value={deadlineValue} onChange={(e) => setDeadlineValue(e.target.value)} />
                <button className="btn-back" type="button" onClick={() => { setDeadlineValue(''); setShowDeadlineModal(false); }}>Cancel</button>
                <button className="btn-back pipeline-primary-action" type="button" onClick={() => performBulkDeadline(deadlineValue)}>Apply</button>
              </div>
              <div style={{ marginTop: 8 }}>
                <small style={{ color: '#666' }}>Tip: To clear deadlines, use the "Clear deadlines" button in Bulk actions.</small>
              </div>
            </div>
          </>
        )}

        {showUndo && undoData && (
          <div data-testid="undo-snackbar" className="pipeline-snackbar" role="status">
            <div>Moved {undoData.ids.length} jobs.</div>
            <button className="btn-back" type="button" onClick={handleUndo}>Undo</button>
          </div>
        )}

        {showUndoDeadline && undoDeadlineData && (
          <div data-testid="undo-deadline-snackbar" className="pipeline-snackbar" role="status">
            <div>Updated deadlines for {undoDeadlineData.ids.length} jobs.</div>
            <button className="btn-back" type="button" onClick={handleUndoDeadline}>Undo</button>
          </div>
        )}

        {detailJob && (
          <>
            <div className="pipeline-modal-overlay" onClick={() => setDetailJob(null)} />
            <div
              className="pipeline-detail-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="pipeline-detail-title"
            >
              <div className="pipeline-detail-header">
                <div>
                  <p className="pipeline-hero-eyebrow">Job details</p>
                  <h3 id="pipeline-detail-title">{detailJob.title || 'Untitled role'}</h3>
                  <p className="pipeline-detail-company">@ {detailJob.company_name ? toProperCase(detailJob.company_name) : 'Unknown Company'}</p>
                </div>
                <button className="btn-back" type="button" onClick={() => setDetailJob(null)}>Close</button>
              </div>
              <div className="pipeline-detail-scroll">
                <div className="pipeline-detail-meta">
                  <div className="pipeline-detail-stat">
                    <span>Stage</span>
                    <strong>{detailJob.status ? toProperCase(detailJob.status.replace(/_/g, ' ')) : 'Unknown'}</strong>
                  </div>
                  <div className="pipeline-detail-stat">
                    <span>Days in stage</span>
                    <strong>{daysInStage(detailJob)}</strong>
                  </div>
                  <div className="pipeline-detail-stat">
                    <span>Job type</span>
                    <strong>{detailJob.job_type ? toProperCase(detailJob.job_type.replace(/_/g, ' ')) : '—'}</strong>
                  </div>
                  <div className="pipeline-detail-stat">
                    <span>Location</span>
                    <strong>{detailJob.location ? toProperCase(detailJob.location) : '—'}</strong>
                  </div>
                  {detailJob.application_deadline && (
                    <div className="pipeline-detail-stat">
                      <span>Deadline</span>
                      <strong>{new Date(detailJob.application_deadline).toLocaleDateString()}</strong>
                    </div>
                  )}
                  {Number.isFinite(Number(detailJob.match_score)) && (
                    <div className="pipeline-detail-stat">
                      <span>Match score</span>
                      <strong>{Math.round(Number(detailJob.match_score))}%</strong>
                    </div>
                  )}
                </div>

                {detailJob.description ? (
                  <section className="pipeline-detail-section">
                    <h4 className="pipeline-detail-heading">Job Description:</h4>
                    <p>{detailJob.description}</p>
                  </section>
                ) : (
                  <section className="pipeline-detail-section">
                    <h4 className="pipeline-detail-heading">Job Description:</h4>
                    <p className="pipeline-detail-empty">No description provided.</p>
                  </section>
                )}

                <div className="pipeline-detail-actions">
                  {detailJob.posting_url && (
                    <a className="btn-back pipeline-primary-action" href={detailJob.posting_url} target="_blank" rel="noreferrer">
                      <Icon name="link" size="sm" /> Open posting
                    </a>
                  )}
                  <a className="btn-back" href={`/jobs/${detailJob.id}`}>
                    <Icon name="briefcase" size="sm" /> View full record
                  </a>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
