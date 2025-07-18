export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if(url.pathname === '/genders' && request.method === 'GET'){
      const list = await env.GENDERS.list();
      const out = {};
      for(const k of list.keys){
        const v = await env.GENDERS.get(k.name);
        out[k.name] = v;
      }
      return new Response(JSON.stringify(out), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const m = url.pathname.match(/^\/genders\/(.+)$/);
    if(!m){
      return new Response('Not found', { status: 404 });
    }

    const nick = decodeURIComponent(m[1]);
    if(request.method === 'OPTIONS'){
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        },
      });
    }

    if(request.method === 'POST'){
      const { gender } = await request.json();
      await env.GENDERS.put(nick, gender);
      return new Response('OK', { headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    if(request.method === 'GET'){
      const gender = await env.GENDERS.get(nick);
      if(!gender){
        return new Response('Not found', { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      return new Response(gender, { headers: { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' } });
    }

    return new Response('Method not allowed', { status: 405, headers: { 'Access-Control-Allow-Origin': '*' } });
  },
};
