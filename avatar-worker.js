export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const avatarMatch = url.pathname.match(/^\/avatars\/(.+)$/);
    const uploadMatch = url.pathname.match(/^\/upload-avatar\/(.+)$/);
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (!avatarMatch && !uploadMatch) {
      return new Response('Not found', {
        status: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    const nick = decodeURIComponent(avatarMatch ? avatarMatch[1] : uploadMatch[1]);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (avatarMatch && request.method === 'GET') {
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

    if (uploadMatch && request.method === 'POST') {
      const ct = request.headers.get('content-type') || 'application/octet-stream';
      const buf = await request.arrayBuffer();
      if (ct.split('/')[0] !== 'image' || buf.byteLength > 1_000_000 ||
          request.headers.get('X-Upload-Token') !== env.UPLOAD_TOKEN) {
        return new Response('Invalid upload', { status: 400, headers: cors });
      }
      await env.AVATARS.put(nick, buf, { metadata: { contentType: ct } });
      return new Response('OK', { headers: cors });
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
