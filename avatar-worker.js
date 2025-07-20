export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/avatars\/(.+)$/);
    if (!m) {
      return new Response('Not found', {
        status: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    const nick = decodeURIComponent(m[1]);
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method === 'GET') {
      const { value, metadata } = await env.AVATARS.getWithMetadata(nick, {
        type: 'arrayBuffer',
      });
      if (!value) {
        return new Response('Not found', {
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
      }
      const ct = (metadata && metadata.contentType) || 'application/octet-stream';
      return new Response(value, {
        headers: {
          'Content-Type': ct,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method === 'POST') {
      const ct = request.headers.get('content-type') || 'application/octet-stream';
      const buf = await request.arrayBuffer();
      await env.AVATARS.put(nick, buf, { metadata: { contentType: ct } });
      return new Response('OK', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    return new Response('Method not allowed', {
      status: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  },
};
