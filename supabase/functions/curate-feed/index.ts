import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { posts, userInterests, userActivity } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a content curation AI for Grovix, a platform for young professionals learning tech skills.

Your job is to rank and score posts based on user interests and engagement patterns.

User Interests: ${JSON.stringify(userInterests)}
Recent Activity Topics: ${JSON.stringify(userActivity)}

For each post, assign a relevance score (0-100) based on:
1. Topic match with user interests (40%)
2. Content quality and educational value (30%)  
3. Engagement potential (likes, comments) (20%)
4. Recency bonus (10%)

Return a JSON array of post IDs with their scores, sorted by score descending.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: `Analyze these posts and return ranked scores:\n${JSON.stringify(posts.map((p: any) => ({
              id: p.id,
              content: p.content.slice(0, 200),
              likes: p.likes,
              comments: p.comments?.length || 0,
              xp: p.xp,
              timeAgo: p.timeAgo
            })))}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "rank_posts",
              description: "Return ranked post IDs with relevance scores",
              parameters: {
                type: "object",
                properties: {
                  rankings: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        postId: { type: "number" },
                        score: { type: "number" },
                        reason: { type: "string" }
                      },
                      required: ["postId", "score", "reason"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["rankings"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "rank_posts" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const rankings = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(rankings), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: return posts in original order with default scores
    const fallbackRankings = {
      rankings: posts.map((p: any, i: number) => ({
        postId: p.id,
        score: 100 - i * 10,
        reason: "Default ranking"
      }))
    };

    return new Response(JSON.stringify(fallbackRankings), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Curate feed error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
