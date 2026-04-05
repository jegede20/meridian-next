const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

const BEATS = [
  { id: 'ai',       label: 'AI',       topic: 'artificial intelligence OpenAI Anthropic AI safety' },
  { id: 'tech',     label: 'Tech',     topic: 'technology Apple Microsoft cybersecurity semiconductors' },
  { id: 'world',    label: 'World',    topic: 'geopolitics NATO diplomacy international conflict' },
  { id: 'science',  label: 'Science',  topic: 'space exploration climate science medical research' },
  { id: 'business', label: 'Business', topic: 'stock markets Federal Reserve trade economy startups' }
];

const BEAT_KEYWORDS = {
  ai:       ['artificial intelligence','machine learning','openai','anthropic','deepmind','chatgpt','gpt','llm','claude','gemini ai','neural','ai model','language model'],
  tech:     ['apple inc','microsoft','samsung','semiconductor','cybersecurity','iphone','android','windows','silicon','software','hardware','chip'],
  world:    ['war','conflict','nato','united nations','diplomacy','military','sanction','foreign policy','geopolit','troops','missile','nuclear','election','iran','russia','ukraine','israel','gaza'],
  science:  ['nasa','space','climate change','scientists','discovery','planet','biology','physics','medical','quantum','genome','species','asteroid','vaccine'],
  business: ['stock market','wall street','federal reserve','interest rate','inflation','gdp','trade war','tariff','ipo','venture capital','earnings','acquisition','merger','bitcoin','cryptocurrency','recession']
};

function getBeatScore(text, beatId) {
  const lower = text.toLowerCase();
  return BEAT_KEYWORDS[beatId].filter(kw => lower.includes(kw)).length;
}

async function fetchHeadline(beat) {
  const queries = {
    ai:       '"artificial intelligence" OR "OpenAI" OR "ChatGPT" OR "Anthropic" OR "AI model"',
    tech:     '"Apple" OR "Microsoft" OR "Google" OR "semiconductor" OR "cybersecurity"',
    world:    '"conflict" OR "NATO" OR "diplomacy" OR "military" OR "sanctions" OR "war"',
    science:  '"NASA" OR "climate change" OR "scientists" OR "space" OR "medical research"',
    business: '"stock market" OR "Federal Reserve" OR "inflation" OR "trade" OR "crypto"'
  };
  try {
    const url = new URL('https://newsapi.org/v2/everything');
    url.searchParams.set('q', queries[beat.id]);
    url.searchParams.set('language', 'en');
    url.searchParams.set('sortBy', 'publishedAt');
    url.searchParams.set('pageSize', '10');
    url.searchParams.set('apiKey', process.env.NEWS_API_KEY);
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    const valid = (data.articles || []).filter(a =>
      a.title && a.title !== '[Removed]' &&
      a.description && a.description !== '[Removed]'
    );
    // Sort by beat relevance score
    const scored = valid.map(a => ({
      ...a, score: getBeatScore(a.title + ' ' + a.description, beat.id)
    })).sort((a, b) => b.score - a.score);
    // Return best matching article
    return scored[0] || null;
  } catch { return null; }
}

async function fetchUnsplashImage(query) {
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`,
      { headers: { 'Authorization': `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.results || [];
    if (!results.length) return null;
    return results[Math.floor(Math.random() * Math.min(results.length, 5))].urls?.regular || null;
  } catch { return null; }
}

function getFallback(beatId) {
  const seeds = { ai: 'ai-robot-42', tech: 'gadget-99', world: 'city-globe-7', science: 'space-lab-23', business: 'finance-55' };
  return `https://picsum.photos/seed/${seeds[beatId] || 'news'}/800/450`;
}

function safeParseJSON(raw) {
  let s = raw.replace(/```json|```/g, '').replace(/\n|\r|\t/g, ' ').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a === -1 || b === -1) throw new Error('No JSON object found');
  let j = s.slice(a, b + 1);
  try { return JSON.parse(j); }
  catch {
    j = j.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(j);
  }
}

async function generateAndSave(beat) {
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const headline = await fetchHeadline(beat);
  const src = headline?.source?.name || 'Meridian Analysis';

  const prompt = headline
    ? `You are a ${beat.label} journalist at Meridian. Write a news article about this ${beat.label} story: "${headline.title}" - ${headline.description} (Source: ${src}, ${today}). Return ONLY valid JSON with no line breaks inside values: {"headline":"max 12 words","deck":"max 25 words","lede":"2-3 sentences","body":"3 paragraphs 60+ words each separated by double space","kicker":"1 sentence","sourceCredit":"${src}","imageSearchQuery":"3 visual keywords matching this story"}`
    : `You are a ${beat.label} journalist at Meridian. Write a current news article about ${beat.topic} (${today}). Return ONLY valid JSON with no line breaks inside values: {"headline":"max 12 words","deck":"max 25 words","lede":"2-3 sentences","body":"3 paragraphs 60+ words each separated by double space","kicker":"1 sentence","sourceCredit":"Meridian Analysis","imageSearchQuery":"3 visual keywords"}`;

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: MODEL, temperature: 0.7, max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!res.ok) throw new Error(`Groq error ${res.status}`);
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || '';
  if (!raw) throw new Error('Empty Groq response');

  const article = safeParseJSON(raw);
  const imageUrl = await fetchUnsplashImage(article.imageSearchQuery || beat.topic) || getFallback(beat.id);

  await fetch(`${process.env.SUPABASE_URL}/rest/v1/articles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      headline: article.headline, deck: article.deck,
      lede: article.lede, body: article.body || '',
      kicker: article.kicker, beat: beat.id,
      beat_label: beat.label, read_time: '4 min read',
      source_credit: article.sourceCredit || 'Meridian Analysis',
      image_url: imageUrl
    })
  });

  return article.headline;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();
  if (!process.env.GROQ_API_KEY || !process.env.SUPABASE_URL) {
    return res.status(500).json({ error: 'Missing env vars' });
  }

  const results = await Promise.allSettled(BEATS.map(beat => generateAndSave(beat)));
  const published = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').map(r => r.reason?.message);
  return res.status(200).json({ success: true, published, failed, timestamp: new Date().toISOString() });
}