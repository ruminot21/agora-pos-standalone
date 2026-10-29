import {readdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const root='dist';
async function files(dir='') { const entries=await readdir(join(root,dir),{withFileTypes:true});let result=[];for(const e of entries){const p=join(dir,e.name).replaceAll('\\','/');if(e.isDirectory())result.push(...await files(p));else if(!p.endsWith('sw.js'))result.push('/'+p);}return result; }
const assets=await files();
const output=`const VERSION='agora-pos-v2-${Date.now()}';const ASSETS=${JSON.stringify(assets)};self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});self.addEventListener('activate',e=>{e.waitUntil(Promise.all([caches.keys().then(k=>Promise.all(k.filter(x=>x!==VERSION).map(x=>caches.delete(x)))),self.clients.claim()]));});self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).catch(()=>e.request.mode==='navigate'?caches.match('/index.html'):Response.error())));});`;
await writeFile(join(root,'sw.js'),output);console.log('Offline SW generated:',assets.length,'assets');
