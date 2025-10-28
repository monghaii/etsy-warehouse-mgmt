import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/test-upload
 * Test endpoint for file uploads
 */
export async function POST(request) {
  try {
    console.log("Test upload - Headers:", {
      contentType: request.headers.get("content-type"),
      contentLength: request.headers.get("content-length"),
    });

    let formData;
    try {
      formData = await request.formData();
      console.log("FormData parsed successfully");
    } catch (parseError) {
      console.error("FormData parse error:", parseError);
      return NextResponse.json(
        {
          error: "Failed to parse form data",
          details: parseError.message,
        },
        { status: 400 }
      );
    }

    const file = formData.get("file");

    if (!file) {
      return NextResponse.json(
        { error: "No file provided in form data" },
        { status: 400 }
      );
    }

    console.log("File received:", {
      name: file.name,
      size: file.size,
      type: file.type,
    });

    return NextResponse.json({
      success: true,
      file: {
        name: file.name,
        size: file.size,
        type: file.type,
      },
    });
  } catch (error) {
    console.error("Test upload error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
