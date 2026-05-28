exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'CLAUDE_API_KEY não configurada' })
    };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Pedido inválido' }) }; }

  const { sector, country, revenue, quantity } = body;
  const revenueLabel = {
    '5k': '€5k–€10k/mês', '10k': '€10k–€30k/mês',
    '30k': '€30k–€50k/mês', '50k': '€50k–€100k/mês', '100k': '€100k+/mês'
  }[revenue] || '€30k–€100k/mês';

  const prompt = `És um especialista em geração de leads B2B para o MetriqOps Analytics, um serviço semanal de inteligência para lojas e-commerce.

Gera ${quantity} perfis realistas de lojas e-commerce:
- Setor: ${sector}
- País: ${country}
- Faturação mensal: ${revenueLabel}

Responde APENAS com um array JSON válido, sem markdown, sem texto extra. Começa com [ e termina com ].

Cada objeto deve ter exatamente estes campos:
{
  "company": "nome da loja",
  "url": "website.com",
  "city": "cidade",
  "revenue": "ex: €80k–€120k/mês",
  "platform": "Shopify",
  "founder_name": "Nome Apelido",
  "founder_role": "CEO ou Founder",
  "linkedin": "linkedin.com/in/handle",
  "ads": "Google + Meta",
  "fit_score": 82,
  "fit_reasons": ["razão 1", "razão 2", "razão 3"],
  "red_flags": [],
  "message_linkedin": "Mensagem LinkedIn em português europeu, 3 parágrafos curtos. Começa com: Olá [Primeiro Nome],",
  "message_email": "ASSUNTO: ...\n\nCorpo do email em português europeu. 3 parágrafos.",
  "message_followup": "Follow-up LinkedIn em português europeu, 2 parágrafos curtos."
}

Usa português europeu em todas as mensagens. Varia fit_score entre 50 e 95. Perfis realistas para ${country}.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 6000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Erro Claude API');

    const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const s = clean.indexOf('['), e = clean.lastIndexOf(']');
    if (s === -1 || e === -1) throw new Error('Resposta inválida da IA');

    const leads = JSON.parse(clean.substring(s, e + 1));
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ leads })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
