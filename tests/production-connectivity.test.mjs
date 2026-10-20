import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { File } from 'node:buffer';
import crypto from 'node:crypto';
const load=createRequire(import.meta.url)('./helpers/load-app.cjs');
const owner='00000000-0000-4000-8000-000000000001';
const session='@/lib/security/session';

function storageHarness(){
  const objects=new Map(),calls=[];
  const api={
    createSignedUploadUrl:async(path,options)=>{calls.push(['sign-upload',path,options]);return{data:{token:'upload-token'},error:null};},
    upload:async(path,bytes,options)=>{objects.set(path,new Blob([bytes],{type:options.contentType}));return{error:null};},
    download:async path=>{calls.push(['download',path]);return{data:objects.get(path),error:objects.has(path)?null:{message:'not found'}};},
    createSignedUrl:async(path,expires)=>{calls.push(['sign-download',path,expires]);return{data:{signedUrl:'https://storage.example.test/signed'},error:null};},
  };
  const mocks={'@supabase/supabase-js':{createClient:(url,key,options)=>{
    assert.equal(key,'server-test-secret');assert.equal(options.auth.persistSession,false);
    return{storage:{from:bucket=>{assert.equal(bucket,'marginflow-private-documents');return api;}}};
  }}};
  const globals={process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://project.supabase.co',SUPABASE_SECRET_KEY:'server-test-secret'}}};
  return{objects,calls,api,mocks,globals,storage:load('src/lib/security/document-storage.ts',mocks,globals)};
}

test('private Storage uses owner-derived paths, immutable upload names and validated metadata',async()=>{
  const h=storageHarness(),bytes=Buffer.from('synthetic PDF');
  const target=await h.storage.signDocumentUpload(owner,{name:'bill.pdf',size:bytes.length,type:'application/pdf'});
  assert.ok(target.path.startsWith(crypto.createHash('sha256').update(owner).digest('hex')+'/'));
  assert.equal(h.calls[0][2].upsert,false);
  const name=await h.storage.storeDocument(owner,{name:'bill.pdf',size:bytes.length,type:'application/pdf'},bytes);
  const reference={name:'bill.pdf',size:bytes.length,type:'application/pdf',savedFileName:name};
  assert.equal((await h.storage.downloadDocument(owner,reference)).size,bytes.length);
  await assert.rejects(h.storage.downloadDocument('different-owner',reference),/unavailable/);
  await assert.rejects(h.storage.downloadDocument(owner,{...reference,size:bytes.length+1}),/metadata/);
  await assert.rejects(h.storage.downloadDocument(owner,{...reference,savedFileName:'../other.pdf'}),/Invalid/);
  const files=await h.storage.readDocumentInputs(new Request('https://app.test/api/upload-bill',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({documents:[reference]})}),owner,50);
  assert.equal(files.files[0].storedName,name);
  assert.equal(Buffer.from(await files.files[0].arrayBuffer()).toString(),'synthetic PDF');
  await h.storage.signDocumentDownload(owner,name);
  assert.equal(h.calls.at(-1)[2],60);
});

