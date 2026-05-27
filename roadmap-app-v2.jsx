// Main roadmap app — v3 (strict hierarchical tree)

const { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } = React;

const STORAGE_KEY = 'ml_roadmap_state_v4';

// Pre-compute animation levels — nodes grouped by Y, sorted bottom-first
const ANIM_LEVELS = (() => {
  const byY = {};
  NODES.forEach(n => {
    const key = Math.round(n.y);
    (byY[key] = byY[key] || []).push(n.id);
  });
  return Object.keys(byY)
    .map(Number)
    .sort((a, b) => b - a)
    .map(y => ({ y, ids: new Set(byY[Math.round(y)]) }));
})();

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "showLabels": true,
  "edgeStyle": "curved",
  "autoScroll": true
}/*EDITMODE-END*/;

/* ──────────────────────────────────────────────────────────────────────── */
/* Edge path helpers                                                        */
/* ──────────────────────────────────────────────────────────────────────── */

// Node bounding-box half-sizes (used for edge-obstacle avoidance)
const NODE_HALF = {
  topic:  { hw: 18, hh: 18 },
  sub:    { hw: 68, hh: 28 },
  domain: { hw: 88, hh: 34 },
  root:   { hw: 110, hh: 40 },
};
const EDGE_PAD = 12; // extra clearance around node bbox

// Check if a point (px,py) is inside a node's padded bounding box
function insideBBox(px, py, node) {
  const s = NODE_HALF[node.tier] || NODE_HALF.topic;
  const hw = s.hw + EDGE_PAD, hh = s.hh + EDGE_PAD;
  return Math.abs(px - node.x) < hw && Math.abs(py - node.y) < hh;
}

// Sample a cubic bezier at parameter t
function bezierPt(x0, y0, cx1, cy1, cx2, cy2, x1, y1, t) {
  const u = 1 - t;
  return {
    x: u*u*u*x0 + 3*u*u*t*cx1 + 3*u*t*t*cx2 + t*t*t*x1,
    y: u*u*u*y0 + 3*u*u*t*cy1 + 3*u*t*t*cy2 + t*t*t*y1,
  };
}

// Find nodes (other than endpoints) that the simple S-curve would cross
function findObstacles(a, b, allNodes) {
  const top  = Math.min(a.y, b.y);
  const bot  = Math.max(a.y, b.y);
  // Collect candidate nodes in the Y range
  const candidates = [];
  for (const n of allNodes) {
    if (n.id === a.id || n.id === b.id) continue;
    const s = NODE_HALF[n.tier] || NODE_HALF.topic;
    if (n.y + s.hh + EDGE_PAD < top || n.y - s.hh - EDGE_PAD > bot) continue;
    candidates.push(n);
  }
  if (!candidates.length) return [];
  // Sample the default bezier and check for collisions
  const dy = b.y - a.y;
  const c1y = a.y + dy * 0.45, c2y = a.y + dy * 0.55;
  const hit = new Set();
  for (let i = 1; i < 40; i++) {
    const p = bezierPt(a.x, a.y, a.x, c1y, b.x, c2y, b.x, b.y, i / 40);
    for (const n of candidates) {
      if (!hit.has(n.id) && insideBBox(p.x, p.y, n)) hit.add(n.id);
    }
  }
  return candidates.filter(n => hit.has(n.id));
}

// Build an edge path that avoids intermediate nodes.
// Strategy: if the default S-curve crosses a node, add waypoints that
// route the edge around the obstacle (left or right, whichever is shorter).
function smartEdgePath(a, b, allNodes) {
  const obstacles = findObstacles(a, b, allNodes);
  if (!obstacles.length) {
    // No obstacles — use default S-curve
    const dy = b.y - a.y;
    return `M ${a.x} ${a.y} C ${a.x} ${a.y + dy * 0.45}, ${b.x} ${a.y + dy * 0.55}, ${b.x} ${b.y}`;
  }

  // Sort obstacles by Y (ascending if b.y > a.y, descending otherwise)
  const dir = b.y > a.y ? 1 : -1;
  obstacles.sort((u, v) => dir * (u.y - v.y));

  // Build waypoints: start → around each obstacle → end
  const pts = [{ x: a.x, y: a.y }];
  for (const obs of obstacles) {
    const s = NODE_HALF[obs.tier] || NODE_HALF.topic;
    const clearX = s.hw + EDGE_PAD;
    // Go left or right of obstacle — pick the side closer to the midpoint of a→b X
    const midX = (a.x + b.x) / 2;
    const goLeft = obs.x >= midX;
    const wpX = goLeft ? obs.x - clearX : obs.x + clearX;
    pts.push({ x: wpX, y: obs.y });
  }
  pts.push({ x: b.x, y: b.y });

  // Build smooth path through waypoints using vertical-tangent cubic segments
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], q = pts[i];
    const dy = q.y - p.y;
    d += ` C ${p.x} ${p.y + dy * 0.45}, ${q.x} ${p.y + dy * 0.55}, ${q.x} ${q.y}`;
  }
  return d;
}

