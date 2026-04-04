import { useState, useEffect } from 'react';
import Head from 'next/head';

const BEATS = ['all', 'ai', 'tech', 'world', 'science', 'business'];

export default function Home() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentBeat, setCurrentBeat] = useState('all');
  const [currentArticle, setCurrentArticle] = useState(null);
  const [qaMessages, setQaMessages] = useState([{ role: 'ai', text: 'Ask me anything about this story — background, context, implications, or what to watch next.' }]);
  const [qaInput, setQaInput] = useState('');
  const [qaLoading, setQaLoading] = useState(false);
  const [digestOpen, setDigestOpen] = useState(false);
  const [digestContent, setDigestContent] = useState('');
  const [digestLoading, setDigestLoading] = useState(false);
  const [nextUpdate, setNextUpdate] = useState('');

  useEffect(() => {
    const now = new Date();
    const next = new Date(now);
    next.setHours(Math.ceil(now.getHours() / 2) * 2, 0, 0, 0);
    setNextUpdate(next.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    loadArticles('all');
  }, []);

  async function loadArticles(beat) {
    setLoading(true);
    try {
      const url = beat === 'all' ? '/api/articles' : `/api/articles?beat=${beat}`;
      const res = await fetch(url);
      const data = await res.json();
      setArticles(data.articles || []);
    } catch { setArticles([]); }
    setLoading(false);
  }

  async function filterBeat(beat) {
    setCurrentBeat(beat);
    await loadArticles(beat);
  }

  function openArticle(a) {
    setCurrentArticle(a);
    setQaMessages([{ role: 'ai', text: 'Ask me anything about this story — background, context, implications, or what to watch next.' }]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function sendQA(q) {
    const question = q || qaInput;
    if (!question.trim() || !currentArticle) return;
    setQaInput('');
    setQaMessages(prev => [...prev, { role: 'user', text: question }]);
    setQaLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'qa', question, context: `${currentArticle.headline}. ${currentArticle.lede} ${currentArticle.body}` })
      });
      const data = await res.json();
      setQaMessages(prev => [...prev, { role: 'ai', text: data.answer }]);
    } catch {
      setQaMessages(prev => [...prev, { role: 'ai', text: 'Unable to reach the AI desk. Please try again.' }]);
    }
    setQaLoading(false);
  }

  async function openDigest() {
    setDigestOpen(true);
    setDigestLoading(true);
    setDigestContent('');
    const context = articles.length
      ? articles.map(a => `[${a.beatLabel}] ${a.headline}: ${a.deck}`).join('\n')
      : 'General world news covering AI, technology, geopolitics, science, and business.';
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'digest', context })
      });
      const data = await res.json();
      setDigestContent(data.digest);
    } catch {
      setDigestContent('<p>Unable to generate digest. Please try again.</p>');
    }
    setDigestLoading(false);
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <>
      <Head>
        <title>Meridian — Reported by machines. Written for humans.</title>
        <meta name="description" content="AI-native news surface. Reported by machines. Written for humans." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400&display=swap" rel="stylesheet" />
      </Head>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --ink: #0f0e0d; --ink-muted: #5a5750; --ink-faint: #9a9690;
          --paper: #faf8f4; --paper-warm: #f2efe8; --paper-card: #ffffff;
          --rule: #e0dbd0; --accent: #c8400a; --accent-light: #fdf0eb;
          --serif: 'Playfair Display', Georgia, serif;
          --sans: 'DM Sans', sans-serif; --mono: 'DM Mono', monospace;
        }
        body { font-family: var(--sans); background: var(--paper); color: var(--ink); min-height: 100vh; line-height: 1.6; }
        .masthead { background: var(--ink); color: var(--paper); border-bottom: 3px solid var(--accent); }
        .masthead-top { display:flex; align-items:center; justify-content:space-between; padding:10px 32px; border-bottom:1px solid rgba(255,255,255,0.1); font-size:11px; color:rgba(242,239,232,0.55); font-family:var(--mono); letter-spacing:0.05em; }
        .live-dot { display:inline-block; width:7px; height:7px; background:#22c55e; border-radius:50%; margin-right:6px; animation:pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .masthead-main { text-align:center; padding:20px 32px 0; }
        .wordmark { font-family:var(--serif); font-size:clamp(48px,8vw,88px); font-weight:700; letter-spacing:-0.02em; color:var(--paper); line-height:1; margin-bottom:6px; }
        .wordmark span { color:var(--accent); }
        .tagline { font-family:var(--mono); font-size:11px; letter-spacing:0.12em; color:rgba(242,239,232,0.45); text-transform:uppercase; margin-bottom:0; }
        .nav-strip { display:flex; align-items:center; justify-content:center; border-top:1px solid rgba(255,255,255,0.1); padding:0 32px; flex-wrap:wrap; }
        .nav-btn { background:none; border:none; color:rgba(242,239,232,0.6); font-family:var(--mono); font-size:11px; letter-spacing:0.08em; text-transform:uppercase; padding:10px 18px; cursor:pointer; border-bottom:2px solid transparent; transition:all 0.15s; }
        .nav-btn:hover, .nav-btn.active { color:var(--paper); border-bottom-color:var(--accent); }
        .digest-banner { background:var(--accent-light); border-bottom:1px solid #f0c8b0; padding:10px 32px; display:flex; align-items:center; gap:16px; cursor:pointer; }
        .digest-banner:hover { background:#fde8dd; }
        .digest-label { font-family:var(--mono); font-size:10px; letter-spacing:0.1em; text-transform:uppercase; color:var(--accent); padding:3px 8px; border:1px solid var(--accent); border-radius:2px; white-space:nowrap; }
        .container { max-width:1200px; margin:0 auto; padding:0 24px; }
        .feed-section { padding:32px 0 48px; }
        .section-rule { display:flex; align-items:center; gap:12px; margin-bottom:8px; }
        .section-rule h2 { font-family:var(--mono); font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:var(--ink-muted); white-space:nowrap; }
        .section-rule::after { content:''; flex:1; height:1px; background:var(--rule); }
        .next-update { font-family:var(--mono); font-size:10px; color:var(--ink-faint); letter-spacing:0.06em; margin-bottom:24px; }
        .next-update span { color:var(--accent); }

        /* ARTICLE IMAGES */
        .article-img { width:100%; aspect-ratio:16/9; object-fit:cover; display:block; background:#e8e4dc; }
        .hero-img { width:100%; aspect-ratio:16/9; object-fit:cover; display:block; margin-bottom:16px; background:#e8e4dc; }
        .sidebar-img { width:100%; aspect-ratio:16/9; object-fit:cover; display:block; margin-bottom:8px; background:#e8e4dc; }
        .article-hero-img { width:100%; max-height:420px; object-fit:cover; display:block; margin-bottom:28px; background:#e8e4dc; }

        .beat-tag { display:inline-block; background:#1a1814; color:#f2efe8; font-family:var(--mono); font-size:9px; letter-spacing:0.12em; text-transform:uppercase; padding:3px 8px; border-radius:2px; margin-bottom:10px; }
        .beat-tag.ai { background:#1a1060; }
        .beat-tag.tech { background:#0a2a0a; }
        .beat-tag.world { background:#2a0a0a; }
        .beat-tag.science { background:#0a1a2a; }
        .beat-tag.business { background:#1a1500; }

        .hero-grid { display:grid; grid-template-columns:1fr 300px; gap:32px; margin-bottom:32px; }
        @media(max-width:768px){ .hero-grid{grid-template-columns:1fr} }
        .hero-article { border-right:1px solid var(--rule); padding-right:32px; }
        @media(max-width:768px){ .hero-article{border-right:none;padding-right:0;border-bottom:1px solid var(--rule);padding-bottom:24px} }
        .hero-headline { font-family:var(--serif); font-size:clamp(22px,3vw,32px); font-weight:700; line-height:1.18; margin-bottom:10px; cursor:pointer; transition:color 0.15s; }
        .hero-headline:hover { color:var(--accent); }
        .hero-deck { font-size:14px; color:var(--ink-muted); line-height:1.65; margin-bottom:12px; font-weight:300; }
        .article-meta { display:flex; align-items:center; gap:10px; font-family:var(--mono); font-size:10px; letter-spacing:0.06em; color:var(--ink-faint); text-transform:uppercase; }
        .dot { color:var(--rule); }

        .sidebar-item { padding:12px 0; border-bottom:1px solid var(--rule); cursor:pointer; }
        .sidebar-item:first-child { padding-top:0; }
        .sidebar-item:last-child { border-bottom:none; }
        .sidebar-headline { font-family:var(--serif); font-size:14px; font-weight:600; line-height:1.3; margin:4px 0; transition:color 0.15s; }
        .sidebar-item:hover .sidebar-headline { color:var(--accent); }
        .sidebar-deck { font-size:11px; color:var(--ink-muted); line-height:1.4; }

        .secondary-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:24px; border-top:1px solid var(--rule); padding-top:24px; }
        @media(max-width:900px){ .secondary-grid{grid-template-columns:1fr 1fr} }
        @media(max-width:600px){ .secondary-grid{grid-template-columns:1fr} }
        .article-card { cursor:pointer; padding-bottom:20px; border-bottom:1px solid var(--rule); }
        .article-card:hover .card-headline { color:var(--accent); }
        .card-headline { font-family:var(--serif); font-size:16px; font-weight:600; line-height:1.3; margin:7px 0; transition:color 0.15s; }
        .card-deck { font-size:12px; color:var(--ink-muted); line-height:1.5; }

        .back-btn { display:flex; align-items:center; gap:6px; background:none; border:none; font-family:var(--mono); font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:var(--ink-muted); cursor:pointer; padding:24px 0 20px; transition:color 0.15s; }
        .back-btn:hover { color:var(--accent); }
        .article-full { display:grid; grid-template-columns:1fr 300px; gap:48px; align-items:start; }
        @media(max-width:768px){ .article-full{grid-template-columns:1fr} }
        .article-kicker { font-family:var(--mono); font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:var(--accent); margin-bottom:10px; }
        .article-title { font-family:var(--serif); font-size:clamp(26px,4vw,42px); font-weight:700; line-height:1.15; margin-bottom:14px; }
        .article-standfirst { font-family:var(--serif); font-style:italic; font-size:17px; color:var(--ink-muted); line-height:1.6; margin-bottom:18px; padding-bottom:18px; border-bottom:2px solid var(--rule); }
        .article-byline { font-family:var(--mono); font-size:10px; letter-spacing:0.08em; text-transform:uppercase; color:var(--ink-faint); margin-bottom:20px; display:flex; gap:16px; flex-wrap:wrap; }
        .article-content { font-size:17px; line-height:1.78; }
        .article-content p { margin-bottom:20px; }
        .article-content p:first-child::first-letter { font-family:var(--serif); font-size:4.2em; font-weight:700; float:left; line-height:0.75; padding-right:8px; padding-top:6px; color:var(--accent); }

        .qa-panel { position:sticky; top:16px; background:var(--paper-warm); border:1px solid var(--rule); border-radius:4px; overflow:hidden; }
        .qa-header { background:var(--ink); color:var(--paper); padding:13px 16px; display:flex; align-items:center; gap:8px; }
        .qa-header-label { font-family:var(--mono); font-size:10px; letter-spacing:0.1em; text-transform:uppercase; flex:1; }
        .qa-model-tag { font-family:var(--mono); font-size:9px; color:rgba(242,239,232,0.4); }
        .qa-messages { padding:14px; min-height:180px; max-height:340px; overflow-y:auto; display:flex; flex-direction:column; gap:10px; }
        .qa-msg-ai { font-size:13px; line-height:1.55; padding:9px 11px; border-radius:3px; background:var(--paper-card); border:1px solid var(--rule); }
        .qa-msg-user { font-size:11px; line-height:1.55; padding:9px 11px; border-radius:3px; background:var(--ink); color:var(--paper); align-self:flex-end; max-width:85%; font-family:var(--mono); }
        .qa-chips { padding:0 14px 10px; display:flex; flex-wrap:wrap; gap:5px; }
        .qa-chip { font-family:var(--mono); font-size:10px; padding:4px 9px; border:1px solid var(--rule); border-radius:2px; background:var(--paper-card); cursor:pointer; color:var(--ink-muted); transition:all 0.15s; }
        .qa-chip:hover { border-color:var(--accent); color:var(--accent); }
        .qa-input-row { padding:10px 14px; border-top:1px solid var(--rule); display:flex; gap:7px; }
        .qa-input { flex:1; border:1px solid var(--rule); border-radius:3px; padding:7px 10px; font-family:var(--sans); font-size:13px; background:var(--paper-card); color:var(--ink); outline:none; }
        .qa-input:focus { border-color:var(--accent); }
        .qa-send { background:var(--accent); border:none; border-radius:3px; color:white; font-family:var(--mono); font-size:11px; padding:7px 13px; cursor:pointer; }
        .qa-send:disabled { opacity:0.4; cursor:not-allowed; }

        .modal-bg { display:flex; position:fixed; inset:0; background:rgba(15,14,13,0.88); z-index:1000; align-items:center; justify-content:center; padding:24px; }
        .modal { background:var(--paper); max-width:560px; width:100%; border-radius:4px; max-height:85vh; overflow-y:auto; }
        .modal-header { background:var(--ink); padding:18px 22px; color:var(--paper); display:flex; align-items:center; justify-content:space-between; }
        .modal-title { font-family:var(--serif); font-size:22px; font-weight:700; }
        .modal-close { background:none; border:none; color:rgba(242,239,232,0.5); font-size:18px; cursor:pointer; }
        .modal-close:hover { color:var(--paper); }
        .modal-body { padding:22px; }
        .digest-content { font-size:14px; line-height:1.7; }
        .digest-content h3 { font-family:var(--serif); font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:var(--accent); margin:18px 0 6px; }
        .digest-content p { margin-bottom:10px; }

        .empty-state { text-align:center; padding:56px 24px; font-family:var(--serif); font-style:italic; color:var(--ink-muted); font-size:17px; }
        .spinner { display:inline-block; width:18px; height:18px; border:2px solid var(--rule); border-top-color:var(--accent); border-radius:50%; animation:spin 0.8s linear infinite; }
        @keyframes spin { to{transform:rotate(360deg)} }
        .site-footer { background:var(--ink); color:rgba(242,239,232,0.4); text-align:center; padding:22px; font-family:var(--mono); font-size:10px; letter-spacing:0.08em; text-transform:uppercase; margin-top:48px; border-top:3px solid var(--accent); }
        .site-footer strong { color:var(--paper); }
      `}</style>

      <header className="masthead">
        <div className="masthead-top">
          <span><span className="live-dot"></span>Live feed · AI pipeline active</span>
          <span>{dateStr}</span>
          <span>Est. 2026 · Autonomous Edition</span>
        </div>
        <div className="masthead-main">
          <div className="wordmark">Meridi<span>a</span>n</div>
          <div className="tagline">Reported by machines. Written for humans.</div>
        </div>
        <nav className="nav-strip">
          {BEATS.map(b => (
            <button key={b} className={`nav-btn ${currentBeat === b ? 'active' : ''}`} onClick={() => filterBeat(b)}>
              {b === 'all' ? 'All' : b.charAt(0).toUpperCase() + b.slice(1)}
            </button>
          ))}
        </nav>
      </header>

      <div className="digest-banner" onClick={openDigest}>
        <span className="digest-label">5-min briefing</span>
        <span style={{ fontSize: '13px', color: 'var(--ink)', flex: 1 }}>Your AI-curated digest of what matters right now — tap to generate today's briefing</span>
        <span>→</span>
      </div>

      <main className="container">
        {currentArticle ? (
          <div>
            <button className="back-btn" onClick={() => setCurrentArticle(null)}>← Back to feed</button>
            <div className="article-full">
              <div>
                <div className="article-kicker">{currentArticle.beatLabel} — {currentArticle.timestamp}</div>
                <h1 className="article-title">{currentArticle.headline}</h1>
                <div className="article-standfirst">{currentArticle.deck}</div>
                <div className="article-byline">
                  <span>Meridian AI Correspondent</span>
                  <span>{new Date(currentArticle.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  <span>{currentArticle.sourceCredit}</span>
                </div>
                {currentArticle.imageUrl && (
                  <img src={currentArticle.imageUrl} alt={currentArticle.headline} className="article-hero-img" />
                )}
                <div className="article-content">
                  {[currentArticle.lede, ...currentArticle.body.split('\n').filter(p => p.trim()), currentArticle.kicker]
                    .filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
                </div>
              </div>
              <aside>
                <div className="qa-panel">
                  <div className="qa-header">
                    <span className="qa-model-tag">◆</span>
                    <span className="qa-header-label">Ask about this story</span>
                    <span className="qa-model-tag">Meridian AI</span>
                  </div>
                  <div className="qa-messages">
                    {qaMessages.map((m, i) => (
                      <div key={i} className={m.role === 'user' ? 'qa-msg-user' : 'qa-msg-ai'}>{m.text}</div>
                    ))}
                    {qaLoading && <div className="qa-msg-ai"><span className="spinner" style={{ width: '12px', height: '12px' }}></span> Thinking…</div>}
                  </div>
                  <div className="qa-chips">
                    {['Why does this matter?', 'What happens next?', 'Give me the background'].map(q => (
                      <button key={q} className="qa-chip" onClick={() => sendQA(q)}>{q}</button>
                    ))}
                  </div>
                  <div className="qa-input-row">
                    <input className="qa-input" value={qaInput} onChange={e => setQaInput(e.target.value)}
                      placeholder="Ask anything…" onKeyDown={e => e.key === 'Enter' && sendQA()} />
                    <button className="qa-send" disabled={qaLoading} onClick={() => sendQA()}>Ask</button>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        ) : (
          <section className="feed-section">
            <div className="section-rule"><h2>Top Stories</h2></div>
            <div className="next-update">Publishes automatically every 2 hours · Next edition: <span>{nextUpdate}</span></div>

            {loading ? (
              <div className="empty-state"><span className="spinner"></span><br /><br />Loading latest stories…</div>
            ) : articles.length === 0 ? (
              <div className="empty-state">
                <div style={{ fontSize: '32px', marginBottom: '12px', fontFamily: 'var(--serif)' }}>"</div>
                The first Meridian edition is being prepared.<br />
                <span style={{ fontSize: '13px', display: 'block', marginTop: '8px' }}>Stories publish automatically every 2 hours.</span>
              </div>
            ) : (
              <>
                <div className="hero-grid">
                  <div className="hero-article">
                    {articles[0].imageUrl && <img src={articles[0].imageUrl} alt={articles[0].headline} className="hero-img" />}
                    <span className={`beat-tag ${articles[0].beat}`}>{articles[0].beatLabel}</span>
                    <div className="hero-headline" onClick={() => openArticle(articles[0])}>{articles[0].headline}</div>
                    <div className="hero-deck">{articles[0].deck}</div>
                    <div className="article-meta">
                      <span>Meridian AI</span><span className="dot">·</span>
                      <span>{articles[0].timestamp}</span><span className="dot">·</span>
                      <span>{articles[0].readTime}</span>
                    </div>
                  </div>
                  <div>
                    {articles.slice(1, 4).map((a, i) => (
                      <div key={i} className="sidebar-item" onClick={() => openArticle(a)}>
                        {a.imageUrl && <img src={a.imageUrl} alt={a.headline} className="sidebar-img" />}
                        <span className={`beat-tag ${a.beat}`}>{a.beatLabel}</span>
                        <div className="sidebar-headline">{a.headline}</div>
                        <div className="sidebar-deck">{a.deck}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {articles.length > 4 && (
                  <div className="secondary-grid">
                    {articles.slice(4).map((a, i) => (
                      <div key={i} className="article-card" onClick={() => openArticle(a)}>
                        {a.imageUrl && <img src={a.imageUrl} alt={a.headline} className="article-img" style={{ marginBottom: '10px' }} />}
                        <span className={`beat-tag ${a.beat}`}>{a.beatLabel}</span>
                        <div className="card-headline">{a.headline}</div>
                        <div className="card-deck">{a.deck}</div>
                        <div className="article-meta" style={{ marginTop: '10px' }}><span>{a.readTime}</span></div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </main>

      {digestOpen && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setDigestOpen(false)}>
          <div className="modal">
            <div className="modal-header">
              <div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(242,239,232,0.45)', marginBottom: '4px' }}>5-minute briefing</div>
                <div className="modal-title">Today's Meridian Digest</div>
              </div>
              <button className="modal-close" onClick={() => setDigestOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              {digestLoading
                ? <div className="empty-state"><span className="spinner"></span><br /><br />Composing briefing…</div>
                : <div className="digest-content" dangerouslySetInnerHTML={{ __html: digestContent }} />
              }
            </div>
          </div>
        </div>
      )}

      <footer className="site-footer">
        <strong>Meridian</strong> · Reported by machines. Written for humans. · {now.getFullYear()}
      </footer>
    </>
  );
}