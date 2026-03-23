import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: { message: "ANTHROPIC_API_KEY not configured. Check .env.local" } }, { status: 500 });
  }

  const pin = process.env.ACCESS_PIN;
  if (pin) {
    const authPin = req.headers.get("x-access-pin");
    if (authPin !== pin) {
      return NextResponse.json({ error: { message: "Invalid access PIN" } }, { status: 401 });
    }
  }

  try {
    const body = await req.json();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: body.model || "claude-sonnet-4-20250514",
        max_tokens: body.max_tokens || 4096,
        messages: body.messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[API Error]", response.status, JSON.stringify(data).slice(0, 500));
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (e: any) {
    console.error("[Server Error]", e.message);
    return NextResponse.json({ error: { message: e.message || "Server error" } }, { status: 500 });
  }
}
