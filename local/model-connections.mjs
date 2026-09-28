export function localHost(host){return ['localhost','127.0.0.1','[::1]'].includes(host)||/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)||/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)||/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)||/^\[f[cd][0-9a-f:]+\]$/i.test(host)}
export function modelEndpoint(input){
 if(!['ollama','compatible','gemini','openai'].includes(input.provider))throw Error('Choose a supported connection.');
 let url;try{url=new URL(input.endpoint)}catch{throw Error('Enter a valid model endpoint.')}
 if(url.username||url.password||url.hash||url.search||!['https:','http:'].includes(url.protocol)||url.protocol==='http:'&&!localHost(url.hostname))throw Error('Use HTTPS for providers, or HTTP on your device or private network. No credentials or query parameters in the URL.');
 if(input.provider==='gemini'){if(url.href!=='https://generativelanguage.googleapis.com/v1beta')throw Error('Use the official Google AI Studio endpoint.');if(!/^[a-zA-Z0-9._-]+$/.test(input.model||''))throw Error('Enter a Gemini model ID.');return url.href+'/models/'+encodeURIComponent(input.model)+':generateContent'}
 if(input.provider==='openai'){if(url.href!=='https://api.openai.com/v1/responses')throw Error('Use the official OpenAI Responses endpoint.');return url.href}
 if(input.provider==='ollama'){if(!localHost(url.hostname))throw Error('Ollama must use a device or private-network address.');if(url.pathname==='/')url.pathname='/api/chat';if(url.pathname!=='/api/chat')throw Error('Use the Ollama base address or /api/chat endpoint.')}
 else {if(url.pathname==='/'||url.pathname==='/v1'||url.pathname==='/v1/')url.pathname='/v1/chat/completions';if(!url.pathname.endsWith('/chat/completions'))throw Error('Use a compatible API base address or /chat/completions endpoint.')}
 return url.href;
}
export function modelListRequest(input){
 if(typeof input.key!=='string'||input.key.length>1000)throw Error('Invalid API key.');
 const url=new URL(modelEndpoint({...input,model:'model-list'}));
 if(['gemini','openai'].includes(input.provider)&&!input.key.trim())throw Error('Enter your provider API key to test the connection.');
 url.pathname=input.provider==='ollama'?'/api/tags':input.provider==='gemini'?'/v1beta/models':input.provider==='openai'?'/v1/models':url.pathname.replace(/\/chat\/completions$/,'/models');
 return {endpoint:url.href,headers:input.provider==='gemini'?{'x-goog-api-key':input.key}:input.provider!=='ollama'&&input.key?{authorization:'Bearer '+input.key}:{}};
}
export function modelNames(data,provider){const rows=provider==='ollama'||provider==='gemini'?data.models:data.data;return [...new Set((Array.isArray(rows)?rows:[]).filter(row=>provider!=='gemini'||row.supportedGenerationMethods?.includes('generateContent')).map(row=>String(row.name||row.id||'').replace(/^models\//,'')).filter(id=>id&&id.length<=120))].slice(0,100)}
export async function listModels(input,options={}){const request=modelListRequest(input),response=await (options.fetch||fetch)(request.endpoint,{headers:request.headers,redirect:'error',signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('Connection returned HTTP '+response.status+'. Check the address and API key.');const raw=await response.text();if(raw.length>1000000)throw Error('Model list is too large.');return{models:modelNames(JSON.parse(raw),input.provider)}}
