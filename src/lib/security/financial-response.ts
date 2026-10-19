import { NextResponse } from 'next/server';
/** Authenticated books must never be reused by shared browser/CDN caches. */
export function financialJson(body:unknown,init:ResponseInit={}) {
  const response=NextResponse.json(body,init);
  response.headers.set('Cache-Control','private, no-store');
  return response;
}
