import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Icon from '../common/Icon';
import './PeerSupportHub.css';

const PRIVACY_STORAGE_KEY = 'peerSupportPrivacy';
const THREAD_STORAGE_KEY = 'peerSupportThreads';

const groupSeed = [
  {
    id: 'product',
    name: 'Product & Strategy',
    industry: 'Technology',
    role: 'PM / Strategy',
    members: 184,
    focus: 'Roadmapping, PM interviews',
    cadence: 'Weekly standups',
    joined: true,
    privacy: 'Identity optional',
  },
  {
    id: 'data',
    name: 'Data & Analytics',
    industry: 'Technology',
    role: 'Data / Analytics',
    members: 132,
    focus: 'SQL drills, case studies',
    cadence: 'Bi-weekly',
    joined: false,
    privacy: 'Alias-friendly',
  },
  {
    id: 'marketing',
    name: 'Growth & Marketing',
    industry: 'Consumer / SaaS',
    role: 'Growth / Lifecycle',
    members: 96,
    focus: 'Campaign retros, peer intros',
    cadence: 'Weekly demos',
    joined: false,
    privacy: 'Name visible',
  },
  {
    id: 'ops',
    name: 'Operations & BizOps',
    industry: 'Services',
    role: 'Ops / GTM',
    members: 88,
    focus: 'Process design, negotiation',
    cadence: 'Fortnightly',
    joined: false,
    privacy: 'Identity optional',
  },
];

const threadSeed = [
  {
    id: 1,
    groupId: 'product',
    title: 'Weekly accountability — top 3 commitments',
    body: 'Sharing what I will tackle this week: 10 targeted applications, 2 mock product cases, and 1 portfolio refresh. Anyone want to co-work?',
    tag: 'Accountability',
    author: 'Anon',
    timeAgo: '2h ago',
    replies: 9,
    helpful: 21,
    anonymous: true,
  },
  {
    id: 2,
    groupId: 'product',
    title: 'Hiring signal: fintech PM roles trending up',
    body: 'LedgerWave, NovaPay, and three Series B fintechs are quietly opening mid-level PM headcount. Happy to share referral guidance.',
    tag: 'Opportunity',
    author: 'Ravi',
    timeAgo: '5h ago',
    replies: 6,
    helpful: 18,
    anonymous: false,
  },
  {
    id: 3,
    groupId: 'data',
    title: 'SQL practice cadence that worked for me',
    body: 'Three 25-minute blocks with 1 peer review per week raised my take-home scores. I can host a Wednesday session if helpful.',
    tag: 'Strategy',
    author: 'Anon',
    timeAgo: '1d ago',
    replies: 12,
    helpful: 33,
    anonymous: true,
  },
];

const challengeSeed = [
  {
    id: 'ten-x-ten',
    title: '10 applications in 10 days',
    description: 'Micro-commitments with daily check-ins and a Saturday retro.',
    progress: 60,
    target: 10,
    completed: 6,
    groupId: 'product',
    cadence: 'Daily',
    status: 'in-progress',
  },
  {
    id: 'warm-intros',
    title: 'Warm intros from peers',
    description: 'Trade two intros per week and track response quality.',
    progress: 45,
    target: 6,
    completed: 2,
    groupId: 'data',
    cadence: 'Weekly',
    status: 'planning',
  },
  {
    id: 'story-bank',
    title: 'Story bank sprint',
    description: 'Build 6 STAR stories and get peer critique before interviews.',
    progress: 30,
    target: 6,
    completed: 1,
    groupId: 'product',
    cadence: 'Sprint',
    status: 'planning',
  },
];

const referralSeed = [
  { id: 1, title: 'Senior PM — Fintech', company: 'LedgerWave', location: 'Remote (US)', match: 'High match', type: 'Referral share', status: 'open' },
  { id: 2, title: 'Analytics Lead — Marketplace', company: 'NorthLoop', location: 'NYC Hybrid', match: 'Medium match', type: 'Peer alert', status: 'warm intro' },
  { id: 3, title: 'Lifecycle Marketing Manager', company: 'Aurora Health', location: 'Remote (USA)', match: 'High match', type: 'Referral share', status: 'open' },
];

