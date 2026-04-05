const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

const BEATS = [
  {
    id: 'ai',
    label: 'AI',
    topics: ['OpenAI GPT models', 'Anthropic Claude AI', 'Google DeepMind research', 'AI safety regulations', 'large language model deployment'],
    // Strict NewsAPI queries — only AI/tech topics
    newsQuery: '"artificial intelligence" OR "machine learning" OR "OpenAI" OR "Anthropic" OR "DeepMind" OR "language model" OR "ChatGPT" OR "Gemini AI"',
    imageQuery: 'artificial intelligence technology robot'
  },
  {
    id: 'tech',
    label: 'Tech',
    topics: ['Apple product launches', 'Microsoft Azure cloud', 'Meta platforms strategy', 'semiconductor chip shortage', 'cybersecurity breaches'],
    newsQuery: '"Apple" OR "Microsoft" OR "Meta" OR "Google" OR "Amazon" OR "semiconductor" OR "cybersecurity" OR "silicon valley" OR "startup funding"',
    imageQuery: 'technology computer silicon valley innovation'
  },
  {
    id: 'world',
    label: 'World',
    topics: ['US foreign policy', 'NATO alliance tensions', 'United Nations resolutions', 'Middle East diplomacy', 'China geopolitics'],
    newsQuery: '"geopolitics" OR "diplomacy" OR "NATO" OR "United Nations" OR "foreign policy" OR "international relations" OR "war" OR "conflict" OR "sanctions"',
    imageQuery: 'world politics diplomacy government'
  },
  {
    id: 'science',
    label: 'Science',
    topics: ['NASA space missions', 'climate change research', 'medical breakthrough', 'quantum computing advance', 'biology discovery'],
    newsQuery: '"NASA" OR "space exploration" OR "climate change" OR "medical research" OR "quantum computing" OR "scientific discovery" OR "biology" OR "physics"',
    imageQuery: 'science space research laboratory nature'
  },
  {
    id: 'business',
    label: 'Business',
    topics: ['Federal Reserve interest rates', 'stock market volatility', 'startup venture capital', 'global trade tariffs', 'corporate earnings'],
    newsQuery: '"stock market" OR "Federal Reserve" OR "interest rates" OR "venture capital" OR "IPO" OR "trade war" OR "inflation" OR "GDP" OR "earnings"',
    imageQuery: 'business finance economy stock market'
  }
];

// Fetch relevant image from Unsplash based on article headline
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
    // Pick a random image from top 10 results
    const pick = results[Math.floor(Math.random() * Math.min(results.length, 10))];
    return pick.urls?.regular || pick.urls?.small || null;
  } catch { return null; }
}

// Fallback image using Picsum if Unsplash fails
function getFallbackImage(beat) {
  const seeds = { ai: 'tech-ai-42', tech: 'technology-99', world: 'world-city-7', science: 'science-space-23', business: 'finance-55' };
  return `https://picsum.photos/seed/${seeds[beat] || 'news'}/800/450`;
}

async function fetchHeadline(beat) {
  try {
    const url = new URL('https://newsapi.org/v2/everything');
    url.searchParams.set('q', beat.newsQuery);
    url.searchParams.set('language', 'en');
    url.searchParams.set('sortBy', 'publishedAt');
    url.searchParams.set('pageSize', '10');
    url.searchParams.set('apiKey', process.env.NEWS_API_KEY);
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    const valid = (data.articles || []).filter(a =>
      a.title && a.title !== '[Removed]' &&
      a.description && a.description !== '[Removed]' &&
      // Extra filter: make sure article is actually relevant to this beat
      isRelevantToBeat(a.title + ' ' + a.description, beat.id)
    );
    if (!valid.length) return null;
    const pick = valid[Math.floor(Math.random() * Math.min(valid.length, 5))];
    return { title: pick.title, description: pick.description, source: pick.source?.name || 'wire' };
  } catch { return null; }
}

