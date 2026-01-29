import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = 'http://172.19.0.4:8000';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjA5NDU5MjAwLCJleHAiOjE5MjQ5OTIwMDB9.2vZc2vuKzNV85KPBVnCquWVJ3geuRhPIMXMPdxxNdA8';

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const url = new URL(request.url);
  const targetUrl = `${SUPABASE_URL}/rest/v1/${path.join('/')}${url.search}`;
  
  const res = await fetch(targetUrl, {
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  
  const data = await res.json();
  return NextResponse.json(data);
}