function straightEdgePath(a, b) {
  return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Glyphs                                                                   */
/* ──────────────────────────────────────────────────────────────────────── */

const LockIcon = ({ size = 12 }) => (
  <svg className="lock-icon" width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="5" y="11" width="14" height="10" rx="2.5"
          fill="currentColor" opacity="0.7"/>
    <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
  </svg>
);

const CheckIcon = ({ size = 14, color = '#07210e' }) => (
  <svg className="check-mark" width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M5 12l5 5L20 7" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ResetIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M3 12a9 9 0 1 0 3-6.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M3 4v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CompassIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
    <path d="M15 9l-2 5-5 2 2-5 5-2z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
  </svg>
);

const Star = ({ filled, glow, size = 11 }) => (
  <svg className="star-svg" width={size} height={size} viewBox="0 0 24 24">
    <path d="M12 2.5 L14.6 9 L21.6 9.6 L16.3 14.2 L17.9 21.1 L12 17.4 L6.1 21.1 L7.7 14.2 L2.4 9.6 L9.4 9 Z"
      fill={filled ? (glow ? '#FFD60A' : 'rgba(255,255,255,0.75)') : 'rgba(255,255,255,0.15)'}
      stroke={glow ? '#FFD60A' : (filled ? '#fff' : 'rgba(255,255,255,0.6)')}
      strokeWidth="2"
      strokeLinejoin="round"/>
  </svg>
);

const StarsRow = ({ difficulty, glow, size = 11 }) => (
  <div className="stars-row">
    {[1,2,3,4,5].map(i => (
      <Star key={i} filled={i <= difficulty} glow={glow && i <= difficulty} size={size} />
    ))}
  </div>
);

/* ──────────────────────────────────────────────────────────────────────── */
/* Quiz components                                                          */
/* ──────────────────────────────────────────────────────────────────────── */

const PAIR_COLORS = ['#5AC8FA','#BF5AF2','#FF9F0A','#30D158'];

function QuizMCQ({ question, selected, onSelect }) {
  return (
    <div className="quiz-options">
      {question.options.map((opt, i) => (
        <button key={i}
          className={'quiz-option' + (selected === i ? ' selected' : '')}
          onClick={() => onSelect(i)}>
          <span className="quiz-option-key">{String.fromCharCode(65 + i)}</span>
          {opt}
        </button>
      ))}
    </div>
  );
}

function QuizTextInput({ value, onChange }) {
  return (
    <input className="quiz-input"
      type="text" placeholder="Type your answer..."
      value={value} onChange={e => onChange(e.target.value)}
      autoFocus />
  );
}

function QuizMatching({ question, pairs, selectedLeft, onClickLeft, onClickRight }) {
  const pairedRight = new Set(Object.values(pairs));
  return (
    <div>
      <div className="quiz-match-hint">Click a left item, then click its match on the right.</div>
      <div className="quiz-match-cols">
        <div className="quiz-match-col">
          {question.left.map((item, i) => {
            const isPaired = pairs[i] !== undefined;
            const isActive = selectedLeft === i;
            const colorIdx = isPaired ? Object.keys(pairs).sort().indexOf(String(i)) : -1;
            return (
              <button key={i}
                className={'quiz-match-item' + (isActive ? ' active' : '') + (isPaired ? ' paired' : '')}
                style={isPaired ? { borderColor: PAIR_COLORS[colorIdx % 4] } : {}}
                onClick={() => onClickLeft(i)}>
                {isPaired && <span className="quiz-pair-dot" style={{ background: PAIR_COLORS[colorIdx % 4] }} />}
                {item}
              </button>
            );
          })}
        </div>
        <div className="quiz-match-col">
          {question.right.map((item, i) => {
            const isPaired = pairedRight.has(i);
            const leftForThis = Object.entries(pairs).find(([_, r]) => r === i);
            const colorIdx = leftForThis ? Object.keys(pairs).sort().indexOf(leftForThis[0]) : -1;
            return (
              <button key={i}
                className={'quiz-match-item' + (isPaired ? ' paired' : '')}
                style={isPaired ? { borderColor: PAIR_COLORS[colorIdx % 4] } : {}}
                onClick={() => onClickRight(i)}>
                {isPaired && <span className="quiz-pair-dot" style={{ background: PAIR_COLORS[colorIdx % 4] }} />}
                {item}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function gradeAnswer(q, answer) {
  if (q.type === 'mcq') return answer === q.correct;
  if (q.type === 'text') return q.accept.some(a => a.toLowerCase() === String(answer).trim().toLowerCase());
  if (q.type === 'matching') {
    if (!answer || typeof answer !== 'object') return false;
    return Object.entries(q.correct).every(([l, r]) => answer[l] === r);
  }
  return false;
}

function QuizOverlay({ questions, passThreshold, accentColor, onPass, onClose }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState(() => questions.map(() => null));
  const [matchStates, setMatchStates] = useState(() =>
    questions.map(q => q.type === 'matching' ? { pairs: {}, selectedLeft: null } : null)
  );
  const [phase, setPhase] = useState('active'); // 'active' | 'results'

  const q = questions[idx];
  const total = questions.length;
  const ans = answers[idx];

  // Keyboard: Escape to close, Enter to advance
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const setAnswer = (val) => {
    const next = [...answers];
    next[idx] = val;
    setAnswers(next);
  };

  const canAdvance = (() => {
    if (q.type === 'mcq') return ans !== null;
    if (q.type === 'text') return ans && ans.trim().length > 0;
    if (q.type === 'matching') {
      const ms = matchStates[idx];
      return ms && Object.keys(ms.pairs).length === q.left.length;
    }
    return false;
  })();

  const handleNext = () => {
    if (!canAdvance) return;
    // For matching, save pairs as the answer
    if (q.type === 'matching') {
      const next = [...answers];
      next[idx] = matchStates[idx].pairs;
      setAnswers(next);
    }
    if (idx < total - 1) {
      setIdx(idx + 1);
    } else {
      setPhase('results');
    }
  };

  const handleMatchLeft = (i) => {
    const ms = { ...matchStates[idx] };
    if (ms.pairs[i] !== undefined) {
      // Unpair
      const next = { ...ms.pairs };
      delete next[i];
      ms.pairs = next;
      ms.selectedLeft = null;
    } else {
      ms.selectedLeft = i;
    }
    const nextStates = [...matchStates];
    nextStates[idx] = ms;
    setMatchStates(nextStates);
  };

  const handleMatchRight = (i) => {
    const ms = matchStates[idx];
    if (ms.selectedLeft === null) return;
    // Check if this right item is already paired
    const existingLeft = Object.entries(ms.pairs).find(([_, r]) => r === i);
    const nextPairs = { ...ms.pairs };
    if (existingLeft) delete nextPairs[existingLeft[0]];
    nextPairs[ms.selectedLeft] = i;
    const nextStates = [...matchStates];
    nextStates[idx] = { pairs: nextPairs, selectedLeft: null };
    setMatchStates(nextStates);
  };

  const handleRetry = () => {
    setIdx(0);
    setAnswers(questions.map(() => null));
    setMatchStates(questions.map(q => q.type === 'matching' ? { pairs: {}, selectedLeft: null } : null));
    setPhase('active');
  };

  if (phase === 'results') {
    // Finalize matching answers
    const finalAnswers = questions.map((q, i) => {
      if (q.type === 'matching' && matchStates[i]) return matchStates[i].pairs;
      return answers[i];
    });
    const correct = questions.filter((q, i) => gradeAnswer(q, finalAnswers[i])).length;
    const passed = correct / total >= passThreshold;
    return (
      <div className="quiz-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className={'quiz-card quiz-results ' + (passed ? 'quiz-pass' : 'quiz-fail')}>
          <div className="quiz-score-label">Your Score</div>
          <div className="quiz-score">{correct}<span className="quiz-score-total">/{total}</span></div>
          <div className="quiz-result-msg">
            {passed
              ? 'You passed! Knowledge verified.'
              : `You need ${Math.ceil(total * passThreshold)} correct answers to pass. Try again.`}
          </div>
          <div className="quiz-breakdown">
            {questions.map((q, i) => {
              const ok = gradeAnswer(q, finalAnswers[i]);
              return (
                <div key={q.id} className={'quiz-bk-row' + (ok ? ' correct' : ' wrong')}>
                  <span className="quiz-bk-num">{i + 1}</span>
                  <span className="quiz-bk-topic">{q.topic}</span>
                  <span className="quiz-bk-icon">{ok ? '✓' : '✗'}</span>
                </div>
              );
            })}
          </div>
          {passed ? (
            <button className="quiz-cta pass" onClick={onPass}>Claim Stars</button>
          ) : (
            <button className="quiz-cta retry" onClick={handleRetry}>Try Again</button>
          )}
          <button className="quiz-close" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="quiz-card">
        <div className="quiz-header">
          <span className="quiz-topic-badge" style={{ borderColor: accentColor, color: accentColor, background: accentColor + '14' }}>
            {q.topic}
          </span>
          <span className="quiz-counter">{idx + 1} / {total}</span>
        </div>
        <div className="quiz-progress">
          <div className="quiz-progress-fill" style={{ width: ((idx + 1) / total * 100) + '%', background: accentColor }} />
        </div>
        <div className="quiz-question">{q.question}</div>
        {q.type === 'mcq' && (
          <QuizMCQ question={q} selected={ans} onSelect={setAnswer} />
        )}
        {q.type === 'text' && (
          <QuizTextInput value={ans || ''} onChange={setAnswer} />
        )}
        {q.type === 'matching' && matchStates[idx] && (
          <QuizMatching question={q}
            pairs={matchStates[idx].pairs}
            selectedLeft={matchStates[idx].selectedLeft}
            onClickLeft={handleMatchLeft}
            onClickRight={handleMatchRight} />
        )}
        <div className="quiz-nav">
          <button className={'quiz-next' + (canAdvance ? '' : ' disabled')}
            disabled={!canAdvance}
            onClick={handleNext}
            style={canAdvance ? { background: accentColor } : {}}>
            {idx < total - 1 ? 'Next' : 'Finish'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Persistence                                                              */
/* ──────────────────────────────────────────────────────────────────────── */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                  */
/* ──────────────────────────────────────────────────────────────────────── */

function hexA(hex, a) {
  if (!hex || !hex.startsWith('#')) return hex;
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function breadcrumbFor(node) {
  if (node.type === 'root') return node.label;
  const dom = DOMAIN_BY_ID[node.domain];
  if (node.type === 'gate' && node.tier === 'domain') {
    return `${dom.label} · ${node.kind === 'intro' ? 'Intro' : 'Test'}`;
  }
  if (node.type === 'gate' && node.tier === 'sub') {
    const sub = SUB_BY_ID[node.sub];
    return `${dom.label} › ${sub.label} · ${node.kind === 'intro' ? 'Intro' : 'Test'}`;
  }
  if (node.type === 'topic') {
    const sub = SUB_BY_ID[node.sub];
    return `${dom.label} › ${sub.label}`;
  }
  return node.label;
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Render: individual node                                                  */
/* ──────────────────────────────────────────────────────────────────────── */

function NodeView({ node, isDone, isCur, isUnlk, isAvail, isStarLocked, onClick, showLabels, distance, animClass }) {
  let cls = `node tier-${node.tier}`;
  if (node.type === 'gate') cls += ` gate-${node.kind}`;
  if (isDone) cls += ' completed';
  if (isCur)  cls += ' current';
  if (isAvail) cls += ' available';
  if (!isUnlk) cls += ' locked';
  if (isStarLocked) cls += ' star-locked';
  if (isUnlk) cls += ' clickable';
  if (animClass) cls += ' ' + animClass;

  const style = {
    left: node.x,
    top: node.y,
    '--c': node.color,
    '--c-soft': hexA(node.color, 0.22),
  };

  // Locked nodes: dim the outline based on graph distance from the current node.
  // Closer locked nodes hint at the next step; far ones fade into the background.
  if (!isUnlk && !isStarLocked) {
    const d = distance ?? 99;
    const alpha = Math.max(0.035, 0.55 / (d + 0.6));
    style['--c'] = hexA(node.color, alpha);
  }

  if (node.type === 'topic') {
    return (
      <div className={cls} style={style} onClick={onClick}
           title={isUnlk ? node.label : 'Locked — pass the introduction first'}>
        <div className="shape">
          {isDone ? <CheckIcon size={14} color="#07210e" /> : (!isUnlk ? <LockIcon size={11} /> : null)}
        </div>
        {showLabels && <div className="node-label">{node.label}</div>}
      </div>
    );
  }

  // Gate or root
  const titleText = node.label;
  const subText   = (node.type === 'root')
    ? (node.tagline || '')
    : (node.kind === 'intro' ? 'Intro' : 'Test');

  const isTestGate = node.type === 'gate' && node.kind === 'test';
  const starSize = node.tier === 'domain' ? 13 : 10;

  return (
    <div className={cls} style={style} onClick={onClick}
         title={isUnlk ? `${node.label} ${subText}` : 'Locked'}>
      <div className="shape">
        <div className="gate-title">{titleText}</div>
        {subText && <div className="gate-sub">{subText}</div>}
      </div>
      {isTestGate && !isStarLocked && (
        <StarsRow difficulty={node.difficulty} glow={isDone} size={starSize} />
      )}
      {isTestGate && isStarLocked && (
        <div className="star-gate-badge">
          ★ Need {node.starThreshold}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* App                                                                      */
/* ──────────────────────────────────────────────────────────────────────── */

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const initial = useMemo(() => {
    const saved = loadState();
    if (saved && saved.completed && saved.current && NODE_BY_ID[saved.current]) {
      return saved;
    }
    return { completed: [START_ID], current: START_ID };
  }, []);

  const [completed, setCompleted] = useState(() => new Set(initial.completed.filter(id => NODE_BY_ID[id])));
  const [current,   setCurrent]   = useState(initial.current);
  const [victory,   setVictory]   = useState(false);
  const [quizOpen,  setQuizOpen]  = useState(false);
  const [animPhase, setAnimPhase] = useState(null);
  const [animLevel, setAnimLevel] = useState(-1);
  const [zoom, setZoom] = useState(1);

  const viewportRef = useRef(null);
  const initialScrolled = useRef(false);

  useEffect(() => {
    saveState({ completed: [...completed], current });
  }, [completed, current]);

  const reachable = useMemo(() => {
    const u = new Set([START_ID]);
    for (const id of completed) {
      u.add(id);
      for (const nb of ADJ[id] || []) u.add(nb);
    }
    return u;
  }, [completed]);

  // Total stars earned from completed test gates
  const earnedStars = useMemo(() => {
    let total = 0;
    for (const id of completed) {
      const n = NODE_BY_ID[id];
      if (n && n.difficulty) total += n.difficulty;
    }
    return total;
  }, [completed]);

  const maxStars = useMemo(() => {
    let m = 0;
    for (const n of NODES) if (n.difficulty) m += n.difficulty;
    return m;
  }, []);

  const isStarGated = useCallback((n) => {
    return n.tier === 'domain' && n.kind === 'test' &&
           (n.starThreshold || 0) > earnedStars;
  }, [earnedStars]);

  // Next domain test you cannot yet attempt (smallest gap)
  const nextThreshold = useMemo(() => {
    let best = null;
    for (const n of NODES) {
      if (n.tier !== 'domain' || n.kind !== 'test') continue;
      if (completed.has(n.id)) continue;
      if (n.starThreshold > earnedStars) {
        if (!best || n.starThreshold < best.threshold) {
          best = { label: n.label, threshold: n.starThreshold, need: n.starThreshold - earnedStars };
        }
      }
    }
    return best;
  }, [completed, earnedStars]);

  // BFS distance from the current node to every other node (for fading locked outlines).
  const distances = useMemo(() => {
    const dist = { [current]: 0 };
    const queue = [current];
    while (queue.length) {
      const id = queue.shift();
      const d = dist[id];
      for (const nb of ADJ[id] || []) {
        if (dist[nb] === undefined) {
          dist[nb] = d + 1;
          queue.push(nb);
        }
      }
    }
    return dist;
  }, [current]);

  // Animation: set of revealed node IDs
  const revealedNodes = useMemo(() => {
    if (animPhase !== 'building' || animLevel < 0) return null;
    const set = new Set();
    for (let i = 0; i <= animLevel && i < ANIM_LEVELS.length; i++) {
      ANIM_LEVELS[i].ids.forEach(id => set.add(id));
    }
    return set;
  }, [animPhase, animLevel]);

  const currentNode  = NODE_BY_ID[current];
  const currentColor = currentNode.color;
  const isCurDone    = completed.has(current);
  const isCurReach   = reachable.has(current);
  const isCurStarGated = isStarGated(currentNode);
  const canCompleteCur = isCurReach && !isCurStarGated && !isCurDone;

  const handleNodeClick = useCallback((nodeId) => {
    if (animPhase) return;
    if (!reachable.has(nodeId)) return;
    setCurrent(nodeId);
  }, [reachable, animPhase]);

  const handleComplete = useCallback(() => {
    if (!canCompleteCur) return;
    const next = new Set(completed);
    next.add(current);
    setCompleted(next);
    if (next.size === NODES.length) {
      setTimeout(() => setVictory(true), 700);
    }
  }, [completed, current, canCompleteCur]);

  const handleReset = useCallback(() => {
    if (!window.confirm('Reset all progress?')) return;
    setCompleted(new Set([START_ID]));
    setCurrent(START_ID);
    setVictory(false);
  }, []);

  /* Auto-scroll viewport to a node */
  const scrollToNode = useCallback((nodeId, smooth = true) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const node = NODE_BY_ID[nodeId];
    if (!node) return;
    const z = zoom;
    const mapLeftOffset = (vp.clientWidth - LAYOUT.CANVAS_W * z) / 2;
    const targetX = node.x * z + Math.max(0, mapLeftOffset) - vp.clientWidth / 2;
    const targetY = node.y * z - vp.clientHeight / 2;
    vp.scrollTo({
      left: Math.max(0, Math.min(targetX, vp.scrollWidth  - vp.clientWidth)),
      top:  Math.max(0, Math.min(targetY, vp.scrollHeight - vp.clientHeight)),
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, [zoom]);

  useLayoutEffect(() => {
    if (initialScrolled.current) return;
    initialScrolled.current = true;
    scrollToNode(current, false);
  }, []);

  const prevCurrentRef = useRef(current);
  useEffect(() => {
    if (prevCurrentRef.current !== current && t.autoScroll) {
      scrollToNode(current, true);
    }
    prevCurrentRef.current = current;
  }, [current, t.autoScroll, scrollToNode]);

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || quizOpen) return;
      if ((e.key === 'r' || e.key === 'R' || e.code === 'KeyR') && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        handleReset();
        return;
      }
      if ((e.key === 'r' || e.key === 'R' || e.code === 'KeyR') && !animPhase) {
        setAnimPhase('building'); setAnimLevel(-1);
        return;
      }
      if (animPhase) return;
      if ((e.key === 't' || e.key === 'T' || e.code === 'KeyT') && e.ctrlKey) {
        e.preventDefault();
        if (canCompleteCur) handleComplete();
        return;
      }
      if ((e.key === ' ' || e.key === 'Enter') && canCompleteCur) {
        e.preventDefault();
        handleComplete();
      }
      if (e.key === 'g' || e.key === 'G' || e.code === 'KeyG') scrollToNode(GOAL_ID, true);
      if (e.key === 's' || e.key === 'S' || e.code === 'KeyS') scrollToNode(START_ID, true);
      if (e.key === 'h' || e.key === 'H' || e.code === 'KeyH') scrollToNode(current, true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleComplete, canCompleteCur, scrollToNode, current, quizOpen, animPhase]);

  /* Build animation — toggle body class for global CSS hiding */
  useEffect(() => {
    if (animPhase) {
      document.body.classList.add('anim-active');
    } else {
      document.body.classList.remove('anim-active');
    }
    return () => document.body.classList.remove('anim-active');
  }, [animPhase]);

  /* Build animation — single continuous scroll, levels revealed as camera passes */
  const animFrameRef = useRef(null);
  useEffect(() => {
    if (animPhase !== 'building') return;
    const vp = viewportRef.current;
    if (!vp) return;

    // Scroll targets: center viewport on each level's Y (account for zoom)
    const z = zoom;
    const halfH = vp.clientHeight / 2;
    const maxScroll = vp.scrollHeight - vp.clientHeight;
    const targets = ANIM_LEVELS.map(l => Math.max(0, Math.min(maxScroll, l.y * z - halfH)));

    const startScroll = targets[0];
    const endScroll = targets[targets.length - 1];
    const totalDist = Math.abs(endScroll - startScroll);
    const SPEED = 0.45; // px per ms — constant
    const totalDuration = totalDist / SPEED;
    const INITIAL_DELAY = 500; // ms before scrolling starts

    // Jump to bottom (first level) immediately
    vp.scrollTop = startScroll;
    setAnimLevel(0);

    let t0 = null;
    let lastLevel = 0;

    const step = (now) => {
      if (!t0) t0 = now;
      const elapsed = now - t0;

      if (elapsed < INITIAL_DELAY) {
        animFrameRef.current = requestAnimationFrame(step);
        return;
      }

      const scrollElapsed = elapsed - INITIAL_DELAY;
      const p = Math.min(1, scrollElapsed / totalDuration);

      // Linear interpolation
      const scrollY = startScroll + (endScroll - startScroll) * p;
      vp.scrollTop = scrollY;

      // Reveal levels whose target scroll position we've passed
      for (let i = lastLevel + 1; i < targets.length; i++) {
        const levelTarget = targets[i];
        // Check if camera has reached close enough to this level
        const reached = startScroll < endScroll
          ? scrollY >= levelTarget - halfH * 0.3
          : scrollY <= levelTarget + halfH * 0.3;
        if (reached) {
          lastLevel = i;
          setAnimLevel(i);
        } else {
          break;
        }
      }

      if (p < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        // All done — reveal any remaining levels, then glide back to start
        setAnimLevel(ANIM_LEVELS.length - 1);
        setTimeout(() => {
          setAnimPhase('done');
          const startNode = NODE_BY_ID[START_ID];
          if (vp && startNode) {
            const targetY = Math.max(0, Math.min(startNode.y * z - halfH, maxScroll));
            const fromY = vp.scrollTop;
            const dist = Math.abs(targetY - fromY);
            const dur = Math.max(1500, Math.min(2000, dist / 0.35));
            const st0 = performance.now();
            const glide = (now) => {
              const gp = Math.min(1, (now - st0) / dur);
              // ease-out quad for gentle deceleration at the end
              const eased = 1 - (1 - gp) * (1 - gp);
              vp.scrollTop = fromY + (targetY - fromY) * eased;
              if (gp < 1) {
                requestAnimationFrame(glide);
              } else {
                setTimeout(() => setAnimPhase(null), 300);
              }
            };
            requestAnimationFrame(glide);
          } else {
            scrollToNode(START_ID, true);
            setTimeout(() => setAnimPhase(null), 800);
          }
        }, 600);
      }
    };

    animFrameRef.current = requestAnimationFrame(step);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [animPhase, scrollToNode, zoom]);

  /* Mouse drag panning */
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    let dragging = false; let sx = 0; let sy = 0; let sl = 0; let st = 0;
    const onDown = (e) => {
      if (e.target.closest('.node') || e.target.closest('.glass') ||
          e.target.closest('.sidepanel') || e.target.closest('.legend') ||
          e.target.closest('.map-controls') || e.target.closest('.twk-panel')) return;
      dragging = true; sx = e.clientX; sy = e.clientY; sl = vp.scrollLeft; st = vp.scrollTop;
      vp.style.cursor = 'grabbing';
    };
    const onMove = (e) => {
      if (!dragging) return;
      vp.scrollLeft = sl - (e.clientX - sx);
      vp.scrollTop  = st - (e.clientY - sy);
    };
    const onUp = () => { dragging = false; vp.style.cursor = ''; };
    vp.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      vp.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  /* Ctrl+wheel zoom */
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom(z => {
        const next = z - e.deltaY * 0.002;
        return Math.max(0.3, Math.min(1, Math.round(next * 20) / 20));
      });
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, []);

  const progress = completed.size;
  const total = NODES.length;
  const pct = (progress / total) * 100;

  /* Per-domain progress for legend */
  const domainProgress = useMemo(() => {
    const out = {};
    for (const dom of DOMAINS) {
      const ids = NODES.filter(n => n.domain === dom.id).map(n => n.id);
      const done = ids.filter(id => completed.has(id)).length;
      out[dom.id] = { done, total: ids.length };
    }
    return out;
  }, [completed]);

  return (
    <React.Fragment>
      {/* Scrollable map */}
      <div className="viewport" ref={viewportRef}>
        <div className="map" style={zoom < 1 ? { width: LAYOUT.CANVAS_W, height: LAYOUT.CANVAS_H, transform: `scale(${zoom})`, transformOrigin: 'top center', marginBottom: (zoom - 1) * LAYOUT.CANVAS_H } : { width: LAYOUT.CANVAS_W, height: LAYOUT.CANVAS_H }}>

          {/* Edges */}
          <svg
            className="edges-layer"
            viewBox={`0 0 ${LAYOUT.CANVAS_W} ${LAYOUT.CANVAS_H}`}
            preserveAspectRatio="none"
          >
            <defs>
              <filter id="edgeGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2.5" result="blur"/>
                <feMerge>
                  <feMergeNode in="blur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            {EDGES.map(([aId, bId, edgeKind]) => {
              const a = NODE_BY_ID[aId];
              const b = NODE_BY_ID[bId];
              if (!a || !b) return null;
              const edgeRevealed = !revealedNodes || (revealedNodes.has(aId) && revealedNodes.has(bId));
              const bothDone = completed.has(aId) && completed.has(bId);
              const oneUnlocked = reachable.has(aId) || reachable.has(bId);
              const path = t.edgeStyle === 'straight' ? straightEdgePath(a, b) : smartEdgePath(a, b, NODES);
              const stroke = bothDone
                ? '#30D158'
                : (oneUnlocked ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)');
              const width = bothDone ? 2.5 : 1.3;
              return (
                <g key={`${aId}-${bId}`} style={{ opacity: edgeRevealed ? 1 : 0, transition: 'opacity 0.6s ease' }}>
                  {bothDone && (
                    <path d={path} stroke="#30D158" strokeWidth="7"
                          fill="none" strokeLinecap="round" opacity="0.18"
                          filter="url(#edgeGlow)" />
                  )}
                  <path
                    d={path}
                    stroke={stroke}
                    strokeWidth={width}
                    fill="none"
                    strokeLinecap="round"
                    style={{ transition: 'stroke 0.5s ease, stroke-width 0.5s ease' }}
                  />
                </g>
              );
            })}
          </svg>

          {/* Nodes */}
          {NODES.map((n) => {
            const isDone        = completed.has(n.id);
            const isCur         = current === n.id;
            const isReach       = reachable.has(n.id);
            const isStarLocked  = isReach && isStarGated(n);
            const isAvail       = isReach && !isDone && !isCur && !isStarLocked;
            const animClass     = revealedNodes === null ? '' :
                                  revealedNodes.has(n.id) ? 'anim-revealed' : 'anim-hidden';
            return (
              <NodeView
                key={n.id}
                node={n}
                isDone={isDone}
                isCur={isCur}
                isUnlk={isReach}
                isAvail={isAvail}
                isStarLocked={isStarLocked}
                distance={distances[n.id]}
                onClick={() => handleNodeClick(n.id)}
                showLabels={t.showLabels}
                animClass={animClass}
              />
            );
          })}
        </div>
      </div>

      {/* Top bar */}
      <div className={`topbar${animPhase ? ' anim-hide' : ''}`}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'stretch', pointerEvents: 'auto' }}>
          <div className="progress-card exp glass">
            <div className="progress-meta">
              <div className="progress-label">Experience</div>
              <div className="progress-count">
                {earnedStars}<span> ★ / {maxStars}</span>
              </div>
              {nextThreshold && (
                <div className="exp-next">Next: <b>{nextThreshold.label}</b> in <b>{nextThreshold.need}★</b></div>
              )}
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${(earnedStars / maxStars) * 100}%` }} />
            </div>
          </div>
          <div className="topbar-actions">
          </div>
        </div>
      </div>

      {/* Side panel */}
      <div className={`sidepanel${animPhase ? ' anim-hide' : ''}`} style={{ '--sp-clr': currentColor }}>
        <div className="sp-cluster"><span className="dot" />{breadcrumbFor(currentNode)}</div>
        <div className="sp-title">{currentNode.label}{currentNode.type === 'gate' ? ` · ${currentNode.kind === 'intro' ? 'Intro' : 'Test'}` : ''}</div>
        {currentNode.hours && (
          <div className="sp-time">
            <span className="sp-time-num">{currentNode.hours}</span>
            <span className="sp-time-unit">hours</span>
          </div>
        )}
        <div className="sp-hint">{currentNode.hint}</div>
        {currentNode.type === 'topic' && (
          <button className="sp-resources" onClick={() => {}}>
            Free {currentNode.label} courses & guides
          </button>
        )}
        {currentNode.type === 'gate' && currentNode.kind === 'test' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--text-faint)', textTransform: 'uppercase', fontWeight: 600 }}>Reward</div>
            <StarsRow difficulty={currentNode.difficulty} glow={isCurDone} size={12} />
          </div>
        )}
        {isCurStarGated && (
          <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 12, background: 'rgba(255, 214, 10, 0.06)', border: '1px solid rgba(255, 214, 10, 0.3)', fontSize: 12, color: '#FFD60A', lineHeight: 1.45 }}>
            <b style={{fontWeight: 700}}>★ Locked by experience.</b> You have <b>{earnedStars}</b>, need <b>{currentNode.starThreshold}</b> stars. Master more sub-tests in this domain to unlock.
          </div>
        )}
        {(() => {
          const isTest = currentNode.type === 'gate' && currentNode.kind === 'test';
          const hasQuiz = isTest && QUIZ_DATA && QUIZ_DATA[current];
          if (isCurDone) {
            return <button className="sp-cta done" disabled>{isTest ? '✓ Passed' : '✓ Mastered'}</button>;
          }
          if (canCompleteCur) {
            if (hasQuiz) {
              return <button className="sp-cta" onClick={() => setQuizOpen(true)}>Take Test{currentNode.difficulty ? ` (+${currentNode.difficulty}★)` : ''}</button>;
            }
            if (isTest) {
              return <button className="sp-cta" onClick={handleComplete}>Take Test{currentNode.difficulty ? ` (+${currentNode.difficulty}★)` : ''}</button>;
            }
            return <button className="sp-cta" onClick={handleComplete}>Mark as Mastered</button>;
          }
          return <button className="sp-cta locked" disabled>{isCurStarGated ? 'Need more experience' : 'Locked'}</button>;
        })()}
        <div className="sp-foot">
          <span className="kbd">space</span>
          <span>to master · drag to pan the map</span>
        </div>
      </div>

      {/* Legend */}
      <div className={`legend${animPhase ? ' anim-hide' : ''}`}>
        <div className="legend-title">Domains</div>
        {DOMAINS.map(dom => {
          const dp = domainProgress[dom.id];
          return (
            <div key={dom.id} className="legend-row" style={{ '--legend-c': DOMAIN_COLORS[dom.id] }}>
              <span className="legend-swatch" />
              <span style={{ flex: 1 }}>{dom.label}</span>
              <span style={{ color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>
                {dp.done}/{dp.total}
              </span>
            </div>
          );
        })}
      </div>

      {/* Map controls */}
      <div className={`map-controls${animPhase ? ' anim-hide' : ''}`}>
        <button className="icon-btn" onClick={() => scrollToNode(GOAL_ID, true)} title="To goal (G)">
          ↑ To goal
        </button>
        <button className="icon-btn" onClick={() => scrollToNode(current, true)} title="To my position (H)">
          <CompassIcon /> I'm here
        </button>
        <button className="icon-btn" onClick={() => scrollToNode(START_ID, true)} title="To start (S)">
          ↓ To start
        </button>
        <div className="zoom-divider" />
        <button className="icon-btn" onClick={() => setZoom(z => Math.min(1, +(z + 0.1).toFixed(1)))} title="Zoom in" disabled={zoom >= 1}>
          +
        </button>
        <button className="icon-btn zoom-level" disabled>{Math.round(zoom * 100)}%</button>
        <button className="icon-btn" onClick={() => setZoom(z => Math.max(0.3, +(z - 0.1).toFixed(1)))} title="Zoom out" disabled={zoom <= 0.3}>
          −
        </button>
      </div>

      {/* Tweaks */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Display" />
        <TweakToggle label="Topic labels" value={t.showLabels}
                     onChange={(v) => setTweak('showLabels', v)} />
        <TweakRadio  label="Edges" value={t.edgeStyle}
                     options={['curved', 'straight']}
                     onChange={(v) => setTweak('edgeStyle', v)} />
        <TweakSection label="Behavior" />
        <TweakToggle label="Auto-scroll to selected" value={t.autoScroll}
                     onChange={(v) => setTweak('autoScroll', v)} />
        <TweakSection label="Demo" />
        <TweakButton label="Master next 10 topics" onClick={() => {
          const next = new Set(completed);
          let pending = 10;
          const queue = [current];
          const seen = new Set();
          while (queue.length && pending > 0) {
            const id = queue.shift();
            if (seen.has(id)) continue;
            seen.add(id);
            if (!next.has(id)) { next.add(id); pending--; if (pending === 0) break; }
            for (const nb of ADJ[id] || []) if (!seen.has(nb)) queue.push(nb);
          }
          setCompleted(next);
        }} />
        <TweakButton label="Master current domain" onClick={() => {
          if (!currentNode.domain) return;
          const domId = currentNode.domain;
          const next = new Set(completed);
          NODES.filter(n => n.domain === domId).forEach(n => next.add(n.id));
          setCompleted(next);
        }} />
        <TweakButton label="Master everything" onClick={() => {
          setCompleted(new Set(NODES.map(n => n.id)));
          setTimeout(() => setVictory(true), 400);
        }} />
        <TweakButton label="Reset progress" onClick={handleReset} />
      </TweaksPanel>

      {quizOpen && QUIZ_DATA[current] && (
        <QuizOverlay
          questions={QUIZ_DATA[current].questions}
          passThreshold={QUIZ_DATA[current].passThreshold}
          accentColor={currentColor}
          onPass={() => { handleComplete(); setQuizOpen(false); }}
          onClose={() => setQuizOpen(false)}
        />
      )}

      {animPhase === 'building' && (
        <div className="anim-overlay">
          <div className="anim-title">Generating ML Engineer Roadmap</div>
          <div className="anim-progress-bar">
            <div className="anim-progress-fill" style={{ width: `${Math.max(0, (animLevel + 1) / ANIM_LEVELS.length * 100)}%` }} />
          </div>
        </div>
      )}

      {victory && (
        <div className="victory">
          <div className="victory-card">
            <h1>ML Engineer.</h1>
            <p>The whole tree is green. Now go interview, design systems, and don't forget to monitor for drift.</p>
            <button onClick={() => { setVictory(false); handleReset(); }}>Play again</button>
          </div>
        </div>
      )}
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
