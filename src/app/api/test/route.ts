import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({ success: true, message: 'API is working!' });
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ success: true, message: 'POST is working!' });
}
