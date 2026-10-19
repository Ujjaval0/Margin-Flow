import { financialJson } from "@/lib/security/financial-response";
import { rejectCrossOrigin } from "@/lib/security/api-guard";
import { NextRequest,NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/security/session';
import { pool } from '@/lib/db';
import { readJsonBody,RequestBodyError } from '@/lib/security/request-body';
import { readCanonicalLedger } from '@/lib/canonical-ledger';
import { executeLedgerCommand } from '@/lib/ledger-records';
import type { LedgerCommand } from '@/domain/ledger-command';
import { z } from 'zod';
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v);
const money=z.number().finite().nonnegative().max(1e12).refine(v=>Math.abs(v*100-Math.round(v*100))<1e-7);
const requestSchema=z.object({requestId:z.string().min(1).max(500),command:z.discriminatedUnion('action',[
  z.object({action:z.literal('save'),collection:z.enum(['suppliers','purchases','expenses','returns','claims','aiDocuments']),record:z.unknown(),expected:z.unknown().optional()}),
  z.object({action:z.literal('deleteSupplier'),id:z.string().min(1)}),
  z.object({action:z.literal('paySupplier'),id:z.string().min(1),supplierId:z.string().min(1),date,amount:money.refine(v=>v>0),paymentMethod:z.string(),reference:z.string(),notes:z.string().optional()}),
  z.object({action:z.literal('restock'),id:z.string().min(1),date:date.optional()}),
  z.object({action:z.literal('importSnapshot'),snapshot:z.string().max(10*1024*1024)}),
  z.object({action:z.literal('approveDocument'),id:z.string().min(1)}),
  z.object({action:z.literal('productCost'),sku:z.string().min(1),cost:money,date,reason:z.string()}),
  z.object({action:z.literal('orderStatus'),ids:z.array(z.string()).min(1).max(1000),status:z.enum(['PENDING','CONFIRMED','SHIPPED','DELIVERED','CANCELLED']),date}),
])});
export async function GET(req:NextRequest) {
  const owner=await getSessionUserId(req); if(!owner)return financialJson({success:false,error:'Authentication required.'},{status:401});
  let client;
  try { client=await pool.connect();await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); const data=await readCanonicalLedger(client,owner);await client.query('COMMIT');return financialJson({success:true,data}); }
  catch {await client?.query('ROLLBACK').catch(()=>{});return financialJson({success:false,error:'Financial books are unavailable.'},{status:503});}
  finally {client?.release();}
}
export async function POST(req:NextRequest) {
  const originError=rejectCrossOrigin(req);if(originError)return originError;
  const owner=await getSessionUserId(req);if(!owner)return financialJson({success:false,error:'Authentication required.'},{status:401});
  try {
    const parsed=requestSchema.safeParse(await readJsonBody(req,10*1024*1024));
    if(!parsed.success)return financialJson({success:false,error:'Invalid financial command.'},{status:400});
    const client=await pool.connect();
    try {await client.query('BEGIN');const data=await executeLedgerCommand(client,owner,parsed.data.requestId,parsed.data.command as LedgerCommand);await client.query('COMMIT');return financialJson({success:true,data});}
    catch(error) {await client.query('ROLLBACK').catch(()=>{});return financialJson({success:false,error:error instanceof Error && !('code' in error)?error.message:'Financial mutation failed.'},{status:409});}
    finally {client.release();}
  } catch(error) {return financialJson({success:false,error:error instanceof RequestBodyError?error.message:'Financial books are unavailable.'},{status:error instanceof RequestBodyError?error.status:503});}
}
