import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Reads a receipt image with OpenAI vision and returns suggested expense fields.
// Mirrors ai-quote. Reuses the same OPENAI_API_KEY secret.
// Request body: { imageBase64: string, mimeType?: string }
// Response: { data: { vendor, amount, category, split, business_pct, confidence, needs_review, spent_on } }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CATEGORIES = ['materials', 'tools', 'ppe', 'parking', 'fuel', 'clothing', 'subcontractor', 'other'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'imageBase64 is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `You are PAI, an assistant for UK tradespeople. You read a photo of a
receipt and extract expense details for self-assessment bookkeeping.
Respond with ONLY valid JSON in this exact shape:
{
  "vendor": "shop name or null",
  "amount": 0.00,                // total paid, number
  "category": "one of: ${CATEGORIES.join(', ')}",
  "split": "business | personal | mixed",
  "business_pct": 100,           // 0-100; business portion if split is mixed, else 100 or 0
  "confidence": 0.0,             // 0-1 how confident you are overall
  "needs_review": false,         // true if blurry/ambiguous or category uncertain
  "spent_on": "YYYY-MM-DD or null"
}
Rules: be conservative. For UK trades, everyday clothing is usually NOT allowable —
only protective/branded workwear counts as 'clothing'/business; if unsure set
needs_review=true. If you can't read the total, set amount to 0 and needs_review=true.`;

    const dataUri = `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract the expense details from this receipt.' },
              { type: 'image_url', image_url: { url: dataUri } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: `OpenAI: ${errText}` }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(JSON.stringify({ error: 'No content returned from AI' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let parsed;
    try { parsed = JSON.parse(content); } catch {
      return new Response(JSON.stringify({ error: 'Failed to parse AI response as JSON' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normalise category to the allowed set.
    if (!CATEGORIES.includes(parsed.category)) parsed.category = 'other';

    return new Response(JSON.stringify({ data: parsed }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('ai-receipt error:', err);
    return new Response(JSON.stringify({ error: `Server error: ${err instanceof Error ? err.message : String(err)}` }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
