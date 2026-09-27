import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../dist/server/index.js';
const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../drizzle/0000_amusing_shriek.sql',import.meta.url),'utf8'));
sqlite.exec(readFileSync(new URL('../drizzle/0001_quick_abomination.sql',import.meta.url),'utf8'));
const DB={prepare(sql){const stmt=sqlite.prepare(sql);const methods=args=>({async first(){return stmt.get(...args)||null},async all(){return{results:stmt.all(...args)}},async run(){const r=stmt.run(...args);return{meta:{changes:r.changes}}}});return{bind(...args){return methods(args)},...methods([])}}};
async function api(path,method='GET',body=null,token=null){const req=new Request('https://game.example'+path,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(token?{'x-match-token':token}:{})},...(body?{body:JSON.stringify(body)}:{})});const r=await worker.fetch(req,{DB,ASSETS:{fetch:()=>new Response('asset')}});return{status:r.status,body:await r.json()}}
const u={type:'tank',tier:1,instruction:'Rush and fire',commands:['radar','gun','drive','retreat'],equipment:{}};
const a=(await api('/api/matches/create','POST',{units:[u],map:'urban'})).body;
assert.equal(a.code.length,6);const b=(await api('/api/matches/join','POST',{code:a.code,units:[u]})).body;assert.ok(b.token);assert.notEqual(a.token,b.token);
const [sa,sb]=await Promise.all([api('/api/matches?code='+a.code,'GET',null,a.token),api('/api/matches?code='+a.code,'GET',null,b.token)]);assert.equal(sa.body.seed,sb.body.seed);assert.equal(sa.body.battleUnits.length,2);assert.ok(sa.body.battleUnits.every(t=>!t.commands.includes('retreat')));
assert.equal((await api('/api/matches?code='+a.code,'GET',null,'bad-token')).status,403);
assert.equal((await api('/api/matches/join','POST',{code:a.code,units:[u]})).status,400);
assert.equal((await api('/api/matches/create','POST',{units:[{...u,tier:99}]})).status,400);
console.log('Cloud match database, join exclusivity, token access, fixed combat state and tier command limits passed.');

const profileA=(await api('/api/matches/profile','POST',{name:'Defense A',units:[u],map:'urban'})).body;
const lonely=(await api('/api/matches/random','POST',{profile:profileA.profile,name:'Defense A',units:[u],map:'urban'})).body;assert.equal(lonely.status,'empty');
const profileB=(await api('/api/matches/profile','POST',{name:'Defense B',units:[u],map:'urban'})).body;
assert.equal((await api('/api/matches/profile','POST',{profile:{id:profileA.profile.id,token:'wrong'},units:[u]})).status,400);
const attack=(await api('/api/matches/random','POST',{profile:profileA.profile,name:'Defense A',units:[u],map:'urban'})).body;assert.equal(attack.status,'running');assert.equal(attack.seat,0);
const room=sqlite.prepare('SELECT * FROM arena_matches WHERE code=?').get(attack.code);assert.equal(room.defender,profileB.profile.id);const completed=JSON.parse(room.state);completed.mode='won';sqlite.prepare('UPDATE arena_matches SET state=? WHERE code=?').run(JSON.stringify(completed),attack.code);
await api('/api/matches?code='+attack.code,'GET',null,attack.token);await api('/api/matches?code='+attack.code,'GET',null,attack.token);
const board=(await api('/api/matches/leaderboard')).body;assert.equal(board.players[0].name,'Defense A');assert.equal(board.players[0].wins,1);assert.equal(board.players.find(p=>p.name==='Defense B').losses,1);assert.ok(!JSON.stringify(board).includes(profileA.profile.token));
const stronger=(await api('/api/matches/random','POST',{name:'Strong commander',units:[{...u,tier:3},{...u,tier:3}],map:'urban'})).body;assert.equal(stronger.status,'empty');
console.log('Saved defenses, nearby-strength random attacks, profile authentication, score idempotence and private leaderboard data passed.');