const coachingSeed = [
  { id: 1, title: 'Peer-led resume roast', date: 'Thu · 7:00p ET', facilitator: 'Design Ops crew', seats: 12, registered: false, format: 'Live workshop' },
  { id: 2, title: 'Salary negotiation lab', date: 'Sat · 11:00a ET', facilitator: 'Comp coach + peers', seats: 20, registered: true, format: 'Webinar + Q&A' },
  { id: 3, title: 'Accountability reset', date: 'Mon · 8:00a ET', facilitator: 'Community leads', seats: 14, registered: false, format: 'Group coaching' },
];

const storiesSeed = [
  {
    id: 'break-in',
    name: 'Eva · Career switch to product',
    outcome: '4 interviews, 2 offers in 6 weeks',
    tactic: 'Weekly peer mock cases + shared story bank',
    takeaway: 'Peers flagged jargon and tightened my narrative. Referral from this group landed the onsite.',
  },
  {
    id: 'data-offer',
    name: 'Luis · Analytics IC to Senior',
    outcome: 'Offer + 12% higher base',
    tactic: 'Negotiation role-play in group coaching',
    takeaway: 'Used a comp grid peers shared; negotiated start date and sign-on with confidence.',
  },
];

const score = (value) => Math.min(100, Math.max(0, Math.round(value)));

