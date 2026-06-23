import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      jobTitle,
      jobDescription,
      trade,
      budget,
      city,
      dayRate,
      hourlyRate,
      preferredShop,
      flexiblePricing,
    } = await req.json();

    if (!jobTitle || !jobDescription) {
      return new Response(
        JSON.stringify({ error: 'jobTitle and jobDescription are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are PAI, an assistant for UK tradespeople generating job quotes.
Output material lists and accurate cost estimates as valid JSON in the exact structure requested.
Prices should be realistic UK market rates for ${new Date().getFullYear()}.
STYLE RULES (important):
- Keep the scope to 1-2 short, plain, factual sentences. NO marketing fluff, NO
  flowery language, NO phrases like "attention to detail", "friendly relationship",
  "ensuring quality", "timely manner". Write like a busy tradesperson, not a brochure.
- Use the provided location EXACTLY as given. NEVER guess, expand, infer or "correct"
  a postcode into a town/city (e.g. do not turn "EX23" into a town name). If no
  location is given, do not mention one.`;

    // Build contractor context string
    const contractorContext = [
      dayRate ? `Contractor day rate: £${dayRate}/day` : null,
      hourlyRate ? `Contractor hourly rate: £${hourlyRate}/hr` : null,
      preferredShop ? `Preferred materials supplier: ${preferredShop} (use their typical pricing)` : null,
      flexiblePricing === true ? `Contractor pricing is flexible — provide a range where appropriate` : null,
      flexiblePricing === false ? `Contractor pricing is fixed — provide exact figures` : null,
    ].filter(Boolean).join('\n');

    const userPrompt = `Analyse this job and generate a professional scope of work, materials list and cost estimate.

Job Title: ${jobTitle}
Trade: ${trade || 'General'}
Description: ${jobDescription}
${budget ? `Customer Budget: £${budget}` : ''}
${city ? `Location: ${city}` : ''}
${contractorContext ? `\nContractor Details:\n${contractorContext}` : ''}

Use the contractor's own rates for labour estimates where provided. Price materials based on the preferred supplier if given, otherwise use typical UK trade prices.

Respond with ONLY this JSON structure:
{
  "title": "A SHORT job title — max 5 words, no full stop (e.g. 'Bathroom retile', 'Full house rewire', 'Kitchen tap replacement'). This is a heading, NOT the description.",
  "scope": "A concise 1-2 sentence scope of the work — plain and factual, no fluff.",
  "materials": [
    { "name": "Item name", "qty": 1, "unit": "each", "estimatedPrice": 0.00 }
  ],
  "labourEstimate": {
    "days": 0,
    "dayRateFrom": 0,
    "totalFrom": 0
  },
  "totalEstimate": {
    "materialsTotal": 0,
    "labourTotal": 0,
    "grandTotal": 0
  },
  "notes": "Any important caveats, site survey requirements, or additional considerations."
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1800,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(
        JSON.stringify({ error: `OpenAI: ${errText}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(
        JSON.stringify({ error: 'No content returned from AI' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response as JSON' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ data: parsed }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('ai-quote error:', err);
    return new Response(
      JSON.stringify({ error: `Server error: ${err instanceof Error ? err.message : String(err)}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
