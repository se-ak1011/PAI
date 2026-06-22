import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Writes a polished public-portfolio title + description from a completed job.
// Mirrors ai-quote. Reuses the same OPENAI_API_KEY secret.
// Request body: { jobTitle, jobDescription?, trade?, customer?, total?, location?, photoCount? }
// Response: { data: { title: string, description: string } }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { jobTitle, jobDescription, trade, customer, total, location, photoCount } = await req.json();
    if (!jobTitle) {
      return new Response(JSON.stringify({ error: 'jobTitle is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `You are PAI, helping a UK tradesperson present a completed job as a
portfolio piece that wins them more work. Write in a confident, professional but
down-to-earth British tradesperson's voice. Do NOT invent specifics that aren't
provided. No customer personal data. Respond with ONLY valid JSON:
{ "title": "a short, appealing project title (max 60 chars)",
  "description": "2 short paragraphs describing the work, the finish, and the value delivered" }`;

    const facts = [
      `Job: ${jobTitle}`,
      trade ? `Trade: ${trade}` : '',
      jobDescription ? `Scope: ${jobDescription}` : '',
      location ? `Location: ${location}` : '',
      total ? `Project value: £${total}` : '',
      photoCount ? `${photoCount} photo(s) attached` : '',
    ].filter(Boolean).join('\n');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Write a portfolio entry from these facts:\n${facts}` },
        ],
        temperature: 0.5,
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

    return new Response(JSON.stringify({ data: parsed }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('ai-portfolio error:', err);
    return new Response(JSON.stringify({ error: `Server error: ${err instanceof Error ? err.message : String(err)}` }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
