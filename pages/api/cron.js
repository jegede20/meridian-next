const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

const BEATS = [
  { id: 'ai',       label: 'AI',       topics: ['artificial intelligence', 'large language models', 'AI safety', 'OpenAI', 'Anthropic', 'Google DeepMind'] },
  { id: 'tech',     label: 'Tech',     topics: ['technology industry', 'Silicon Valley', 'semiconductors', 'Apple', 'Microsoft', 'cybersecurity'] },
  { id: 'world',    label: 'World',    topics: ['geopolitics', 'international relations', 'global diplomacy', 'conflict zones', 'United Nations'] },
  { id: 'science',  label: 'Science',  topics: ['climate change', 'space exploration', 'medical research', 'biology breakthroughs', 'quantum computing'] },
  { id: 'business', label: 'Business', topics: ['global economy', 'financial markets', 'trade policy', 'corporate strategy', 'startups'] }
];

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

async function generateArticle(beat) {
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const headline = await fetchHeadline(beat.id);
  const topic = beat.topics[Math.floor(Math.random() * beat.topics.length)];

  const system = `You are the chief correspondent for Meridian, an AI-native publication with the standards of The Economist and The Atlantic. Write with precision, authority, and depth. Produce real journalism — not summaries. Never fabricate quotes or statistics.`;

  const prompt = headline
    ? `Expand this real news wire into a full Meridian article:\nHeadline: "${headline.title}"\nSummary: "${headline.description}"\nSource: ${headline.source}\nToday: ${today}\n\nAdd context, background, stakes, analysis. Do not copy wire text.\n\nReturn ONLY valid JSON:\n{"headline":"rewritten headline max 12 words","deck":"one sentence standfirst max 25 words","lede":"opening 2-3 sentences with impact","body":"four paragraphs separated by newlines, 60+ words each, real depth","kicker":"one closing sentence","readTime":"4 min read","sourceCredit":"${headline.source}"}`
    : `Write a serious news article about: ${topic}. Today: ${today}.\n\nReturn ONLY valid JSON:\n{"headline":"strong headline max 12 words","deck":"one sentence standfirst max 25 words","lede":"opening 2-3 sentences","body":"four paragraphs separated by newlines, 60+ words each","kicker":"one closing sentence","readTime":"4 min read","sourceCredit":"Meridian Analysis"}`;

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({ model: MODEL, temperature: 0.7, max_tokens: 1200, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] })
  });
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || '';
  const clean = raw.replace(/```json|```/g, '').trim();
  const start = clean.indexOf('{'); const end = clean.lastIndexOf('}');
  return JSON.parse(clean.slice(start, end + 1));
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
      headline: article.headline, deck: article.deck, lede: article.lede,
      body: article.body, kicker: article.kicker, beat: beat.id,
      beat_label: beat.label, read_time: article.readTime || '4 min read',
      source_credit: article.sourceCredit || 'Meridian Analysis'
    })
  });
  if (!res.ok) throw new Error(await res.text());
}

export default async function handler(req, res) {
  // Allow GET for manual trigger, Vercel cron uses GET
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.GROQ_API_KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Missing environment variables' });
  }

  console.log('[Meridian Cron] Starting pipeline...');

  const results = await Promise.allSettled(
    BEATS.map(async (beat) => {
      const article = await generateArticle(beat);
      await saveArticle(article, beat);
      console.log(`[Meridian] Published: ${article.headline}`);
      return article;
    })
  );

  const published = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').map(r => r.reason?.message);

  return res.status(200).json({ success: true, published, failed, timestamp: new Date().toISOString() });
}
