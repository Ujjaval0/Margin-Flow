// Local compiled production server, unauthenticated boundaries only. No database health/writes.
process.env.NODE_ENV='production';
const http=require('node:http');
const next=require('next');
const assert=require('node:assert/strict');
async function main() {
  const app=next({dev:false,dir:process.cwd(),conf:{distDir:'.next-financial-release-accepted'}});
  let server;
  try {
    await app.prepare();const handle=app.getRequestHandler();
    server=http.createServer((req,res)=>handle(req,res));
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+server.address().port;
    let checked=0;
    for(const route of ['ledger-records','orders','products','settlements','recycle-bin']) {
      const response=await fetch(base+'/api/'+route,{headers:{'x-user-id':'forged-owner'},redirect:'manual',signal:AbortSignal.timeout(15000)});
      assert.equal(response.status,401,route+' unauthenticated access');assert.match(response.headers.get('cache-control'),/no-store/);checked++;
    }
    const cross=await fetch(base+'/api/ledger-records',{method:'POST',headers:{origin:'https://untrusted.example','content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});
    assert.equal(cross.status,403);checked++;
    console.log(JSON.stringify({productionServer:true,checks:checked,passed:checked,databaseWrites:0,scope:'Unauthenticated and cross-origin compiled-route smoke checks only'}));
  }finally{if(server)await new Promise(resolve=>server.close(resolve));await app.close();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
