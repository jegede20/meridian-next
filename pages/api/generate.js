const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

async function groq(system, user) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({ model: MODEL, temperature: 0.7, max_tokens: 1000, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { type, question, context } = req.body;

  try {
    if (type === 'qa') {
      const answer = await groq(
        'You are Meridian\'s editorial AI. Answer reader questions about news stories with journalistic authority. Be specific, accurate, concise. Max 100 words. Flowing prose only.',
        `Story context: ${context}\n\nReader question: ${question}`
      );
      return res.status(200).json({ answer });
    }

    if (type === 'digest') {
      const digest = await groq(
        'You are Meridian\'s briefing editor. Write a tight 5-minute news digest. Voice: authoritative, clear. Think The Economist daily briefing.',
        `Write a 5-minute briefing from these stories:\n\n${context}\n\nReturn clean HTML using only <h3> and <p> tags. 5 sections, each with a header and 2-3 sentences. No intro. Start directly with first <h3>.`
      );
      return res.status(200).json({ digest });
    }

    return res.status(400).json({ error: 'Unknown type' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
