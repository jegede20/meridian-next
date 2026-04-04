export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { beat } = req.query;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  try {
    let url = `${SUPABASE_URL}/rest/v1/articles?order=created_at.desc&limit=20`;
    if (beat && beat !== 'all') url += `&beat=eq.${beat}`;

    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    const data = await response.json();
    const articles = data.map(a => ({
      id: a.id,
      headline: a.headline,
      deck: a.deck,
      lede: a.lede,
      body: a.body,
      kicker: a.kicker,
      beat: a.beat,
      beatLabel: a.beat_label,
      readTime: a.read_time || '4 min read',
      sourceCredit: a.source_credit || 'Meridian Analysis',
      timestamp: new Date(a.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      createdAt: a.created_at
    }));

    return res.status(200).json({ articles });
  } catch (err) {
    return res.status(500).json({ error: err.message, articles: [] });
  }
}
