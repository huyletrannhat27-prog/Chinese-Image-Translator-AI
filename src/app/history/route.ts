import { NextRequest, NextResponse } from 'next/server';

// In-memory storage (for demo)
// In production, use a database
let historyStore: any[] = [];

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  const items = historyStore.slice(offset, offset + limit);
  const total = historyStore.length;

  return NextResponse.json({
    items,
    total,
    limit,
    offset,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const newItem = {
      id: `hist_${Date.now()}`,
      ...body,
      createdAt: new Date().toISOString(),
    };

    historyStore.unshift(newItem);

    // Limit history size
    if (historyStore.length > 15000) {
      historyStore = historyStore.slice(0, 15000);
    }

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
    historyStore = historyStore.filter(item => item.id !== id);
  } else {
    historyStore = [];
  }

  return NextResponse.json({ success: true });
}