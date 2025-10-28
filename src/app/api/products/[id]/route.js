import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * PUT /api/products/[id]
 * Update a product template
 */
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
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
      is_active,
    } = body;

    // Check if product exists
    const { data: existing } = await supabaseAdmin
      .from("product_templates")
      .select("id, sku")
      .eq("id", id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // If SKU is being changed, check it doesn't conflict
    if (sku && sku !== existing.sku) {
      const { data: duplicate } = await supabaseAdmin
        .from("product_templates")
        .select("id")
        .eq("sku", sku)
        .neq("id", id)
        .single();

      if (duplicate) {
        return NextResponse.json(
          { error: "A product with this SKU already exists" },
          { status: 409 }
        );
      }
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
      .update({
        sku,
        product_name,
        category: category || null,
        personalization_type,
        personalization_notes: personalization_notes || null,
        ...numericFields,
        canva_template_url: canva_template_url || null,
        is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ product });
  } catch (error) {
    console.error("Error updating product:", error);
    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/products/[id]
 * Delete a product template
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    const { error } = await supabaseAdmin
      .from("product_templates")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting product:", error);
    return NextResponse.json(
      { error: "Failed to delete product" },
      { status: 500 }
    );
  }
}
