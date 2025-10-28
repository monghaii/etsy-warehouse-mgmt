import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * GET /api/orders
 * List orders with filters and pagination
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // For proper sorting with needs_review priority, we need to fetch ALL matching orders
    // then sort and paginate in JavaScript
    let query = supabaseAdmin.from("orders").select("*, stores(store_name)");

    // Apply filters
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (search) {
      query = query.or(
        `order_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_email.ilike.%${search}%,product_sku.ilike.%${search}%,product_name.ilike.%${search}%`
      );
    }

    // Sort by date in the database as a baseline
    query = query.order("order_date", { ascending: false });

    const { data: orders, error } = await query;

    if (error) throw error;

    // If there's a search term, also filter by personalization in raw_order_data
    let filteredOrders = orders || [];
    if (search) {
      const searchLower = search.toLowerCase();
      filteredOrders = filteredOrders.filter((order) => {
        // Check if already matched by the DB query
        const matchedByDB =
          order.order_number?.toLowerCase().includes(searchLower) ||
          order.customer_name?.toLowerCase().includes(searchLower) ||
          order.customer_email?.toLowerCase().includes(searchLower) ||
          order.product_sku?.toLowerCase().includes(searchLower) ||
          order.product_name?.toLowerCase().includes(searchLower);

        if (matchedByDB) return true;

        // Check personalization in raw_order_data
        try {
          const variations =
            order.raw_order_data?.transactions?.[0]?.variations || [];
          return variations.some((v) => {
            const name = v.formatted_name?.toLowerCase() || "";
            const value = v.formatted_value?.toLowerCase() || "";
            return name.includes(searchLower) || value.includes(searchLower);
          });
        } catch (e) {
          return false;
        }
      });
    }

    // Sort orders: needs_review first, then by date (newest first)
    filteredOrders.sort((a, b) => {
      // Needs_review orders always come first
      if (a.status === "needs_review" && b.status !== "needs_review") return -1;
      if (a.status !== "needs_review" && b.status === "needs_review") return 1;

      // Otherwise sort by date (newest first)
      return new Date(b.order_date) - new Date(a.order_date);
    });

    // Apply pagination AFTER sorting
    const paginatedOrders = filteredOrders.slice(offset, offset + limit);

    return NextResponse.json({
      orders: paginatedOrders,
      total: filteredOrders.length, // Use filtered count, not original DB count
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