test('file validation rejects oversize, executable and prototype-named extensions',()=>{
  const {documentMetadata}=load('src/lib/document-files.ts');
  for(const file of [{name:'x.pdf',size:10485761,type:'application/pdf'}, {name:'x.html',size:1,type:'text/html'},
    {name:'x.constructor',size:1,type:''},{name:'../x.pdf',size:1,type:'application/pdf'}, {name:'x.pdf',size:1,type:'text/html'}])
    assert.throws(()=>documentMetadata(file.name,file.size,file.type));
  assert.equal(documentMetadata('report.csv',5,'application/vnd.ms-excel').type,'text/csv');
  assert.equal(documentMetadata('report.xlsx',5,'').type,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});

test('large browser uploads send only metadata to the app and bytes directly to Storage',async()=>{
  const file=new File([new Uint8Array(6*1024*1024)],'large.pdf',{type:'application/pdf'});
  let uploaded=false,body;
  const api=load('src/lib/document-upload.ts',{
    '@/lib/supabase/browser':{createSupabaseBrowserClient:()=>({storage:{from:()=>({uploadToSignedUrl:async(path,token,bytes)=>{
      assert.equal(bytes,file);assert.equal(token,'signed');uploaded=true;return{error:null};
    }})}})},
  },{fetch:async(url,request)=>{
    assert.equal(url,'/api/documents/upload');body=request.body;const metadata=JSON.parse(body).files[0];
    return Response.json({success:true,documents:[{...metadata,savedFileName:'a.pdf',path:'owner/a.pdf',token:'signed'}]});
  }});
  const references=await api.uploadDocumentFiles([file]);
  assert.ok(uploaded);assert.ok(body.length<1000);assert.equal(references[0].size,file.size);
  assert.equal('token' in references[0],false,'processing requests never repeat the upload token');
});

test('upload authorization rejects anonymous/cross-origin requests before signing',async()=>{
  let signs=0;
  const mocks={[session]:{getSessionUserId:async()=>null},'@/lib/security/document-storage':{
    signDocumentUpload:async()=>{signs++;return{};},DocumentStorageError:class extends Error{},
  }};
  let route=load('src/app/api/documents/upload/route.ts',mocks);
  assert.equal((await route.POST(new Request('https://app.test/api/documents/upload',{method:'POST'}))).status,401);
  route=load('src/app/api/documents/upload/route.ts',{...mocks,[session]:{getSessionUserId:async()=>owner}});
  assert.equal((await route.POST(new Request('https://app.test/api/documents/upload',{method:'POST',headers:{origin:'https://other.test'}}))).status,403);
  assert.equal(signs,0);
});

test('authorized document download redirects to short-lived Storage instead of proxying bytes',async()=>{
  let identity;
  const route=load('src/app/api/documents/stream/route.ts',{
    [session]:{getSessionUser:async()=>({sub:owner})},
    '@/lib/security/document-storage':{DocumentStorageError:class extends Error{},signDocumentDownload:async(who,name)=>{
      identity=who;assert.equal(name,'bill.pdf');return'https://storage.example.test/file?token=signed';
    }},
  });
  const response=await route.GET(new Request('https://app.test/api/documents/stream?file=bill.pdf'));
  assert.equal(identity,owner);assert.equal(response.status,307);
  assert.match(response.headers.get('location'),/storage.example.test/);
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.equal((await route.GET(new Request('https://app.test/api/documents/stream?file=..%2Fother.pdf'))).status,400);
});

test('Vercel dispatch runs in after() and cron recovery requires its own secret',async()=>{
  const scheduled=[],runs=[];
  const manager={runNextJob:async filter=>{runs.push(filter);return runs.length===1;}};
  const mocks={'next/server':{after:callback=>scheduled.push(callback)},'@/lib/queue/queue-manager':{queueManager:manager},'@/lib/queue/job-processors':{}};
  const dispatch=load('src/lib/queue/job-dispatch.ts',mocks,{process:{env:{VERCEL:'1'}}});
  dispatch.dispatchJob(owner,'job-id');assert.equal(runs.length,0);
  await scheduled[0]();assert.equal(runs[0].ownerId,owner);assert.equal(runs[0].jobId,'job-id');
  const cron=load('src/app/api/jobs/process/route.ts',{
    '@/lib/queue/queue-manager':{queueManager:manager},'@/lib/queue/job-processors':{},
  },{process:{env:{CRON_SECRET:'c'.repeat(64)}}});
  assert.equal((await cron.GET(new Request('https://app.test/api/jobs/process'))).status,401);
  assert.equal(runs.length,1);
  assert.equal((await cron.GET(new Request('https://app.test/api/jobs/process',{headers:{authorization:'Bearer '+'c'.repeat(64)}}))).status,200);
});

test('Vercel producers enqueue and dispatch supported work with the persistent worker disabled',async()=>{
  let queued=false,dispatched=false;
  const manager={isProcessingAvailable:()=>true,enqueue:async(type,payload,options)=>{
    assert.equal(options.ownerId,owner);queued=true;return{id:'job-id',status:'QUEUED'};
  }};
  const route=load('src/app/api/jobs/route.ts',{
    [session]:{getSessionUserId:async()=>owner},'@/lib/queue/queue-manager':{queueManager:manager},
    '@/lib/queue/job-processors':{},'@/lib/queue/job-dispatch':{dispatchJob:(who,id)=>{assert.equal(who,owner);assert.equal(id,'job-id');dispatched=true;}},
  },{process:{env:{VERCEL:'1',MARGINFLOW_JOB_WORKER:'0'}}});
  const response=await route.POST(new Request('https://app.test/api/jobs',{method:'POST',body:JSON.stringify({type:'GENERATE_FINANCIAL_REPORT',payload:{}})}));
  assert.equal(response.status,200);assert.ok(queued&&dispatched);
});
