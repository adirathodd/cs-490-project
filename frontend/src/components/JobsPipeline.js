import React, { useEffect, useMemo, useState } from 'react';
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor, MouseSensor, TouchSensor, useDroppable, DragOverlay } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { jobsAPI } from '../services/api';
import Icon from './Icon';
import './ProfileForm.css';

const STAGES = [
  { key: 'interested', label: 'Interested', color: '#edf2ff' },
  { key: 'applied', label: 'Applied', color: '#e6fffa' },
  { key: 'phone_screen', label: 'Phone Screen', color: '#fffbea' },
  { key: 'interview', label: 'Interview', color: '#f0fff4' },
  { key: 'offer', label: 'Offer', color: '#fefce8' },
  { key: 'rejected', label: 'Rejected', color: '#fff5f5' },
];

function daysInStage(job) {
  if (typeof job.days_in_stage === 'number') return job.days_in_stage;
  if (!job.last_status_change) return 0;
  const t = new Date(job.last_status_change).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - t) / (1000 * 60 * 60 * 24)));
}

const JobCard = ({ job, selected, onToggleSelect, onOpenDetails, compact = false, onOpenLink, dragHandle }) => (
  <div
    className="profile-form-card"
    style={{ padding: compact ? 8 : 12, marginBottom: 8, border: selected ? '2px solid #6366f1' : '1px solid #e5e7eb' }}
    data-testid={`job-card-${job.id}`}
    onClick={onToggleSelect}
    role="button"
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <div style={{ fontWeight: 600 }}>
        {job.title} <span style={{ color: '#666', fontWeight: 400 }}>@ {job.company_name}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {dragHandle}
        {job.posting_url ? (
          <a
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
          className="back-button"
          onClick={(e) => { e.stopPropagation(); onOpenDetails?.(job); }}
          onMouseDown={(e) => e.stopPropagation()}
          title="View details"
          style={{ padding: '2px 6px' }}
        >
          <Icon name="info" size="sm" />
        </button>
      </div>
    </div>
    <div style={{ color: '#666', fontSize: 13 }}>
      {job.location || '—'} • {job.job_type?.toUpperCase()}
    </div>
    <div style={{ color: '#555', fontSize: 12 }}>Days in stage: {daysInStage(job)}</div>
  </div>
);

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
      /* visual handle only; whole card is draggable */
      onClick={(e) => e.stopPropagation()}
      title="Drag"
      aria-label="Drag handle"
      style={{ cursor: 'grab', userSelect: 'none', padding: '2px 4px', border: '1px dashed #e5e7eb', borderRadius: 4, color: '#666' }}
    >
      ▒▒
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
    <div
      ref={setNodeRef}
      style={{
        minHeight: 24,
        paddingBottom: 2,
        outline: isOver ? '2px dashed #6366f1' : 'none',
        outlineOffset: -2,
        transition: 'outline 120ms ease',
      }}
    >
      {children}
      {isOver && isEmpty && (
        <div style={{ color: '#666', fontSize: 12, textAlign: 'center', padding: 8 }}>Drop here</div>
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
  const [drawerJob, setDrawerJob] = useState(null);

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
      const list = await jobsAPI.getJobs();
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

  const moveSelected = async (target) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    try {
      await jobsAPI.bulkUpdateStatus(ids, target);
      setSelected(new Set());
      await load();
    } catch (e) {
      setError(e?.message || e?.error?.message || 'Bulk move failed');
    }
  };

  return (
    <div className="profile-form-container" style={{ flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start' }}>
      <div className="profile-form-card" style={{ maxWidth: 'none', width: '100%' }}>
        <div className="page-backbar">
          <button className="btn-back" onClick={() => (window.location.href = '/dashboard')}>← Back to Dashboard</button>
        </div>
        <div className="profile-header">
          <div>
            <h2>Job Pipeline</h2>
            <p className="form-subtitle">Track jobs through stages. Drag cards between columns.</p>
          </div>
        </div>

        {error && (
          <div className="error-banner" role="alert"><span className="error-icon">!</span><span>{error}</span></div>
        )}

        {/* Summary chips */}
        <div className="form-row" style={{ alignItems: 'center', marginBottom: 8 }}>
          {(() => {
            const totals = STAGES.reduce((acc, s) => acc + (counts[s.key] ?? (jobsByStage[s.key]?.length || 0)), 0);
            const interviewing = (counts['phone_screen'] ?? 0) + (counts['interview'] ?? 0);
            const offers = counts['offer'] ?? 0;
            return (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="back-button"
                  title="Show all jobs"
                  onClick={() => setFilter('all')}
                  aria-label="Show all jobs"
                >
                  Total: {totals}
                </button>
                <button className="back-button" onClick={() => setFilter('interviewing')}>Interviewing: {interviewing}</button>
                <button className="back-button" onClick={() => setFilter('offer')}>Offers: {offers}</button>
              </div>
            );
          })()}
        </div>

        <div className="form-row" style={{ alignItems: 'center' }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Search jobs</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, company, or location"
            />
          </div>
          <div className="form-group">
            <label>Filter by status</label>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="interviewing">Interviewing (Phone + Interview)</option>
              {STAGES.map(s => (<option key={s.key} value={s.key}>{s.label}</option>))}
            </select>
          </div>
          <div className="form-group">
            <label>Bulk actions</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="back-button" onClick={() => setBulkMode(!bulkMode)}>{bulkMode ? 'Done Selecting' : 'Select Multiple'}</button>
              {/* Removed the old select-based bulk mover; column checkboxes now handle bulk moves */}
            </div>
          </div>
          <div className="form-group" style={{ alignSelf: 'flex-end' }}>
            <label>&nbsp;</label>
            <a className="back-button" href="/jobs" style={{ textDecoration: 'none' }}>+ Add Job</a>
          </div>
          <div className="form-group" style={{ alignSelf: 'flex-end' }}>
            <label>&nbsp;</label>
            <button className="back-button" onClick={() => setCompact((p) => !p)}>{compact ? 'Cozy cards' : 'Compact cards'}</button>
          </div>
        </div>
  </div>

  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${visibleStages.length}, 1fr)`, gap: 12, width: '100%', marginTop: 16 }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
          {visibleStages.map((stage) => (
            <div key={stage.key} className="profile-form-card" style={{ background: stage.color, padding: 0, marginTop: 0 }}>
              <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                <div style={{ position: 'sticky', top: 0, zIndex: 1, background: stage.color, borderBottom: '1px solid #e5e7eb', padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/** Column checkbox for bulk moves: appears when bulkMode is active. Clicking moves selected jobs to this stage. */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h3 style={{ margin: 0 }}><Icon name="list" size="sm" /> {stage.label}</h3>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {bulkMode ? (
                      (() => {
                        const sel = Array.from(selected);
                        let checked = false;
                        let indeterminate = false;
                        if (sel.length > 0) {
                          const inThis = sel.map((id) => findJobById(id)?.status === stage.key);
                          checked = inThis.every(Boolean);
                          indeterminate = inThis.some(Boolean) && !checked;
                        }
                        return (
                          <input
                            type="checkbox"
                            title={`Move selected jobs to ${stage.label}`}
                            aria-label={`Move selected jobs to ${stage.label}`}
                            disabled={selected.size === 0}
                            checked={checked}
                            onChange={(e) => { e.stopPropagation(); moveSelected(stage.key); }}
                            ref={(el) => { if (el) el.indeterminate = indeterminate; }}
                            style={{ width: 18, height: 18, cursor: selected.size === 0 ? 'not-allowed' : 'pointer', opacity: selected.size === 0 ? 0.5 : 1 }}
                          />
                        );
                      })()
                    ) : null}
                    <div title="count" style={{ fontWeight: 600 }}>{counts[stage.key] ?? (jobsByStage[stage.key]?.length || 0)}</div>
                    <button
                      className="back-button"
                      aria-label={`Column options for ${stage.label}`}
                      onClick={() => setOpenMenu((prev) => (prev === stage.key ? null : stage.key))}
                      style={{ padding: '4px 8px' }}
                    >⋯</button>
                    {openMenu === stage.key && (
                      <div style={{ position: 'absolute', right: 12, top: 44, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, boxShadow: '0 8px 20px rgba(0,0,0,0.08)', zIndex: 2 }}>
                        <button
                          className="back-button"
                          onClick={() => {
                            setSortByRecency((p) => ({ ...p, [stage.key]: !p[stage.key] }));
                            setOpenMenu(null);
                          }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'transparent' }}
                        >{sortByRecency[stage.key] ? 'Unsort' : 'Sort by recency'}</button>
                        <button
                          className="back-button"
                          onClick={() => {
                            setCollapsed((p) => ({ ...p, [stage.key]: !p[stage.key] }));
                            setOpenMenu(null);
                          }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'transparent' }}
                        >{collapsed[stage.key] ? 'Expand' : 'Collapse'}</button>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ padding: 12 }}>
                  {(() => {
                    // Use the exact list that is rendered for SortableContext items to keep dnd-kit indexes in sync
                    const visibleList = !collapsed[stage.key] ? filteredAndSorted(stage.key) : [];
                    const isEmpty = !visibleList || visibleList.length === 0;
                    return (
                      <SortableContext id={stage.key} items={visibleList.map((j) => j.id)} strategy={verticalListSortingStrategy}>
                        <DroppableColumn id={stage.key} isEmpty={isEmpty}>
                          {visibleList.map((job) => (
                        <SortableJobCard
                          key={job.id}
                          job={job}
                          selected={bulkMode && selected.has(job.id)}
                          onToggleSelect={() => bulkMode && toggleSelect(job.id)}
                          onOpenDetails={(j) => setDrawerJob(j)}
                          compact={compact}
                        />
                          ))}
                          {loading && <p>Loading…</p>}
                          {!loading && isEmpty && <p style={{ color: '#666' }}>No jobs</p>}
                        </DroppableColumn>
                      </SortableContext>
                    );
                  })()}
                </div>
              </div>
            </div>
          ))}

          <DragOverlay>
            {activeId ? (
              <div style={{ cursor: 'grabbing' }}>
                {(() => {
                  const j = findJobById(activeId);
                  return j ? <JobCard job={j} selected={false} onToggleSelect={() => {}} compact={compact} /> : null;
                })()}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Right-side details drawer */}
      {drawerJob && (
        <>
          <div onClick={() => setDrawerJob(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.15)' }} />
          <div style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: 'min(420px, 92vw)', background: '#fff', borderLeft: '1px solid #e5e7eb', boxShadow: '-8px 0 24px rgba(0,0,0,0.08)', padding: 16, overflowY: 'auto', zIndex: 50 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{drawerJob.title}</h3>
              <button className="back-button" onClick={() => setDrawerJob(null)}>Close</button>
            </div>
            <div style={{ color: '#666', marginBottom: 8 }}>{drawerJob.company_name} • {drawerJob.location || '—'} • {drawerJob.job_type?.toUpperCase()}</div>
            {drawerJob.posting_url && (
              <div style={{ marginBottom: 8 }}>
                <a className="back-button" href={drawerJob.posting_url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                  <Icon name="link" size="sm" /> Open job posting
                </a>
              </div>
            )}
            {drawerJob.description && (
              <div className="profile-form-card" style={{ padding: 12 }}>
                <h4 style={{ marginTop: 0 }}>Description / Notes</h4>
                <p style={{ whiteSpace: 'pre-wrap' }}>{drawerJob.description}</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
