import { NextRequest, NextResponse } from 'next/server';

// In-memory storage (for demo)
let historyStore: any[] = [];

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const item = historyStore.find(item => item.id === params.id);

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
  historyStore = historyStore.filter(item => item.id !== params.id);
  return NextResponse.json({ success: true });
}