import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const text = searchParams.get("text")?.trim();
  const latitude = searchParams.get("latitude")?.trim();
  const longitude = searchParams.get("longitude")?.trim();

  if (!text) {
    return NextResponse.json(
      { error: "text parameter is required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.YELP_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Yelp API key not configured" },
      { status: 500 }
    );
  }

  const apiURL = process.env.YELP_API_URL ?? "";
  const url = new URL(apiURL);
  url.searchParams.set("text", text);

  if (latitude && longitude) {
    url.searchParams.set("latitude", latitude);
    url.searchParams.set("longitude", longitude);
  }

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Failed to fetch Yelp suggestions",
          status: response.status,
        },
        { status: 502 }
      );
    }

    const payload = await response.json();
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to reach Yelp API", details: String(error) },
      { status: 502 }
    );
  }
}
