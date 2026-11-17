// Verifica os contratos de import/export de todos os módulos, sem rede ou navegador.
const {SourceTextModule,SyntheticModule}=require('node:vm');
const {readFileSync,readdirSync}=require('node:fs');
const {resolve,dirname}=require('node:path');
const root=resolve(__dirname,'../public/js');
const cache=new Map();
function load(file){
 if(cache.has(file))return cache.get(file);
 const mod=new SourceTextModule(readFileSync(file,'utf8'),{identifier:file});cache.set(file,mod);return mod;
}
const remote=new SyntheticModule(['createClient'],function(){this.setExport('createClient',()=>({}));});
async function linker(spec,ref){
 if(spec.startsWith('https://esm.sh/@supabase/supabase-js@'))return remote;
 if(!spec.startsWith('./'))throw Error('Dependência externa não esperada: '+spec);
 return load(resolve(dirname(ref.identifier),spec));
}
(async()=>{
 for(const name of readdirSync(root).filter(n=>n.endsWith('.js')&&n!=='firebase-config.js')){
   const mod=load(resolve(root,name));if(mod.status==='unlinked')await mod.link(linker);
 }
 console.log('PASS: contratos de import/export de todos os módulos ativos');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
