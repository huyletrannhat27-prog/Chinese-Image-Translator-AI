import { NextRequest, NextResponse } from 'next/server';
import * as memoryStore from '@/lib/history/memoryStore';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  const { items, total } = memoryStore.getAll(limit, offset);

  return NextResponse.json({ items, total, limit, offset });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const newItem = memoryStore.add(body);
    return NextResponse.json(newItem, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to save history' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const id = searchParams.get('id');

  if (id) {
    memoryStore.removeById(id);
  } else {
    memoryStore.clear();
  }

  return NextResponse.json({ success: true });
}