const PeerSupportHub = () => {
  const { currentUser, userProfile } = useAuth();
  const backendFullName = (userProfile?.full_name || '').trim();
  const backendFirstLast = `${(userProfile?.first_name || '').trim()} ${(userProfile?.last_name || '').trim()}`.trim();
  const firebaseName = (currentUser?.displayName || '').trim();
  const emailFallback = currentUser?.email || 'Anon';
  const displayName = backendFullName || backendFirstLast || firebaseName || emailFallback;

  const [groups, setGroups] = useState(groupSeed);
  const [selectedGroupId, setSelectedGroupId] = useState(groupSeed.find((g) => g.joined)?.id || groupSeed[0].id);
  const [threads, setThreads] = useState(threadSeed);
  const [messageForm, setMessageForm] = useState({ text: '', tag: 'Strategy' });
  const [challenges, setChallenges] = useState(challengeSeed);
  const [referrals, setReferrals] = useState(referralSeed);
  const [referralForm, setReferralForm] = useState({ title: '', company: '', location: '', type: 'Referral share' });
  const [sessions, setSessions] = useState(coachingSeed);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [privacy, setPrivacy] = useState({
    showIdentity: false,
  });
  const [appliedAt, setAppliedAt] = useState(null);

  // Load persisted privacy choices on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PRIVACY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setPrivacy((prev) => ({ ...prev, ...parsed }));
      }
    } catch (e) {}
  }, []);

  // Load persisted threads on mount
  useEffect(() => {
    try {
      const savedThreads = localStorage.getItem(THREAD_STORAGE_KEY);
      if (savedThreads) {
        const parsed = JSON.parse(savedThreads);
        if (Array.isArray(parsed)) {
          setThreads(parsed);
        }
      }
    } catch (e) {}
  }, []);

  const joinedGroups = useMemo(() => groups.filter((g) => g.joined), [groups]);
  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) || joinedGroups[0] || groups[0],
    [groups, selectedGroupId, joinedGroups]
  );

  const myPosts = useMemo(() => threads.filter((t) => t.isMine).length, [threads]);
  const myReferrals = useMemo(() => referrals.filter((r) => r.mine).length, [referrals]);
  const activeChallenges = useMemo(() => challenges.filter((c) => c.status !== 'planning'), [challenges]);
  const completedChallenges = useMemo(() => challenges.filter((c) => c.status === 'complete').length, [challenges]);

  const impactScore = useMemo(() => {
    const groupWeight = joinedGroups.length * 10;
    const contributionWeight = myPosts * 6;
    const referralWeight = myReferrals * 8;
    const coachingWeight = sessions.filter((s) => s.registered).length * 5;
    const challengeWeight = activeChallenges.reduce((acc, c) => acc + c.progress / 5, 0);
    return score(groupWeight + contributionWeight + referralWeight + coachingWeight + challengeWeight);
  }, [joinedGroups, myPosts, myReferrals, sessions, activeChallenges]);

  const accountabilityScore = useMemo(() => {
    const cadenceWeight = activeChallenges.length * 10;
    const progressWeight = activeChallenges.reduce((acc, c) => acc + c.progress, 0) / Math.max(activeChallenges.length || 1, 1);
    return score((cadenceWeight + progressWeight) / 2);
  }, [activeChallenges]);

  const handleJoinGroup = (groupId) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const joined = !g.joined;
        return { ...g, joined };
      })
    );
    setSelectedGroupId(groupId);
  };

  const handlePost = (e) => {
    e.preventDefault();
    if (!messageForm.text.trim()) return;
    const anonymous = !privacy.showIdentity;
    const newThread = {
      id: Date.now(),
      groupId: selectedGroup.id,
      title: `${messageForm.tag} insight`,
      body: messageForm.text.trim(),
      tag: messageForm.tag,
      author: anonymous ? 'Anon' : displayName,
      timeAgo: 'Just now',
      replies: 0,
      helpful: 0,
      anonymous,
      isMine: true,
    };
    setThreads((prev) => {
      const next = [newThread, ...prev];
      try {
        localStorage.setItem(THREAD_STORAGE_KEY, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    setMessageForm((prev) => ({ ...prev, text: '' }));
  };

  const handleChallengeAdvance = (challengeId) => {
    setChallenges((prev) =>
      prev.map((c) => {
        if (c.id !== challengeId) return c;
        const nextCompleted = Math.min(c.target, c.completed + 1);
        const nextProgress = score((nextCompleted / c.target) * 100);
        const status = nextCompleted >= c.target ? 'complete' : 'in-progress';
        return { ...c, completed: nextCompleted, progress: nextProgress, status };
      })
    );
  };

  const handleReferralSubmit = (e) => {
    e.preventDefault();
    if (!referralForm.title.trim() || !referralForm.company.trim()) return;
    const next = {
      id: Date.now(),
      title: referralForm.title.trim(),
      company: referralForm.company.trim(),
      location: referralForm.location.trim() || 'Remote friendly',
      match: 'Peer shared',
      type: referralForm.type,
      status: 'open',
      mine: true,
    };
    setReferrals((prev) => [next, ...prev]);
    setReferralForm({ title: '', company: '', location: '', type: 'Referral share' });
  };

  const toggleSession = (sessionId) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, registered: !s.registered } : s))
    );
  };

  const togglePrivacy = (key) => {
    setPrivacy((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleApplyPrivacy = () => {
    try {
      localStorage.setItem(PRIVACY_STORAGE_KEY, JSON.stringify(privacy));
      setAppliedAt(Date.now());
    } catch (e) {}
    // Reload so any future actions use the latest privacy defaults
    setTimeout(() => window.location.reload(), 250);
  };

  const filteredThreads = useMemo(
    () => threads.filter((t) => t.groupId === selectedGroup.id),
    [threads, selectedGroup]
  );

  const filteredChallenges = useMemo(
    () => challenges.filter((c) => c.groupId === selectedGroup.id),
    [challenges, selectedGroup]
  );

  const filteredGroups = groups;

  return (
    <div className="peer-support-page">
      <div className="peer-hero">
        <div>
          <div className="peer-hero__eyebrow">Community beta · Safe sharing defaults</div>
          <h1>Peer Support Hub</h1>
          <p className="peer-hero__lede">
            Join curated job search crews, swap referral intel, and keep accountability high without sacrificing privacy.
          </p>
          <div className="peer-hero__stats">
            <div className="peer-stat">
              <span>Groups joined</span>
              <strong>{joinedGroups.length}</strong>
              <small>{groups.length} available</small>
            </div>
            <div className="peer-stat">
              <span>Contributions</span>
              <strong>{myPosts}</strong>
              <small>posts/shared playbooks</small>
            </div>
            <div className="peer-stat">
              <span>Support value</span>
              <div className="peer-meter">
                <div className="peer-meter__fill" style={{ width: `${impactScore}%` }} />
              </div>
              <small>{impactScore}% of weekly goal</small>
            </div>
          </div>
        </div>
        <div className="peer-hero__panel">
          <div className="peer-hero__panel-title">
            <Icon name="users" size="lg" /> Live pulse
          </div>
          <div className="peer-hero__panel-grid">
            <div>
              <div className="peer-pill">Accountability</div>
              <strong>{accountabilityScore}%</strong>
              <small>challenge health</small>
            </div>
            <div>
              <div className="peer-pill">Warm intros</div>
              <strong>{myReferrals + 3}</strong>
              <small>shared this month</small>
            </div>
            <div>
              <div className="peer-pill">Coaching</div>
              <strong>{sessions.filter((s) => s.registered).length}</strong>
              <small>sessions on deck</small>
            </div>
          </div>
        </div>
      </div>

      <div className="peer-grid">
        <section className="peer-card">
            <div className="peer-card__header">
              <div>
                <p className="peer-pill">Group matching</p>
              <h2>Join industry or role crews</h2>
              <p className="muted">Pick your lane and stay anonymous until you are ready.</p>
              </div>
            </div>
            <div className="peer-group-list">
              {filteredGroups.map((group) => (
                <button
                key={group.id}
                className={`peer-group ${group.joined ? 'peer-group--joined' : ''}`}
                onClick={() => handleJoinGroup(group.id)}
              >
                <div className="peer-group__meta">
                  <div className="peer-group__title">{group.name}</div>
                  <div className="peer-group__tags">
                    <span>{group.role}</span>
                    <span>{group.industry}</span>
                    <span>{group.privacy}</span>
                  </div>
                </div>
                <div className="peer-group__details">
                  <div>
                    <strong>{group.members}</strong>
                    <small>peers</small>
                  </div>
                  <div>
                    <strong>{group.cadence}</strong>
                    <small>accountability</small>
                  </div>
                  <div>
                    <strong>{group.focus}</strong>
                    <small>focus</small>
                  </div>
                </div>
                <span className="peer-group__cta">{group.joined ? 'Joined' : 'Join group'}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="peer-card">
          <div className="peer-card__header">
            <div>
              <p className="peer-pill">Discussions</p>
              <h2>Share insights with peers</h2>
              <p className="muted">Post anonymously or with your name. Threads stay in your selected crew.</p>
            </div>
            <div className="peer-card__chips">
              <span className="chip">Selected group: {selectedGroup?.name}</span>
              <span className="chip chip--ghost">{filteredThreads.length} live threads</span>
            </div>
          </div>
          <form className="peer-form" onSubmit={handlePost}>
            <label className="peer-label">Share an insight or question</label>
            <div className="muted" style={{ fontSize: 12 }}>
              Posting as: {!privacy.showIdentity ? 'Anon' : displayName}
            </div>
            <textarea
              value={messageForm.text}
              onChange={(e) => setMessageForm((prev) => ({ ...prev, text: e.target.value }))}
              placeholder="Share a win, a blocker, or a pattern your peers should know about..."
              rows={3}
            />
            <div className="peer-form__row">
              <select
                value={messageForm.tag}
                onChange={(e) => setMessageForm((prev) => ({ ...prev, tag: e.target.value }))}
              >
                <option>Strategy</option>
                <option>Accountability</option>
                <option>Opportunity</option>
                <option>Interview prep</option>
              </select>
              <button className="peer-button" type="submit">Share with group</button>
            </div>
          </form>
          <div className="peer-thread-list">
            {filteredThreads.map((thread) => (
              <article key={thread.id} className="peer-thread">
                <div className="peer-thread__tag">{thread.tag}</div>
                <div className="peer-thread__title">{thread.title}</div>
                <p className="peer-thread__body">{thread.body}</p>
                <div className="peer-thread__meta">
                  <span>{thread.author}</span>
                  <span>{thread.timeAgo}</span>
                  <span>Replies {thread.replies}</span>
                  <span>Helpful {thread.helpful}</span>
                  {thread.anonymous && <span className="chip chip--ghost">anonymous</span>}
                  {thread.isMine && <span className="chip chip--accent">you</span>}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="peer-card">
          <div className="peer-card__header">
            <div>
              <p className="peer-pill">Challenges</p>
              <h2>Group challenges & accountability</h2>
              <p className="muted">Join micro-sprints, log progress, and see momentum in your cohort.</p>
            </div>
            <span className="chip">{completedChallenges} completed</span>
          </div>
          <div className="peer-challenge-list">
            {filteredChallenges.map((challenge) => (
              <div key={challenge.id} className="peer-challenge">
                <div>
                  <div className="peer-challenge__title">{challenge.title}</div>
                  <p className="peer-challenge__body">{challenge.description}</p>
                  <div className="peer-challenge__meta">
                    <span>{challenge.cadence}</span>
                    <span>{challenge.completed}/{challenge.target} done</span>
                  </div>
                  <div className="peer-meter">
                    <div className="peer-meter__fill" style={{ width: `${challenge.progress}%` }} />
                  </div>
                </div>
                <button className="peer-button peer-button--ghost" type="button" onClick={() => handleChallengeAdvance(challenge.id)}>
                  {challenge.status === 'complete' ? 'Logged' : 'Log progress'}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="peer-card">
          <div className="peer-card__header">
            <div>
              <p className="peer-pill">Success stories</p>
              <h2>Learn from peers</h2>
              <p className="muted">Borrow what worked and remix it for your search.</p>
            </div>
          </div>
          <div className="peer-stories">
            {storiesSeed.map((story) => (
              <div key={story.id} className="peer-story">
                <div className="peer-story__name">{story.name}</div>
                <div className="peer-story__outcome">{story.outcome}</div>
                <div className="peer-story__tactic">{story.tactic}</div>
                <p>{story.takeaway}</p>
                <div className="chip chip--accent">Peer win</div>
              </div>
            ))}
          </div>
        </section>

        <section className="peer-card">
          <div className="peer-card__header">
            <div>
              <p className="peer-pill">Opportunities</p>
              <h2>Peer referrals & alerts</h2>
              <p className="muted">Share warm intros, track who you’ve helped, and opt into alerts.</p>
            </div>
            <label className="peer-toggle">
              <input type="checkbox" checked={alertsEnabled} onChange={() => setAlertsEnabled((v) => !v)} />
              Opportunity alerts
            </label>
          </div>
          <form className="peer-form peer-form--inline" onSubmit={handleReferralSubmit}>
            <input
              placeholder="Role or title"
              value={referralForm.title}
              onChange={(e) => setReferralForm((prev) => ({ ...prev, title: e.target.value }))}
            />
            <input
              placeholder="Company"
              value={referralForm.company}
              onChange={(e) => setReferralForm((prev) => ({ ...prev, company: e.target.value }))}
            />
            <input
              placeholder="Location / Remote"
              value={referralForm.location}
              onChange={(e) => setReferralForm((prev) => ({ ...prev, location: e.target.value }))}
            />
            <select
              value={referralForm.type}
              onChange={(e) => setReferralForm((prev) => ({ ...prev, type: e.target.value }))}
            >
              <option>Referral share</option>
              <option>Peer alert</option>
              <option>Intro offer</option>
            </select>
            <button className="peer-button" type="submit">Share</button>
          </form>
          <div className="peer-referrals">
            {referrals.map((referral) => (
              <div key={referral.id} className="peer-referral">
                <div>
                  <div className="peer-referral__title">{referral.title}</div>
                  <div className="peer-referral__meta">
                    <span>{referral.company}</span>
                    <span>{referral.location}</span>
                    <span>{referral.type}</span>
                  </div>
                </div>
                <div className="peer-referral__status">{referral.match}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="peer-card">
          <div className="peer-card__header">
            <div>
              <p className="peer-pill">Coaching</p>
              <h2>Group coaching & webinars</h2>
              <p className="muted">Reserve a seat to get live feedback with your cohort.</p>
            </div>
          </div>
          <div className="peer-sessions">
            {sessions.map((session) => (
              <div key={session.id} className="peer-session">
                <div>
                  <div className="peer-session__title">{session.title}</div>
                  <div className="peer-session__meta">
                    <span>{session.date}</span>
                    <span>{session.facilitator}</span>
                    <span>{session.format}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className={`peer-button ${session.registered ? 'peer-button--ghost' : ''}`}
                  onClick={() => toggleSession(session.id)}
                >
                  {session.registered ? 'Registered' : 'Save seat'}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="peer-card">
          <div className="peer-card__header">
            <div>
              <p className="peer-pill">Impact</p>
              <h2>Track networking impact</h2>
              <p className="muted">See how peer activity moves your search forward.</p>
            </div>
          </div>
          <div className="peer-impact">
            <div className="peer-impact__row">
              <div>
                <div className="peer-impact__label">Warm intros from peers</div>
                <div className="peer-meter">
                  <div className="peer-meter__fill" style={{ width: `${score((myReferrals + 2) * 12)}%` }} />
                </div>
                <small>{myReferrals + 2} this month</small>
              </div>
              <div>
                <div className="peer-impact__label">Interview callbacks powered by peers</div>
                <div className="peer-meter">
                  <div className="peer-meter__fill" style={{ width: `${score((myPosts + joinedGroups.length) * 8)}%` }} />
                </div>
                <small>{joinedGroups.length} groups contributing</small>
              </div>
            </div>
            <div className="peer-impact__row">
              <div>
                <div className="peer-impact__label">Accountability streak</div>
                <div className="peer-meter">
                  <div className="peer-meter__fill" style={{ width: `${accountabilityScore}%` }} />
                </div>
                <small>{activeChallenges.length} active challenges</small>
              </div>
              <div>
                <div className="peer-impact__label">Support value</div>
                <div className="peer-meter">
                  <div className="peer-meter__fill" style={{ width: `${impactScore}%` }} />
                </div>
                <small>{impactScore}% of weekly target</small>
              </div>
            </div>
          </div>
        </section>

        <section className="peer-card">
          <div className="peer-card__header">
            <div>
              <p className="peer-pill">Privacy</p>
              <h2>Privacy controls</h2>
              <p className="muted">Choose whether your name shows up in group posts.</p>
            </div>
          </div>
          <div className="peer-privacy">
            <label className="peer-toggle">
              <input type="checkbox" checked={privacy.showIdentity} onChange={() => togglePrivacy('showIdentity')} />
              Show my name in groups
            </label>
            <div className="peer-privacy__hint">
              Identity only shows when this is on. Otherwise, posts display as Anon.
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="peer-button" onClick={handleApplyPrivacy}>
                Apply privacy settings
              </button>
              {appliedAt && <span className="muted" style={{ fontSize: 12 }}>Applied. Reloading to enforce...</span>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default PeerSupportHub;
