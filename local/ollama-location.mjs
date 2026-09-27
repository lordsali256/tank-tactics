export const ollamaEndpoint=new URL(process.env.TANK_OLLAMA_ENDPOINT||'http://127.0.0.1:11434/api/chat');
if(!['127.0.0.1','localhost','[::1]'].includes(ollamaEndpoint.hostname)||ollamaEndpoint.protocol!=='http:'||ollamaEndpoint.pathname!=='/api/chat'||ollamaEndpoint.username||ollamaEndpoint.password||ollamaEndpoint.search||ollamaEndpoint.hash)throw Error('Configured Ollama endpoint must be a private loopback /api/chat URL.');
export const ollamaLocation=process.env.TANK_OLLAMA_LOCATION||'Ollama on this computer';
