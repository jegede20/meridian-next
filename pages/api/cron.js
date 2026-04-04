const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

const BEATS = [
  { id: 'ai',       label: 'AI',       topics: ['artificial intelligence', 'large language models', 'AI safety', 'OpenAI', 'Anthropic', 'Google DeepMind'], imageKeywords: 'artificial intelligence,technology,computer' },
  { id: 'tech',     label: 'Tech',     topics: ['technology industry', 'Silicon Valley', 'semiconductors', 'Apple', 'Microsoft', 'cybersecurity'], imageKeywords: 'technology,silicon valley,innovation' },
  { id: 'world',    label: 'World',    topics: ['geopolitics', 'international relations', 'global diplomacy', 'conflict zones', 'United Nations'], imageKeywords: 'world,geopolitics,diplomacy,city' },
  { id: 'science',  label: 'Science',  topics: ['climate change', 'space exploration', 'medical research', 'biology breakthroughs', 'quantum computing'], imageKeywords: 'science,space,research,nature' },
  { id: 'business', label: 'Business', topics: ['global economy', 'financial markets', 'trade policy', 'corporate strategy', 'startups'], imageKeywords: 'business,finance,economy,market' }
];

function getImageUrl(beat, headline) {
  const beatKeywords = {
    ai: 'artificial+intelligence,technology,future',
    tech: 'technology,innovation,digital',
    world: 'world,city,politics,global',
    science: 'science,space,nature,research',
    business: 'business,finance,economy'
  };
  const keywords = beatKeywords[beat] || 'news,world';
  // Use a random seed from headline to get consistent image per article
  const seed = headline ? headline.split(' ').slice(0, 2).join('-').toLowerCase().replace(/[^a-z0-9-]/g, '') : beat;
  return `https://picsum.photos/seed/${seed}/800/450`;
}

async function fetchHeadline(beat) {
  try {
    const queries = {
      ai: 'artificial intelligence OR OpenAI OR Anthropic OR "language model"',
      tech: 'technology OR Apple OR Microsoft OR Meta OR Google OR semiconductor',
      world: 'geopolitics OR diplomacy OR conflict OR NATO OR "United Nations"',
      science: 'science OR climate OR NASA OR "medical research" OR biology',
      business: 'economy OR markets OR trade OR startup OR "venture capital"'
    };
    const url = new URL('https://newsapi.org/v2/everything');
    url.searchParams.set('q', queries[beat]);
    url.searchParams.set('language', 'en');
    url.searchParams.set('sortBy', 'publishedAt');
    url.searchParams.set('pageSize', '5');
    url.searchParams.set('apiKey', process.env.NEWS_API_KEY);
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    const valid = (data.articles || []).filter(a => a.title && a.title !== '[Removed]' && a.description && a.description !== '[Removed]');
    if (!valid.length) return null;
    const pick = valid[Math.floor(Math.random() * valid.length)];
    return { title: pick.title, description: pick.description, source: pick.source?.name || 'wire' };
  } catch { return null; }
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
  const headline = await fetchHeadline(beat.id);
  const topic = beat.topics[Math.floor(Math.random() * beat.topics.length)];

  const system = `You are the chief correspondent for Meridian, an AI-native publication with the standards of The Economist and The Atlantic. Write with precision, authority, and depth. Produce real journalism. Never fabricate quotes or statistics. IMPORTANT: Return only valid JSON with no newlines inside string values.`;

  const prompt = headline
    ? `Expand this real news wire into a full Meridian article. Wire: Headline: "${headline.title}" Summary: "${headline.description}" Source: ${headline.source}. Today: ${today}. Add context, background, stakes, analysis. Return ONLY this JSON with no newlines inside string values: {"headline":"rewritten headline max 12 words","deck":"one sentence standfirst max 25 words","lede":"opening 2-3 sentences with impact","body":"four paragraphs separated by double space 60 plus words each real depth","kicker":"one closing sentence","readTime":"4 min read","sourceCredit":"${headline.source}"}`
    : `Write a serious news article about: ${topic}. Today: ${today}. Return ONLY this JSON with no newlines inside string values: {"headline":"strong headline max 12 words","deck":"one sentence standfirst max 25 words","lede":"opening 2-3 sentences","body":"four paragraphs separated by double space 60 plus words each","kicker":"one closing sentence","readTime":"4 min read","sourceCredit":"Meridian Analysis"}`;

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({ model: MODEL, temperature: 0.7, max_tokens: 1200, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] })
  });
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || '';
  const article = safeParseJSON(raw);
  // Attach image URL based on beat and headline
  article.imageUrl = getImageUrl(beat.id, article.headline);
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