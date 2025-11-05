import React, { useEffect, useMemo, useState } from 'react';
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
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

const JobCard = ({ job, selected, onToggleSelect }) => (
  <div
    className="profile-form-card"
    style={{ padding: 12, marginBottom: 8, border: selected ? '2px solid #6366f1' : '1px solid #e5e7eb' }}
    data-testid={`job-card-${job.id}`}
    onClick={onToggleSelect}
    role="button"
  >
    <div style={{ fontWeight: 600 }}>
      {job.title} <span style={{ color: '#666', fontWeight: 400 }}>@ {job.company_name}</span>
    </div>
    <div style={{ color: '#666', fontSize: 13 }}>
      {job.location || '—'} • {job.job_type?.toUpperCase()}
    </div>
    <div style={{ color: '#555', fontSize: 12 }}>Days in stage: {daysInStage(job)}</div>
  </div>
);

// Draggable/sortable wrapper for a job card using dnd-kit
const SortableJobCard = ({ job, selected, onToggleSelect }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: job.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: 'grab',
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <JobCard job={job} selected={selected} onToggleSelect={onToggleSelect} />
    </div>
  );
};

export default function JobsPipeline() {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const [jobsByStage, setJobsByStage] = useState({});
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const visibleStages = useMemo(() => {
    return filter === 'all' ? STAGES : STAGES.filter(s => s.key === filter);
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

  const onDragEnd = async (event) => {
    const { active, over } = event;
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
    <div className="profile-form-container">
      <div className="profile-form-card">
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

        <div className="form-row" style={{ alignItems: 'center' }}>
          <div className="form-group">
            <label>Filter by status</label>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All</option>
              {STAGES.map(s => (<option key={s.key} value={s.key}>{s.label}</option>))}
            </select>
          </div>
          <div className="form-group">
            <label>Bulk actions</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="back-button" onClick={() => setBulkMode(!bulkMode)}>{bulkMode ? 'Done Selecting' : 'Select Multiple'}</button>
              <select disabled={!bulkMode} onChange={(e) => moveSelected(e.target.value)} defaultValue="">
                <option value="" disabled>Move selected to…</option>
                {STAGES.map(s => (<option key={s.key} value={s.key}>{s.label}</option>))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${visibleStages.length}, 1fr)`, gap: 12 }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          {visibleStages.map((stage) => (
            <div key={stage.key} className="profile-form-card" style={{ background: stage.color }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ marginTop: 0 }}><Icon name="list" size="sm" /> {stage.label}</h3>
                <div title="count" style={{ fontWeight: 600 }}>{counts[stage.key] ?? (jobsByStage[stage.key]?.length || 0)}</div>
              </div>
              <SortableContext id={stage.key} items={(jobsByStage[stage.key] || []).map(j => j.id)} strategy={verticalListSortingStrategy}>
                <div>
                  {(jobsByStage[stage.key] || []).map((job) => (
                    <SortableJobCard key={job.id} job={job} selected={bulkMode && selected.has(job.id)} onToggleSelect={() => bulkMode && toggleSelect(job.id)} />
                  ))}
                  {loading && <p>Loading…</p>}
                  {!loading && (jobsByStage[stage.key] || []).length === 0 && <p style={{ color: '#666' }}>No jobs</p>}
                </div>
              </SortableContext>
            </div>
          ))}
        </DndContext>
      </div>
    </div>
  );
}
