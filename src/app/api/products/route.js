import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * GET /api/products
 * List all product templates
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    let query = supabaseAdmin
      .from("product_templates")
      .select("*")
      .order("product_name", { ascending: true });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data: products, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      products: products || [],
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/products
 * Create a new product template
 */
export async function POST(request) {
  try {
    const body = await request.json();

    const {
      sku,
      product_name,
      category,
      personalization_type,
      personalization_notes,
      default_length_inches,
      default_width_inches,
      default_height_inches,
      default_weight_oz,
      sla_business_days,
      canva_template_url,
    } = body;

    if (!sku || !product_name) {
      return NextResponse.json(
        { error: "SKU and product name are required" },
        { status: 400 }
      );
    }

    // Check if SKU already exists
    const { data: existing } = await supabaseAdmin
      .from("product_templates")
      .select("id")
      .eq("sku", sku)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "A product with this SKU already exists" },
        { status: 409 }
      );
    }

    // Convert empty strings to null for numeric fields
    const numericFields = {
      default_length_inches:
        default_length_inches === "" ? null : default_length_inches,
      default_width_inches:
        default_width_inches === "" ? null : default_width_inches,
      default_height_inches:
        default_height_inches === "" ? null : default_height_inches,
      default_weight_oz: default_weight_oz === "" ? null : default_weight_oz,
      sla_business_days: sla_business_days === "" ? 5 : sla_business_days,
    };

    const { data: product, error } = await supabaseAdmin
      .from("product_templates")
      .insert({
        sku,
        product_name,
        category: category || null,
        personalization_type: personalization_type || "none",
        personalization_notes: personalization_notes || null,
        ...numericFields,
        canva_template_url: canva_template_url || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 }
    );
  }
}
