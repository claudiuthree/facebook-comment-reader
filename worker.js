const origin = 'https://facebook-comment-reader.claudiuone.workers.dev';
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff'}
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/share' && request.method === 'POST') {
      if (request.headers.get('origin') !== origin || request.headers.get('x-reader-share') !== '1') return json({error: 'Forbidden'}, 403);
      const declared = Number(request.headers.get('content-length') || 0);
      if (declared > 200000) return json({error: 'Queue is too large'}, 413);
      const raw = await request.text();
      if (raw.length > 200000) return json({error: 'Queue is too large'}, 413);
      let data;
      try { data = JSON.parse(raw); } catch { return json({error: 'Invalid JSON'}, 400); }
      if (!data || typeof data !== 'object') return json({error: 'Invalid queue'}, 400);
      let post;
      try { post = new URL(data.post); } catch { return json({error: 'Invalid post URL'}, 400); }
      if (post.protocol !== 'https:' || !['facebook.com', 'www.facebook.com', 'fb.watch'].includes(post.hostname)) return json({error: 'Invalid post URL'}, 400);
      if (!Array.isArray(data.comments) || !data.comments.length || data.comments.length > 1000) return json({error: 'Invalid queue'}, 400);
      const comments = data.comments.map(value => String(value).trim().slice(0, 5000)).filter(Boolean);
      if (!comments.length) return json({error: 'Empty queue'}, 400);
      const key = [...crypto.getRandomValues(new Uint8Array(16))].map(n => n.toString(16).padStart(2, '0')).join('');
      await env.QUEUES.put(key, JSON.stringify({post: post.href, comments}), {expirationTtl: 86400});
      return json({code: key, expiresIn: 86400}, 201);
    }
    const share = url.pathname.match(/^\/api\/share\/([a-f0-9]{32})$/);
    if (share && request.method === 'GET') {
      const data = await env.QUEUES.get(share[1]);
      return data ? new Response(data, {headers: {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff'}}) : json({error: 'Queue not found or expired'}, 404);
    }
    if (url.pathname.startsWith('/api/')) return json({error: 'Not found'}, 404);
    return env.ASSETS.fetch(request);
  }
};
