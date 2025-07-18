export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/custom_avatars\/(.+)$/);
    if (!m) {
      return new Response('Not found', { status: 404 });
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST,OPTIONS',
        },
      });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', {
        status: 405,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }
    const nick = decodeURIComponent(m[1]);
    const buf = await request.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    const repo = env.GH_REPO;
    const token = env.GH_TOKEN;
    const path = `assets/custom_avatars/${nick}.png`;
    const apiURL = `https://api.github.com/repos/${repo}/contents/${path}`;

    let sha;
    const getRes = await fetch(apiURL, {
      headers: { Authorization: `token ${token}` },
    });
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
    }

    const body = {
      message: `Upload avatar for ${nick}`,
      content: base64,
      encoding: 'base64',
    };
    if (sha) body.sha = sha;

    const putRes = await fetch(apiURL, {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!putRes.ok) {
      const text = await putRes.text();
      return new Response(text, {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    return new Response('OK', {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  },
};

