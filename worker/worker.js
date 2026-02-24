export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-admin-token",
      "Content-Type": "application/json"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      // Helper for path matching
      const is = (p) => path === p || path === p + "/";

      if (path.includes("/admin/")) {
        // 1. IP Protection
        const clientIP = request.headers.get("CF-Connecting-IP");
        if (env.ADMIN_IP && clientIP !== env.ADMIN_IP) {
          return new Response(JSON.stringify({ error: "Forbidden: IP Not Whitelisted", your_ip: clientIP }), { status: 403, headers: corsHeaders });
        }

        // 2. Session Token Auth (Except for Login itself)
        if (!is("/api/admin/login")) {
          const token = request.headers.get("x-admin-token");
          if (!token) {
            return new Response(JSON.stringify({ error: "Unauthorized: Missing Token" }), { status: 401, headers: corsHeaders });
          }
          const { results } = await env.DB.prepare("SELECT token FROM admin_sessions WHERE token = ?").bind(token).all();
          if (results.length === 0) {
            return new Response(JSON.stringify({ error: "Unauthorized: Invalid Session" }), { status: 401, headers: corsHeaders });
          }
        }
      }
      if (is("/api/settings") && method === "GET") {
        const { results } = await env.DB.prepare("SELECT key, value FROM settings").all();
        const settings = {};
        results.forEach(s => settings[s.key] = s.value);
        return new Response(JSON.stringify(settings), { headers: corsHeaders });
      }

      if (is("/api/leaderboard") && method === "GET") {
        const { results: settings } = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind("leaderboard_enabled").all();
        const enabled = settings.length > 0 && settings[0].value === "true";

        const { results: teams } = await env.DB.prepare("SELECT name as team_name, score FROM teams ORDER BY score DESC LIMIT 100").all();
        const leaderboard = teams.map((t, i) => ({
          rank: i + 1,
          team_name: t.team_name,
          score: t.score
        }));

        return new Response(JSON.stringify({ leaderboard, enabled }), { headers: corsHeaders });
      }

      // LOGIN
      if (is("/api/login") && method === "POST") {
        const { passkey } = await request.json();
        if (!passkey) {
          return new Response(JSON.stringify({ error: "Passkey required" }), { status: 400, headers: corsHeaders });
        }

        const { results } = await env.DB.prepare("SELECT * FROM teams WHERE UPPER(passkey) = ?").bind((passkey || "").toUpperCase()).all();

        if (results.length === 0) {
          return new Response(JSON.stringify({ error: "Invalid Passkey" }), { status: 401, headers: corsHeaders });
        }

        const team = results[0];
        const token = crypto.randomUUID();

        await env.DB.prepare("UPDATE teams SET session_token = ? WHERE id = ?")
          .bind(token, team.id)
          .run();

        return new Response(JSON.stringify({
          success: true,
          team_id: team.id,
          team_name: team.name,
          session_token: token
        }), { headers: corsHeaders });
      }

      // PUBLIC VIOLATIONS
      if (is("/api/violation") && method === "POST") {
        const { team_id } = await request.json();
        if (!team_id) {
          return new Response(JSON.stringify({ error: "team_id required" }), { status: 400, headers: corsHeaders });
        }
        await env.DB.prepare("INSERT INTO violations (team_id) VALUES (?)").bind(team_id).run();
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }
      // ADMIN LOGIN
      if (is("/api/admin/login") && method === "POST") {
        const { password } = await request.json();
        if (password !== env.ADMIN_PASSWORD) {
          return new Response(JSON.stringify({ error: "Incorrect Admin Password" }), { status: 401, headers: corsHeaders });
        }
        const token = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO admin_sessions (token) VALUES (?)").bind(token).run();
        return new Response(JSON.stringify({ token }), { headers: corsHeaders });
      }

      // QUESTIONS
      if (is("/api/admin/questions")) {
        if (method === "GET") {
          const { results } = await env.DB.prepare("SELECT * FROM questions ORDER BY id DESC").all();
          return new Response(JSON.stringify(results), { headers: corsHeaders });
        }
        if (method === "POST") {
          const questions = await request.json();
          // Chunk batching for D1 (limit of ~100 parameters per statements, or just loop)
          for (const q of questions) {
            await env.DB.prepare(`
              INSERT INTO questions (id, question_text, option_a, option_b, option_c, option_d, correct_answer)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).bind(crypto.randomUUID(), q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer).run();
          }
          return new Response(JSON.stringify({ success: true, count: questions.length }), { headers: corsHeaders });
        }
      }

      // TEAMS
      if (is("/api/admin/teams")) {
        if (method === "GET") {
          const { results } = await env.DB.prepare("SELECT * FROM teams ORDER BY score DESC").all();
          return new Response(JSON.stringify(results), { headers: corsHeaders });
        }
        if (method === "POST") {
          const { name } = await request.json();
          const id = "team_" + Date.now();
          const passkey = Math.random().toString(36).substring(2, 8).toUpperCase();
          await env.DB.prepare("INSERT INTO teams (id, name, passkey, score) VALUES (?, ?, ?, ?)").bind(id, name, passkey, 0).run();
          return new Response(JSON.stringify({ success: true, team: { id, team_name: name, passkey, score: 0 } }), { headers: corsHeaders });
        }
        if (method === "DELETE") {
          const id = url.searchParams.get('id');
          if (!id) {
            return new Response(JSON.stringify({ error: "ID required" }), { status: 400, headers: corsHeaders });
          }
          await env.DB.batch([
            env.DB.prepare("DELETE FROM submissions WHERE team_id = ?").bind(id),
            env.DB.prepare("DELETE FROM violations WHERE team_id = ?").bind(id),
            env.DB.prepare("DELETE FROM teams WHERE id = ?").bind(id)
          ]);
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }
      }

      if (is("/api/admin/teams/all") && method === "DELETE") {
        await env.DB.batch([
          env.DB.prepare("DELETE FROM submissions"),
          env.DB.prepare("DELETE FROM violations"),
          env.DB.prepare("DELETE FROM teams")
        ]);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      if (is("/api/admin/questions/all") && method === "DELETE") {
        await env.DB.prepare("DELETE FROM questions").run();
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      if (is("/api/admin/teams/update") && method === "POST") {
        const { id, score } = await request.json();
        await env.DB.prepare("UPDATE teams SET score = ? WHERE id = ?").bind(score, id).run();
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      if (is("/api/admin/teams/rename") && method === "POST") {
        const { id, name } = await request.json();
        if (!id || !name) {
          return new Response(JSON.stringify({ error: "ID and Name required" }), { status: 400, headers: corsHeaders });
        }
        await env.DB.prepare("UPDATE teams SET name = ? WHERE id = ?").bind(name, id).run();
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // VIOLATIONS
      if (is("/api/admin/violations") && method === "GET") {
        try {
          const { results } = await env.DB.prepare(`
            SELECT v.id, v.team_id, t.name, v.timestamp
            FROM violations v
            LEFT JOIN teams t ON v.team_id = t.id
            ORDER BY v.timestamp DESC
          `).all();
          return new Response(JSON.stringify(results || []), { headers: corsHeaders });
        } catch (dbErr) {
          return new Response(JSON.stringify({ error: "D1 Query Failed", details: dbErr.message }), { status: 500, headers: corsHeaders });
        }
      }

      // SETTINGS (ADMIN)
      if (is("/api/admin/settings") && method === "POST") {
        const settings = await request.json();
        for (const [key, value] of Object.entries(settings)) {
          await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").bind(key, String(value)).run();
        }
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      if (is("/api/admin/toggle-leaderboard") && method === "POST") {
        const { enabled } = await request.json();
        await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").bind("leaderboard_enabled", String(enabled)).run();
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      return new Response(JSON.stringify({
        error: "Not Found",
        path: path,
        method: method,
        tip: "Check if your API_URL matches this worker's deployment URL"
      }), { status: 404, headers: corsHeaders });

    } catch (err) {
      return new Response(JSON.stringify({
        error: "Worker Logic Crash",
        message: err.message,
        stack: err.stack
      }), { status: 500, headers: corsHeaders });
    }
  }
};
