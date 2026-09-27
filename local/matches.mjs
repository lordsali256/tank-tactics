import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync,readdirSync} from 'node:fs';
import path from 'node:path';
import worker from '../dist/server/index.js';
const root=path.join(process.env.LOCALAPPDATA,'TankTactics');mkdirSync(root,{recursive:true});
const database=new DatabaseSync(path.join(root,'arena.sqlite'));
database.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
for(const name of readdirSync(new URL('../drizzle/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort()){if(database.prepare('SELECT name FROM local_migrations WHERE name=?').get(name))continue;database.exec(readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));database.prepare('INSERT INTO local_migrations (name) VALUES (?)').run(name)}
const DB={prepare(sql){const stmt=database.prepare(sql);return{bind(...args){return{async first(){return stmt.get(...args)||null},async all(){return{results:stmt.all(...args)}},async run(){const r=stmt.run(...args);return{meta:{changes:r.changes}}}}},async all(){return{results:stmt.all()}}}}};
export async function matchRequest(req,url){let body='';if(req.method==='POST')for await(const chunk of req){body+=chunk;if(body.length>120000)throw Error('Squad too large')}const response=await worker.fetch(new Request(url,{method:req.method,headers:{...(req.headers['x-match-token']?{'x-match-token':req.headers['x-match-token']}:{}),'content-type':'application/json'},...(body?{body}:{})}),{DB});const data=await response.json();if(!response.ok)throw Error(data.error);return data}
