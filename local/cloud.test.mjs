import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../dist/server/index.js';
const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../drizzle/0000_amusing_shriek.sql',import.meta.url),'utf8'));
const DB={prepare(sql){const stmt=sqlite.prepare(sql);return{bind(...args){return{async first(){return stmt.get(...args)||null},async run(){const r=stmt.run(...args);return{meta:{changes:r.changes}}}}}}}};
async function api(path,method='GET',body=null,token=null){const req=new Request('https://game.example'+path,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(token?{'x-match-token':token}:{})},...(body?{body:JSON.stringify(body)}:{})});const r=await worker.fetch(req,{DB,ASSETS:{fetch:()=>new Response('asset')}});return{status:r.status,body:await r.json()}}
const u={type:'tank',tier:1,instruction:'Rush and fire',commands:['radar','gun','drive','retreat'],equipment:{}};
const a=(await api('/api/matches/create','POST',{units:[u],map:'urban'})).body;
assert.equal(a.code.length,6);const b=(await api('/api/matches/join','POST',{code:a.code,units:[u]})).body;assert.ok(b.token);assert.notEqual(a.token,b.token);
const [sa,sb]=await Promise.all([api('/api/matches?code='+a.code,'GET',null,a.token),api('/api/matches?code='+a.code,'GET',null,b.token)]);assert.equal(sa.body.seed,sb.body.seed);assert.equal(sa.body.battleUnits.length,2);assert.ok(sa.body.battleUnits.every(t=>!t.commands.includes('retreat')));
assert.equal((await api('/api/matches?code='+a.code,'GET',null,'bad-token')).status,403);
assert.equal((await api('/api/matches/join','POST',{code:a.code,units:[u]})).status,400);
assert.equal((await api('/api/matches/create','POST',{units:[{...u,tier:99}]})).status,400);
console.log('Cloud match database, join exclusivity, token access, fixed combat state and tier command limits passed.');