// Check if headline is actually relevant to the beat
function isRelevantToBeat(text, beatId) {
  const lower = text.toLowerCase();
  const beatKeywords = {
    ai: ['ai', 'artificial intelligence', 'machine learning', 'openai', 'anthropic', 'deepmind', 'chatgpt', 'llm', 'neural', 'gemini', 'claude', 'gpt'],
    tech: ['apple', 'microsoft', 'google', 'meta', 'amazon', 'tech', 'software', 'app', 'chip', 'semiconductor', 'cyber', 'hack', 'data', 'cloud'],
    world: ['war', 'conflict', 'nato', 'un ', 'united nations', 'diplomacy', 'sanction', 'foreign', 'military', 'government', 'president', 'minister', 'election', 'treaty', 'geopolit'],
    science: ['nasa', 'space', 'climate', 'research', 'study', 'science', 'planet', 'discovery', 'medical', 'health', 'quantum', 'biology', 'physics', 'environment'],
    business: ['market', 'stock', 'economy', 'gdp', 'inflation', 'fed ', 'federal reserve', 'trade', 'tariff', 'ipo', 'startup', 'billion', 'revenue', 'earnings', 'invest']
  };
  const keywords = beatKeywords[beatId] || [];
  return keywords.some(kw => lower.includes(kw));
}

function safeParseJSON(raw) {
  let clean = raw.replace(/```json|```/g, '');
  clean = clean.replace(/\n/g, ' ').replace(/\r/g, '').replace(/\t/g, ' ');
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  clean = clean.trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found');
  return JSON.parse(clean.slice(start, end + 1));
}

async function generateArticle(beat) {
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const headline = await fetchHeadline(beat);
  const topic = beat.topics[Math.floor(Math.random() * beat.topics.length)];

  const system = `You are the chief correspondent for Meridian, covering the ${beat.label} beat. You ONLY write about ${beat.label} topics. Write with precision, authority, and depth. Produce real journalism. Never fabricate quotes or statistics. Return only valid JSON with no newlines inside string values.`;

  const prompt = headline
    ? `Expand this real ${beat.label} news wire into a full Meridian article. Wire: Headline: "${headline.title}" Summary: "${headline.description}" Source: ${headline.source}. Today: ${today}. Add context, background, stakes, analysis. Return ONLY this JSON: {"headline":"rewritten headline max 12 words","deck":"one sentence standfirst max 25 words","lede":"opening 2-3 sentences with impact","body":"four paragraphs separated by double space 60 plus words each","kicker":"one closing sentence","readTime":"4 min read","sourceCredit":"${headline.source}","imageSearchQuery":"3 specific keywords describing the visual content of this story for image search"}`
    : `Write a serious ${beat.label} news article about: ${topic}. Today: ${today}. Return ONLY this JSON: {"headline":"strong headline max 12 words","deck":"one sentence standfirst max 25 words","lede":"opening 2-3 sentences","body":"four paragraphs separated by double space 60 plus words each","kicker":"one closing sentence","readTime":"4 min read","sourceCredit":"Meridian Analysis","imageSearchQuery":"3 specific keywords describing the visual content of this story for image search"}`;

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({ model: MODEL, temperature: 0.7, max_tokens: 1200, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] })
  });
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || '';
  const article = safeParseJSON(raw);

  // Fetch relevant image using article's own image search query
  const imageQuery = article.imageSearchQuery || beat.imageQuery;
  const imageUrl = await fetchUnsplashImage(imageQuery) || getFallbackImage(beat.id);
  article.imageUrl = imageUrl;

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
      body: article.body,
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

  const results = await Promise.allSettled(
    BEATS.map(async (beat) => {
      const article = await generateArticle(beat);
      await saveArticle(article, beat);
      return article.headline;
    })
  );

  const published = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').map(r => r.reason?.message);
  return res.status(200).json({ success: true, published, failed, timestamp: new Date().toISOString() });
}