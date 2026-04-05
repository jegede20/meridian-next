const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

const BEATS = [
  { id: 'ai',       label: 'AI',       fallback: 'OpenAI GPT-5 latest capabilities and safety research' },
  { id: 'tech',     label: 'Tech',     fallback: 'Apple new product launch and market impact' },
  { id: 'world',    label: 'World',    fallback: 'NATO alliance tensions and global diplomacy' },
  { id: 'science',  label: 'Science',  fallback: 'NASA space mission discovery and climate research' },
  { id: 'business', label: 'Business', fallback: 'Federal Reserve interest rate decision and markets' }
];

// Strict beat classification rules
const BEAT_RULES = {
  ai: ['artificial intelligence', 'machine learning', 'openai', 'anthropic', 'deepmind', 'chatgpt', 'gpt', 'llm', 'neural network', 'claude', 'gemini ai', 'ai model', 'language model', 'deep learning', 'generative ai'],
  tech: ['apple', 'microsoft', 'google', 'meta', 'amazon', 'samsung', 'semiconductor', 'chip', 'cybersecurity', 'software', 'hardware', 'silicon valley', 'smartphone', 'iphone', 'android', 'windows', 'cloud computing', 'hack', 'breach'],
  world: ['war', 'conflict', 'nato', 'united nations', 'diplomacy', 'military', 'sanction', 'foreign policy', 'geopolit', 'president', 'prime minister', 'treaty', 'troops', 'missile', 'nuclear', 'election', 'government', 'iran', 'russia', 'china', 'ukraine', 'israel', 'gaza', 'refugee'],
  science: ['nasa', 'space', 'climate', 'research study', 'scientists', 'discovery', 'planet', 'biology', 'physics', 'medical', 'health', 'quantum', 'genome', 'species', 'ocean', 'asteroid', 'vaccine', 'cancer', 'environment'],
  business: ['stock market', 'wall street', 'federal reserve', 'interest rate', 'inflation', 'gdp', 'trade war', 'tariff', 'ipo', 'venture capital', 'startup funding', 'earnings', 'revenue', 'acquisition', 'merger', 'economy', 'bitcoin', 'crypto', 'hedge fund', 'recession']
};

function classifyBeat(title, description) {
  const text = (title + ' ' + description).toLowerCase();
  const scores = {};

  for (const [beat, keywords] of Object.entries(BEAT_RULES)) {
    scores[beat] = keywords.filter(kw => text.includes(kw)).length;
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  // Only classify if we have at least 1 keyword match
  return best[1] > 0 ? best[0] : null;
}

async function fetchHeadlinesForBeat(beatId) {
  const queries = {
    ai: '"artificial intelligence" OR "OpenAI" OR "ChatGPT" OR "Anthropic" OR "language model" OR "AI model" OR "machine learning"',
    tech: '"Apple" OR "Microsoft" OR "Google" OR "Meta" OR "semiconductor" OR "cybersecurity" OR "smartphone" OR "silicon valley"',
    world: '"war" OR "conflict" OR "NATO" OR "diplomacy" OR "military" OR "sanctions" OR "geopolitics" OR "foreign policy"',
    science: '"NASA" OR "space exploration" OR "climate change" OR "scientists discover" OR "medical research" OR "quantum"',
    business: '"stock market" OR "Federal Reserve" OR "interest rates" OR "inflation" OR "trade tariff" OR "venture capital" OR "IPO" OR "crypto"'
  };

  try {
    const url = new URL('https://newsapi.org/v2/everything');
    url.searchParams.set('q', queries[beatId]);
    url.searchParams.set('language', 'en');
    url.searchParams.set('sortBy', 'publishedAt');
    url.searchParams.set('pageSize', '10');
    url.searchParams.set('apiKey', process.env.NEWS_API_KEY);

    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();

    return (data.articles || []).filter(a =>
      a.title && a.title !== '[Removed]' &&
      a.description && a.description !== '[Removed]'
    );
  } catch { return []; }
}

async function fetchUnsplashImage(query) {
  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.results || [];
    if (!results.length) return null;
    const pick = results[Math.floor(Math.random() * Math.min(results.length, 10))];
    return pick.urls?.regular || null;
  } catch { return null; }
}

function getFallbackImage(beat) {
  const seeds = { ai: 'ai-robot-42', tech: 'technology-99', world: 'world-city-7', science: 'science-space-23', business: 'finance-market-55' };
  return `https://picsum.photos/seed/${seeds[beat] || 'news'}/800/450`;
}

