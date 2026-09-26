#include <jni.h>
#include "llama.h"
#include <string>
#include <vector>
#include <mutex>
static llama_model *model=nullptr;
static std::mutex lock;
static std::string utf(JNIEnv *env,jstring value){const char *chars=env->GetStringUTFChars(value,nullptr);std::string s(chars);env->ReleaseStringUTFChars(value,chars);return s;}
extern "C" JNIEXPORT jstring JNICALL Java_com_tanktactics_promptarena_PhoneAI_infer(JNIEnv *env,jclass,jstring path,jstring input){
 std::lock_guard<std::mutex> guard(lock);auto modelPath=utf(env,path),instruction=utf(env,input);
 if(!model){llama_backend_init();auto params=llama_model_default_params();params.n_gpu_layers=0;model=llama_model_load_from_file(modelPath.c_str(),params);}
 if(!model)return env->NewStringUTF("{\"error\":\"Phone model failed to load\"}");
 const std::string prompt="<|im_start|>system\nCompile a unit tactic to JSON only. style: rush, balanced or sniper. preferred: range 100 to 450. cover, evade, retreat: booleans. coverBelow, retreatBelow: hull fraction 0 to 1. firePolicy: always, inRange or stationary. explanation: short sentence. Rush range 145, sniper 360, balanced 255. Respect explicit numeric range and percentages. Only request actions in enabled commands. If the user requests sniper or keeping distance, choose sniper. If the user specifies 360 range, preferred must be 360.\n<|im_end|>\n<|im_start|>user\nRush at 145 range and fire aggressively.\n<|im_end|>\n<|im_start|>assistant\n{\"style\":\"rush\",\"preferred\":145,\"cover\":false,\"coverBelow\":0.5,\"evade\":false,\"retreat\":false,\"retreatBelow\":0.25,\"firePolicy\":\"always\",\"explanation\":\"Close range and attack\"}<|im_end|>\n<|im_start|>user\nKeep sniper distance at 360 range and fire in range.\n<|im_end|>\n<|im_start|>assistant\n{\"style\":\"sniper\",\"preferred\":360,\"cover\":false,\"coverBelow\":0.5,\"evade\":false,\"retreat\":false,\"retreatBelow\":0.25,\"firePolicy\":\"inRange\",\"explanation\":\"Keep distance and fire at range\"}<|im_end|>\n<|im_start|>user\n"+instruction+"<|im_end|>\n<|im_start|>assistant\n";
 const auto *vocab=llama_model_get_vocab(model);int count=-llama_tokenize(vocab,prompt.c_str(),prompt.size(),nullptr,0,true,true);if(count<=0||count>1700)return env->NewStringUTF("{\"error\":\"Instruction too long\"}");
 std::vector<llama_token> tokens(count);llama_tokenize(vocab,prompt.c_str(),prompt.size(),tokens.data(),count,true,true);auto cp=llama_context_default_params();cp.n_ctx=2048;cp.n_batch=2048;cp.n_threads=4;cp.n_threads_batch=4;auto *ctx=llama_init_from_model(model,cp);if(!ctx)return env->NewStringUTF("{\"error\":\"Not enough memory for model\"}");
 const char *grammar=R"(root ::= "{" ws "\"style\"" ws ":" ws ("\"rush\"" | "\"balanced\"" | "\"sniper\"") ws "," ws "\"preferred\"" ws ":" ws number ws "," ws "\"cover\"" ws ":" ws boolean ws "," ws "\"coverBelow\"" ws ":" ws number ws "," ws "\"evade\"" ws ":" ws boolean ws "," ws "\"retreat\"" ws ":" ws boolean ws "," ws "\"retreatBelow\"" ws ":" ws number ws "," ws "\"firePolicy\"" ws ":" ws ("\"always\"" | "\"inRange\"" | "\"stationary\"") ws "," ws "\"explanation\"" ws ":" ws string ws "}"
number ::= [0-9]{1,3} ("." [0-9]{1,2})?
boolean ::= "true" | "false"
string ::= "\"" [a-zA-Z0-9 .,%-]{0,80} "\""
ws ::= [ \t\n]?
)";
 auto *sampler=llama_sampler_chain_init(llama_sampler_chain_default_params());auto *grammarSampler=llama_sampler_init_grammar(vocab,grammar,"root");if(!grammarSampler){llama_free(ctx);llama_sampler_free(sampler);return env->NewStringUTF("{\"error\":\"Model grammar failed\"}");}llama_sampler_chain_add(sampler,grammarSampler);llama_sampler_chain_add(sampler,llama_sampler_init_greedy());
 auto batch=llama_batch_get_one(tokens.data(),tokens.size());std::string output;llama_token token;
 for(int i=0;i<230;i++){if(llama_decode(ctx,batch)!=0)break;token=llama_sampler_sample(sampler,ctx,-1);if(llama_vocab_is_eog(vocab,token))break;char piece[1024];int n=llama_token_to_piece(vocab,token,piece,sizeof(piece),0,true);if(n>0)output.append(piece,n);batch=llama_batch_get_one(&token,1);}
 llama_sampler_free(sampler);llama_free(ctx);return env->NewStringUTF(output.c_str());
}

