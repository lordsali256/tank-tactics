import assert from 'node:assert/strict';
const unit={type:'tank',tier:1,instruction:'Rush and fire aggressively',commands:['radar','gun','drive'],equipment:{}};
async function action(path,body){const r=await fetch('http://127.0.0.1:8878/api/matches/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(d.error)throw Error(d.error);return d}
const a=await action('create',{map:'urban'}),b=await action('join',{code:a.code});
assert.equal(a.code,b.code);assert.notEqual(a.token,b.token);
const status=async token=>{const r=await fetch('http://127.0.0.1:8878/api/matches?code='+a.code,{headers:{'x-match-token':token}});return r.json()};
const sa=await status(a.token),sb=await status(b.token);assert.equal(sa.seat,0);assert.equal(sb.seat,1);assert.equal(sa.seed,sb.seed);assert.equal(sa.battleUnits.length,2);
const forbidden=await status('wrong-token');assert.equal(forbidden.error,'Invalid session token');
await assert.rejects(()=>action('join',{code:a.code}),/already has two/);
await assert.rejects(()=>action('create',{units:[{...unit,type:'code-injection'}]}),/server-owned/);
console.log('Authoritative match creation, pairing, shared state, tokens and squad validation passed.');