function safeParseJSON(raw) {
  let clean = raw.replace(/```json|```/g, '');
  clean = clean.replace(/\n/g, ' ').replace(/\r/g, '').replace(/\t/g, ' ');
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  clean = clean.trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found');
  let jsonStr = clean.slice(start, end + 1);
  try {
    return JSON.parse(jsonStr);
  } catch {
    jsonStr = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
    try {
      return JSON.parse(jsonStr);
    } catch {
      const extract = (key) => {
        const match = jsonStr.match(new RegExp('"' + key + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"'));
        return match ? match[1] : '';
      };
      return {
        headline: extract('headline') || 'Breaking News',
        deck: extract('deck') || '',
        lede: extract('lede') || '',
        body: extract('body') || '',
        kicker: extract('kicker') || '',
        readTime: '4 min read',
        sourceCredit: extract('sourceCredit') || 'Meridian Analysis',
        imageSearchQuery: extract('imageSearchQuery') || ''
      };
    }
  }
}

async function generateArticleForBeat(beat, usedHeadlines) {
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // Fetch headlines and find one that actually matches this beat
  const candidates = await fetchHeadlinesForBeat(beat.id);
  let chosenHeadline = null;

  for (const candidate of candidates) {
    const classified = classifyBeat(candidate.title, candidate.description);
    // Only use if it classifies to THIS beat AND hasn't been used
    if (classified === beat.id && !usedHeadlines.has(candidate.title)) {
      chosenHeadline = candidate;
      usedHeadlines.add(candidate.title);
      break;
    }
  }

  const system = `You are the chief correspondent for Meridian covering the ${beat.label} beat exclusively. You ONLY write about ${beat.label} topics. Write with precision, authority, and depth. Never fabricate quotes or statistics. Return only valid JSON with no newlines inside string values.`;

  const prompt = chosenHeadline
    ? `Expand this real ${beat.label} news wire into a full Meridian article.
Wire headline: "${chosenHeadline.title}"
Wire summary: "${chosenHeadline.description}"
Source: ${chosenHeadline.source?.name || 'wire'}
Today: ${today}

This is a ${beat.label.toUpperCase()} story. Write it as such.
Return ONLY this JSON (no newlines in values):
{"headline":"rewritten headline max 12 words","deck":"standfirst max 25 words","lede":"opening 2-3 sentences","body":"four paragraphs double-spaced 60+ words each","kicker":"one closing sentence","readTime":"4 min read","sourceCredit":"${chosenHeadline.source?.name || 'wire'}","imageSearchQuery":"3 specific visual keywords for this story"}`
    : `Write a serious ${beat.label} news article about: ${beat.fallback}
Today: ${today}
Return ONLY this JSON (no newlines in values):
{"headline":"headline max 12 words","deck":"standfirst max 25 words","lede":"opening 2-3 sentences","body":"four paragraphs double-spaced 60+ words each","kicker":"one closing sentence","readTime":"4 min read","sourceCredit":"Meridian Analysis","imageSearchQuery":"3 specific visual keywords for this story"}`;

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({ model: MODEL, temperature: 0.7, max_tokens: 1200, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] })
  });

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || '';
  const article = safeParseJSON(raw);

  const imageQuery = article.imageSearchQuery || beat.id;
  article.imageUrl = await fetchUnsplashImage(imageQuery) || getFallbackImage(beat.id);

  return article;
}

async function saveArticle(article, beat) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/articles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      headline: article.headline,
      deck: article.deck,
      lede: article.lede,
      body: article.body || '',
      kicker: article.kicker,
      beat: beat.id,
      beat_label: beat.label,
      read_time: article.readTime || '4 min read',
      source_credit: article.sourceCredit || 'Meridian Analysis',
      image_url: article.imageUrl
    })
  });
  if (!res.ok) throw new Error(await res.text());
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.GROQ_API_KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Missing environment variables' });
  }

  // Track used headlines to prevent duplicates across beats
  const usedHeadlines = new Set();
  const results = [];

  // Process sequentially to avoid duplicate content
  for (const beat of BEATS) {
    try {
      const article = await generateArticleForBeat(beat, usedHeadlines);
      await saveArticle(article, beat);
      results.push({ status: 'fulfilled', value: article.headline });
      console.log(`[${beat.label}] Published: ${article.headline}`);
    } catch (err) {
      results.push({ status: 'rejected', reason: err });
      console.error(`[${beat.label}] Failed:`, err.message);
    }
  }

  const published = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').map(r => r.reason?.message);
  return res.status(200).json({ success: true, published, failed, timestamp: new Date().toISOString() });
}