import { NextRequest, NextResponse } from 'next/server';
import * as memoryStore from '@/lib/history/memoryStore';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const item = memoryStore.getById(params.id);

  if (!item) {
    return NextResponse.json(
      { error: 'History item not found' },
      { status: 404 }
    );
  }

  return NextResponse.json(item);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  memoryStore.removeById(params.id);
  return NextResponse.json({ success: true });
}
