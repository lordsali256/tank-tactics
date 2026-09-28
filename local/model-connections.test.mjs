import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import http from 'node:http';
import {modelEndpoint,modelListRequest,modelNames,listModels} from './model-connections.mjs';
import {generateCoach,decodeCoachReply} from './coach.mjs';

for(const endpoint of ['http://10.0.0.2:11434','http://172.16.0.2:11434','http://192.168.1.50:11434','http://localhost:11434'])assert.equal(modelEndpoint({provider:'ollama',endpoint}),endpoint+'/api/chat');
assert.throws(()=>modelEndpoint({provider:'ollama',endpoint:'http://public.example:11434'}));
assert.equal(modelEndpoint({provider:'compatible',endpoint:'http://localhost:1234/v1'}),'http://localhost:1234/v1/chat/completions');
assert.equal(modelEndpoint({provider:'compatible',endpoint:'https://api.example/v1'}),'https://api.example/v1/chat/completions');
assert.equal(modelListRequest({provider:'gemini',endpoint:'https://generativelanguage.googleapis.com/v1beta',key:'fixture'}).headers['x-goog-api-key'],'fixture');
assert.equal(modelListRequest({provider:'openai',endpoint:'https://api.openai.com/v1/responses',key:'fixture'}).endpoint,'https://api.openai.com/v1/models');
assert.deepEqual(modelNames({models:[{name:'models/chat',supportedGenerationMethods:['generateContent']},{name:'embed',supportedGenerationMethods:['embedContent']}]},'gemini'),['chat']);

const requests=[],model=http.createServer((req,res)=>{requests.push({method:req.method,path:req.url});res.setHeader('Content-Type','application/json');res.end(JSON.stringify({models:[{name:'player-model'},{name:'player-model'}]}))});
await new Promise(resolve=>model.listen(0,'127.0.0.1',resolve));
try{assert.deepEqual(await listModels({provider:'ollama',endpoint:'http://127.0.0.1:'+model.address().port,key:''}),{models:['player-model']});assert.deepEqual(requests,[{method:'GET',path:'/api/tags'}])}finally{await new Promise(resolve=>model.close(resolve))}

const nodes=new Map(),node=()=>({value:'',textContent:'',children:[],replaceChildren(){this.children=[]},append(x){this.children.push(x)}}),get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)};
get('coachProvider').value='ollama';get('coachRoute').value='device';get('coachEndpoint').value='http://localhost:11434';
const script='def tick(unit, squad):\n    unit.focus("nearest")',input={provider:'ollama',endpoint:'http://localhost:11434',route:'device',model:'player-model',key:'',enabled:true,units:[{id:'owned-1',type:'tank',tier:1,script}],squadScript:'',report:{round:1,units:[]}},calls=[];
let draft={scripts:[{id:'owned-1',script}],summary:'Fixture tactics'};
const context=vm.createContext({$:get,document:{createElement:node},window:{location:{origin:'http://game.example:8878'}},coachSettings:input,openCoachSettings(){},AbortSignal,fetch:async(url,options)=>{
 calls.push({url,options});const body=options.body?JSON.parse(options.body):null;
 if(url==='/api/coach/models/request')return Response.json(modelListRequest(body));
 if(url==='http://localhost:11434/api/tags')return Response.json({models:[{name:'player-model'}]});
 if(url==='/api/coach/prepare')return Response.json(await generateCoach(body,{prepareOnly:true}));
 if(url==='http://localhost:11434/api/chat'){assert.ok(body.messages[0].content.includes('unit.seek_health'));assert.equal(body.model,'player-model');return Response.json({message:{content:JSON.stringify(draft)}})}
 if(url==='/api/coach/validate')return Response.json(decodeCoachReply(body.response,await generateCoach(body,{prepareOnly:true})));
 if(url==='/api/coach')return Response.json({scripts:[],summary:'Server route'});
 throw Error('Unexpected request '+url);
}});
vm.runInContext(fs.readFileSync('client/model-connector.js','utf8'),context);
assert.equal(calls.length,0,'Opening the game must not call a model');
assert.match(get('coachCorsCommand').textContent,/http:\/\/game.example:8878/);
await get('testCoachConnection').onclick();assert.match(get('coachTestStatus').textContent,/Connected.*1 models/);assert.equal(get('coachModel').value,'player-model');assert.equal(calls[1].options.body,undefined,'Discovery must not send a battle report');
context.input=input;context.signal=new AbortController().signal;
const reply=await vm.runInContext('callChosenCoach(input,signal)',context);assert.equal(reply.scripts[0].id,'owned-1');assert.deepEqual(calls.slice(2).map(x=>x.url),['/api/coach/prepare','http://localhost:11434/api/chat','/api/coach/validate']);
draft={scripts:[{id:'unowned',script}],summary:'Cheat'};await assert.rejects(()=>vm.runInContext('callChosenCoach(input,signal)',context),/unknown/);
context.input={...input,route:'server'};await vm.runInContext('callChosenCoach(input,signal)',context);assert.equal(calls.at(-1).url,'/api/coach');
context.fetch=async()=>{throw Error('CORS blocked')};await get('testCoachConnection').onclick();assert.match(get('coachTestStatus').textContent,/CORS blocked/);assert.equal(get('testCoachConnection').disabled,false);
console.log('Generic model discovery, LAN URLs, provider authentication, direct-browser routing, full guide, reply validation and explicit server routing passed.');
