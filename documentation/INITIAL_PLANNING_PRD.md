# Etsy Store Management SaaS - Product Requirements Document

## 1. Executive Summary

A Next.js-based order fulfillment management system for custom product businesses selling on Etsy (and eventually Shopify). The system automates order ingestion, custom asset collection, design generation, production tracking, shipping label creation, and delivery monitoring across multiple storefronts.

**Primary Goal:** Streamline the end-to-end fulfillment process from order placement to delivery for custom-designed products (blankets, pillows, etc.) sold across multiple Etsy stores.

---

## 2. Technical Architecture

### 2.1 Tech Stack

- **Frontend/Backend:** Next.js 14+ (App Router)
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Serverless Functions:** Vercel Functions + Supabase Edge Functions
- **Storage:** Supabase Storage (for customer-uploaded images)
- **Real-time:** Supabase Realtime (optional for live order updates)
- **External APIs:**
  - Etsy API (OAuth2 with personal API tokens)
  - Canva API (for design generation)
  - ShipStation API (for label generation)
  - Future: Shopify API
- **Hosting:** Vercel (frontend/backend), Supabase (database/auth/storage)

### 2.2 Supabase Integration

**Key Features:**

- PostgreSQL database with Row Level Security (RLS)
- Built-in authentication with email/password
- File storage for customer uploads
- Real-time subscriptions for live updates (optional)
- Edge Functions for serverless operations
- Automatic API generation from database schema

**Client Setup:**

```javascript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
```

**Database Access:**

- Use Supabase JavaScript client for all database operations
- Leverage built-in query builder and TypeScript types
- Implement Row Level Security policies for data protection
- Use database triggers for automated workflows (status changes, timestamps)

---

## 3. User Roles & Personas

### 3.1 Admin

- Full system access
- Manages store API tokens
- Views all orders and metrics
- Can perform any action

### 3.2 Designer (VA)

- Creates Canva designs from daily assignments
- Flags completed designs
- Flags orders that need review
- Works primarily with the "Ready for Design" queue

### 3.3 Warehouse User

- Prints designs
- Marks items as produced
- Generates shipping labels
- Scans packages for shipment
- Modifies package dimensions/weights

### 3.4 Customer (External)

- Submits custom design assets via public form
- Provides order number and required customization info

---

## 4. Core Features & User Stories

## 4.1 Authentication & Security

### Feature: Supabase Authentication

**User Story:** As a system user, I want secure email/password authentication so I can access the system based on my role.

**Requirements:**

- Email/password authentication via Supabase Auth
- Role-based access control (admin, designer, warehouse)
- Secure session management (handled by Supabase)
- Automatic token refresh
- Password reset functionality
- Email verification (optional, can be disabled for internal users)
- Logout functionality
- Protected routes based on authentication status
- Role-based page access restrictions

**Technical Notes:**

- Use Supabase Auth for all authentication
- Store user role in `users` table (custom field)
- Session managed automatically by Supabase (JWT in localStorage/cookies)
- Next.js middleware to verify authentication on protected routes
- Use `supabase.auth.getSession()` to check auth state
- Implement `supabase.auth.onAuthStateChange()` for real-time auth updates

**Example Implementation:**

```javascript
// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: "user@example.com",
  password: "password",
});

// Get current user
const {
  data: { user },
} = await supabase.auth.getUser();

// Sign out
await supabase.auth.signOut();

// Middleware protection (middleware.ts)
const {
  data: { session },
} = await supabase.auth.getSession();
if (!session) {
  return NextResponse.redirect("/login");
}
```

---

## 4.2 Multi-Store Order Ingestion

### Feature: Automated Etsy Order Polling

**User Story:** As a business owner, I want orders from all my Etsy stores automatically imported so I don't have to manually track them.

**Requirements:**

- Support unlimited Etsy stores via API tokens
- Cron job (every 5-15 minutes) to poll Etsy API for new orders
- Store configuration page to add/edit/remove API tokens
- Automatic deduplication (don't import same order twice)
- Handle Etsy API rate limits gracefully
- Log import failures for debugging
- Store raw Etsy order data for reference

**Technical Notes:**

- Use Vercel Cron Jobs
- Etsy API: `GET /v3/application/shops/{shop_id}/receipts`
- Store last sync timestamp per store
- Use order receipt_id as unique identifier

**Database Fields Needed:**

- Store configuration (store_id, store_name, api_token, last_sync)
- Order source tracking (platform, store_id, external_order_id)

---

## 4.3 Order Lifecycle Management

### Feature: Order Tracking from Purchase to Delivery

**User Story:** As an admin, I want to see every order's current status so I can identify bottlenecks and ensure timely fulfillment.

**Order Statuses:**

1. `pending_enrichment` - Order imported, awaiting customer asset submission
2. `enriched` - Customer assets submitted, ready for design
3. `needs_review` - VA flagged order for review (bad assets, unclear instructions, etc.)
4. `ready_for_design` - Canva links generated, waiting for VA
5. `design_complete` - Design finished, ready to print
6. `labels_generated` - Shipping labels created (scanned barcode → label printed)
7. `loaded_for_shipment` - Package scanned by loader, ready for truck
8. `in_transit` - Package with carrier
9. `delivered` - Package delivered to customer
10. `late` - Flagged as delayed
11. `cancelled` - Order cancelled

**Note:** Orders can move between statuses based on flags:

- From `enriched` → `needs_review` (VA flags issue)
- From `needs_review` → `enriched` (issue resolved)

**Requirements:**

- Clear status pipeline visualization
- Filterable order views by status
- Status change logging (audit trail)
- Automatic status progression where possible
- Manual status override capability
- Status-based notifications/alerts

---

## 4.4 Customer Asset Collection

### Feature: Public Form for Custom Design Submission

**User Story:** As a customer, I want to easily submit my custom design and text so my product can be personalized.

**Requirements:**

- Public-facing form (no authentication required)
- Fields:
  - Order number (required, validated)
  - Email (required, for confirmation)
  - Custom text fields (product-dependent)
  - Image upload (supports PNG, JPG, JPEG, max 10MB)
  - Additional notes/instructions
- Order number validation:
  - Check if order exists in system
  - Check if already enriched (prevent duplicates)
  - Flag suspicious entries (wrong format, non-existent orders)
- File upload to Supabase Storage
  - Store in organized buckets (e.g., `customer-uploads/{order_id}/`)
  - Generate signed URLs for secure access
  - Alternative: Use Tally.so or Fillout for simpler form management (they handle uploads)
- Confirmation message upon successful submission

**Technical Notes:**

- Use Next.js API route for form submission
- Validate order number against Supabase database
- Upload files to Supabase Storage bucket
- Store file URLs in `orders` table (`custom_images` JSONB field)
- Rate limiting to prevent spam
- Captcha consideration for production (Turnstile, reCAPTCHA)

**Example Supabase Storage Implementation:**

```javascript
// Upload file
const { data, error } = await supabase.storage
  .from("customer-uploads")
  .upload(`${orderId}/${fileName}`, file);

// Get public URL
const {
  data: { publicUrl },
} = supabase.storage
  .from("customer-uploads")
  .getPublicUrl(`${orderId}/${fileName}`);
```

**Database Fields Needed:**

- Enrichment data (custom_text, uploaded_images, submission_timestamp)
- Enrichment status (pending, enriched, needs_review)
- Customer submission email

---

### Feature: Flag Order for Review & Resolution

**User Story:** As a VA, I want to flag orders with problematic assets so they can be fixed before I spend time on design work.

**Purpose:**

Sometimes customer submissions have issues:

- Poor quality images
- Wrong file format
- Unclear instructions
- Missing information
- Copyright concerns

VAs need a way to flag these orders and get them resolved before proceeding with design.

**Requirements:**

**Flagging Workflow:**

- VA reviews enriched orders before starting design
- "Flag for Review" button on each order
- Select reason:
  - Poor image quality
  - Wrong file format
  - Missing information
  - Unclear instructions
  - Copyright concern
  - Other (with notes)
- Add detailed notes about the issue
- Order moves to `needs_review` status
- Order removed from design queue

**Resolution Workflow:**

Three ways to resolve flagged orders:

1. **Customer Resubmission:**

   - Admin/support contacts customer
   - Customer resubmits via enrichment form
   - System updates existing order (replaces assets)
   - Status changes: `needs_review` → `enriched`
   - Order returns to design queue

2. **Manual Fix:**

   - Admin/support fixes issue (e.g., converts file format, crops image)
   - Upload corrected assets to order
   - Add resolution notes
   - Click "Resolve" button
   - Status changes: `needs_review` → `enriched`
   - Order returns to design queue

3. **Cancel Order:**
   - If unfixable or customer unresponsive
   - Mark order as cancelled
   - Status changes: `needs_review` → `cancelled`

**UI/UX:**

- `/enrichment-review` - Review flagged orders dashboard

  - List of all `needs_review` orders
  - Show flag reason and notes
  - Upload new assets
  - Add resolution notes
  - "Resolve" button
  - "Cancel Order" button
  - Contact customer link (pre-fills email)

- Order detail page shows:
  - Flag history (who, when, why)
  - Resolution history
  - Current status

**Technical Notes:**

- Store flag history in separate table (audit trail)
- Allow file replacement in Supabase Storage
- Validate resolution before changing status

**Database Fields Needed:**

- needs_review flag (boolean)
- review_reason (enum or text)
- review_notes (text)
- flagged_by (user_id)
- flagged_at (timestamp)
- resolved_by (user_id)
- resolved_at (timestamp)
- resolution_notes (text)

---

## 4.5 Design Generation & VA Workflow

### Feature: Daily Canva Link Generation per Product

**User Story:** As a VA, I want one Canva link per product per day so I can efficiently create all designs for that product size in one file.

**Product Definition:**

A "product" is defined by its **SIZE/DIMENSIONS**, not by custom design content:

- Example: "10x10 blanket" is ONE product
- Example: "20x20 blanket" is a DIFFERENT product
- Example: "30x40 pillow" is a DIFFERENT product
- Each product has a specific physical dimension (e.g., 10x10 inches)

**Daily Canva File Structure:**

- **One Canva file per product per day**
- Each Canva file contains ALL orders for that product size on that day
- Each order becomes a separate page within the Canva file
- Example: If 15 customers order 10x10 blankets today, they all go in ONE Canva file with 15 pages

**Requirements:**

- Automated daily job (runs at midnight) to generate Canva files
- Group orders by product (size/dimensions) for the current day
- Create one Canva file per product via Canva API
- Each order = one page in the Canva file
- Pre-populate each page with customer's custom text/images
- Generate shareable Canva edit link
- Store Canva link in `product_design_groups` table
- VA dashboard showing:
  - List of products needing design (grouped by size)
  - Canva link for each product
  - Number of orders (pages) in each file
  - Checkbox to mark product as complete
- Marking complete updates all orders for that product to `design_complete`

**Technical Notes:**

- Canva API: Create multi-page design from template
- One page per order within the product's Canva file
- Store Canva design_id and edit_url in database
- Link orders to their product's Canva file
- **Cron job at 00:00 Pacific Time (America/Los_Angeles timezone)**
- Handle API failures gracefully

**Database Fields Needed:**

- Product template mapping
- Canva design_id and edit_url
- Design completion status
- VA assignment (future: track which VA worked on it)

---

### Feature: Generate Metadata Image

**User Story:** As a designer/VA, I want to generate a metadata image for each order that contains shipping and identification information to be placed in the design margins.

**Purpose:**

The metadata image serves as an embedded label within the design that contains:

- Ship-to name and address
- Order ID
- Barcode representing the order ID (for scanning)

This image is placed in the **cut-out margins** of the design (non-visible area after production), so it travels with the product through production and enables easy identification and shipping label generation.

**Requirements:**

- Button in VA/designer interface: "Generate Metadata Image"
- Generate for each order/page in the Canva file
- Metadata image contents:
  - Order ID (large, readable text)
  - Customer ship-to name
  - Complete shipping address (formatted)
  - 1D barcode encoding the order ID (Code 128 or similar)
  - White background, black text for maximum contrast
- Image dimensions: Configurable (e.g., 2"x4" or 3"x3")
- Download as PNG or PDF
- Designer manually places this in Canva margin area
- Optional: Batch generate for all orders in current Canva file

**Technical Notes:**

- Use barcode generation library (e.g., `jsbarcode`, `bwip-js`)
- Generate barcode from order ID
- Use Canvas API or image generation library to compose image
- Format: High-resolution PNG (300 DPI for print quality)
- Include human-readable order ID beneath barcode

**Example Output:**

```
┌──────────────────────────┐
│                          │
│    ORDER #12345          │
│                          │
│  ||||||||||||||||||||    │  ← Barcode
│                          │
│  Ship To:                │
│  John Doe                │
│  123 Main Street         │
│  Apt 4B                  │
│  New York, NY 10001      │
│                          │
└──────────────────────────┘
```

**Database Fields Needed:**

- metadata_image_generated flag (boolean)
- metadata_image_url (link to generated image)

---

## 4.6 Production & Printing Workflow

### Feature: Warehouse Production Tracking

**User Story:** As a warehouse user, I want to track which designs are printed and packed so nothing gets missed.

**Requirements:**

- Print queue view filtered by `design_complete` status
- Printer integration considerations:
  - Epson sublimation printer workflow
  - Color profile management
  - Print queue optimization
  - [Placeholder: Define printer API integration if available]
- Mark individual items as "printing" → "produced"
- Bulk actions (select multiple orders to mark as produced)
- Package configuration:
  - Default dimensions and weight per product type
  - Override capability for actual measurements
  - Validation (weight/dimensions must be > 0)
- Production notes field (for issues/quality concerns)
- Production timestamp logging

**Technical Notes:**

- Consider print job batching for efficiency
- Store production metadata (who, when, any issues)

**Database Fields Needed:**

- Production status
- Package dimensions (length, width, height in inches)
- Package weight (in oz or lbs)
- Dimension/weight override flags
- Production notes
- Produced by user_id
- Produced timestamp

---

### Feature: Assemble Printing Roll

**User Story:** As a warehouse user, I want to combine all designs from a product's daily Canva file into one optimized printing roll so I can print efficiently without wasting material.

**Purpose:**

Products come in various sizes (10x10", 20x20", 30x40", etc.) and need to be printed on a continuous roll of sublimation paper. This feature solves the **2D bin packing problem** to arrange all designs for one product onto a roll with minimal waste.

**Requirements:**

- **Input Configuration:**

  - Select product (e.g., "10x10 blanket")
  - Specify roll width (e.g., 44 inches)
  - Specify segment length (e.g., 60 inches per segment for cutting)
  - Optional: Specify spacing/margin between designs (e.g., 0.5 inches)

- **Processing:**

  - Fetch all pages from the product's Canva file for the day
  - Each page represents one order's design at exact dimensions (e.g., 10x10 inches)
  - Algorithm arranges designs optimally on the roll:
    - Minimize wasted space
    - Respect roll width constraint
    - Partition into segments for easy cutting
    - Maintain design orientation
  - Generate visual preview of roll layout

- **Output:**

  - Combined PDF or high-resolution image of entire roll
  - Print-ready at correct dimensions (300 DPI)
  - Segment markers (dashed lines) for cutting
  - Order ID labels on each design for tracking
  - Download or send directly to printer

- **Algorithm Considerations:**
  - **Bin packing algorithm:** 2D rectangular packing (First Fit Decreasing Height, Guillotine, or Shelf algorithms)
  - Handle rotation if designs can be printed sideways
  - Account for minimum margins between designs
  - Optimize for material usage percentage

**Example Use Case:**

```
Daily orders for 10x10 blanket:
- 15 orders (15 pages in Canva)
- Roll width: 44 inches
- Segment length: 60 inches

Algorithm fits:
- 4 designs per row (10" × 4 + margins = ~43")
- 5 rows per segment (10" × 5 + margins = ~55")
- Result: 20 designs per segment
- Total: 1 segment needed (with 5 empty spots)
- Material efficiency: 75%
```

**Technical Notes:**

- Use 2D bin packing library or algorithm:
  - JavaScript: `binpackingjs`, `potpack`
  - Custom implementation for rectangular packing
- Canva API: Export each page as high-resolution image
- Image manipulation: Use `sharp`, `jimp`, or Canvas API
- Generate composite image with all designs arranged
- Add cut lines and order ID annotations
- Output as PDF (print-ready) or PNG

**Database Fields Needed:**

- print_roll_generated flag
- print_roll_url (link to generated roll file)
- print_roll_metadata (JSONB: layout info, efficiency stats)

**UI/UX:**

- Page: `/production/assemble-roll`
- Select product from dropdown
- Configure roll dimensions
- Click "Generate Roll"
- Show progress indicator
- Display preview with:
  - Visual layout
  - Material efficiency percentage
  - Number of segments
  - Order IDs on each design
- Download button for PDF/image

---

## 4.7 Shipping Label Generation

### Feature: Scan-to-Generate Shipping Label

**User Story:** As a warehouse user, I want to scan a barcode on the finished product to automatically purchase and print the shipping label so I can quickly process orders.

**Workflow:**

1. Product is printed (includes metadata image with barcode)
2. Warehouse user scans the barcode (order ID) using barcode scanner
3. System automatically:
   - Looks up order by ID
   - Retrieves shipping address and package dimensions
   - Calls ShipStation API to purchase shipping label
   - Downloads label PDF
   - **Automatically sends to printer** (if configured)
   - Updates order status to `labels_generated`
   - Updates Etsy with tracking number
4. User applies printed label to package
5. Done!

**Requirements:**

- Dedicated scanning interface: `/shipping/scan-to-label`
- Auto-focused input field (keyboard wedge scanner)
- Scan barcode → trigger label generation
- Real-time feedback:
  - Success: "Label generated for Order #12345"
  - Error: "Order not found" or "Label already generated"
  - Visual + audio confirmation
- Automatic label generation via ShipStation API
- **Auto-print capability:**
  - Configure default printer in settings
  - Use browser print API or direct printer integration
  - Fallback: Download PDF if auto-print fails
- Update order status and tracking info
- Log scan event (timestamp, user, order)

**Technical Notes:**

- Barcode scanner sends order ID + Enter key
- Validate order exists and is ready for shipping (status = `produced`)
- ShipStation API: `POST /shipments/createlabel`
- Store tracking number and carrier info
- Etsy API: Update tracking
- Browser Print API: `window.print()` or printer-specific integration
- Consider Zebra Browser Print SDK for direct thermal printer control

**Database Fields Needed:**

- scanned_for_label_at (timestamp)
- label_auto_printed (boolean)

---

### Feature: Bulk Label Generation (Alternative Method)

**User Story:** As a warehouse user, I want to manually select multiple orders and generate all their shipping labels at once (alternative to scan-to-label workflow).

**Requirements:**

- "Generate Labels" button on produced orders view
- Bulk select orders for label generation
- ShipStation API integration:
  - Create shipment for each order
  - Use package dimensions/weights from database
  - Use customer shipping address from Etsy order
  - Select appropriate shipping carrier/service
  - Generate tracking numbers
- Aggregate all labels into single PDF
- Download PDF to user's computer
- Automatically update Etsy with tracking information
- Update order status to `labels_generated`
- Store tracking numbers in database

**Technical Notes:**

- ShipStation API: `POST /shipments/createlabel`
- Use PDF merge library (pdf-lib) to combine labels
- Etsy API: `POST /v3/application/shops/{shop_id}/receipts/{receipt_id}/tracking`
- Handle partial failures (some labels succeed, others fail)

**Database Fields Needed:**

- Tracking number
- Carrier (USPS, UPS, FedEx, etc.)
- Service type (Priority, First Class, etc.)
- Label generated timestamp
- Shipstation shipment_id
- Label PDF URL/path

---

## 4.8 Package Scanning & Loading

### Feature: Barcode Scanning for Shipment Loading

**User Story:** As a warehouse user, I want to scan labels as I load packages so I know everything made it onto the truck. This will be the source of truth for whether we made the product.

**Requirements:**

- Scanning interface:
  - Large text input focused automatically
  - Accepts tracking number input (via scanner or manual)
  - Visual/audio feedback on successful scan
  - Error feedback if tracking number not found
- Mark scanned orders as `loaded_for_shipment`
- Scan timestamp logging
- Validation: only allow scanning of orders with `labels_generated` status
- Show progress: X of Y packages scanned
- Unload capability (if package removed from truck)
- Daily scan report

**Technical Notes:**

- **Scanner Compatibility:** Works with any USB HID keyboard wedge barcode scanner

  - Examples: Tera 1D/2D/QR scanners, Honeywell, Symbol, Zebra, etc.
  - Supports both wired USB and wireless (2.4GHz) models
  - Scanner emulates keyboard input - types barcode as if manually entered
  - No special drivers or software required
  - Scans 1D barcodes (UPC, Code 128), 2D (QR), and shipping labels

- **How It Works Technically:**

  - Scanner uses USB HID (Human Interface Device) protocol
  - Operating system recognizes it as a standard keyboard
  - When barcode is scanned:
    1. Scanner decodes barcode optically
    2. Sends individual keyboard keypress events (one per character)
    3. Sends "Enter" key at the end (configurable via scanner settings)
  - Entire process takes ~50-100ms (appears instant to user)
  - Browser receives standard `keydown`/`keypress`/`keyup` events
  - No special JavaScript APIs needed - just listen to normal keyboard events

- **Implementation approach:**
  - Auto-focus input field on page load (`.focus()`)
  - Listen for rapid keyboard input (scan is much faster than human typing)
  - Detect "Enter" key to trigger submission
  - Differentiate scan from manual typing:
    - Monitor time between keystrokes (scan: <10ms, human: >50ms)
    - Or simply handle on Enter key for both cases
  - Clear input after successful scan
  - Visual + audio feedback (Web Audio API beep)
  - Handle edge cases (invalid format, duplicate scan, wrong order status)
- **Example Implementation:**

  ```javascript
  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle scan/input
  const handleScan = (e) => {
    if (e.key === "Enter" && e.target.value.trim()) {
      const trackingNumber = e.target.value.trim();
      // Validate and process tracking number
      markAsLoaded(trackingNumber);
      e.target.value = ""; // Clear for next scan
    }
  };
  ```

- Consider mobile-responsive design for tablet use (keyboard/scanner will still work)

**Database Fields Needed:**

- Loaded for shipment status
- Scan timestamp
- Scanned by user_id

---

## 4.9 Late Order Flagging

### Feature: Automatic Late Order Detection

**User Story:** As an admin, I want to see which orders are running behind schedule so I can take corrective action.

**Requirements:**

- Define SLA (Service Level Agreement) per product type
  - Example: Standard orders should ship within 5 business days
  - Custom orders within 7 business days
- Automatic flagging when order exceeds SLA
- Late order dashboard with:
  - Days overdue
  - Current bottleneck (which status it's stuck at)
  - Priority sorting
- Visual indicators (red badges, etc.)
- Manual flag/unflag capability
- Late reason notes

**Business Rules:**

- Calculate from order date to current status
- Exclude weekends/holidays from calculation (configurable)
- Different SLAs for different product categories
- Consider holidays and high-volume periods

**Database Fields Needed:**

- Is_late flag
- Days_overdue calculated field
- Expected_ship_date
- Late_reason notes
- SLA settings per product

---

## 4.10 Delivery Tracking & Completion

### Feature: Real-time Shipment Tracking

**User Story:** As an admin, I want to see delivery status without checking each carrier's website manually.

**Requirements:**

- Webhook from ShipStation for tracking updates
- Periodic polling as backup (every 6-12 hours)
- Update order status based on tracking events:
  - "Picked up" → `in_transit`
  - "Out for delivery" → `in_transit` (flag for imminent delivery)
  - "Delivered" → `delivered`
  - "Exception" → flag for review
- Display current tracking status on order detail page
- Link to carrier tracking page
- Handle tracking anomalies (returned to sender, lost package, etc.)
- Archive delivered orders after 30 days (soft delete)

**Technical Notes:**

- ShipStation Webhook: `shipnotify` event
- Fallback: ShipStation API `GET /shipments?orderId={orderId}`
- Store tracking history

**Database Fields Needed:**

- Current_tracking_status
- Last_tracking_update timestamp
- Delivery_date
- Tracking_history (JSON array)
- Exception_flag and exception_notes

---

## 5. Database Schema (Proposed for Supabase)

### 5.1 Table: `stores`

Configuration for connected Etsy stores.

```sql
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform VARCHAR(50) NOT NULL DEFAULT 'etsy', -- 'etsy' or 'shopify'
  store_name VARCHAR(255) NOT NULL,
  store_id VARCHAR(255) NOT NULL, -- Platform's store/shop ID
  api_token_encrypted TEXT NOT NULL, -- Encrypted API token
  is_active BOOLEAN DEFAULT true,
  last_sync_timestamp TIMESTAMP,
  sync_frequency_minutes INTEGER DEFAULT 15,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_stores_platform ON stores(platform);
CREATE INDEX idx_stores_active ON stores(is_active);
```

### 5.2 Table: `orders`

Main order tracking table.

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Source Information
  store_id UUID REFERENCES stores(id),
  platform VARCHAR(50) NOT NULL, -- 'etsy', 'shopify'
  external_order_id VARCHAR(255) NOT NULL, -- Platform's order ID
  external_receipt_id VARCHAR(255), -- Etsy receipt_id

  -- Order Details
  order_number VARCHAR(100) NOT NULL, -- Human-readable order number
  order_date TIMESTAMP NOT NULL,

  -- Customer Information
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  shipping_address_line1 VARCHAR(255),
  shipping_address_line2 VARCHAR(255),
  shipping_city VARCHAR(100),
  shipping_state VARCHAR(100),
  shipping_zip VARCHAR(20),
  shipping_country VARCHAR(100),

  -- Product Information
  product_sku VARCHAR(100),
  product_name VARCHAR(255),
  product_category VARCHAR(100),
  quantity INTEGER DEFAULT 1,

  -- Order Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending_enrichment',
  is_late BOOLEAN DEFAULT false,
  days_overdue INTEGER DEFAULT 0,
  late_reason TEXT,

  -- Enrichment
  enrichment_status VARCHAR(50), -- 'pending', 'enriched', 'needs_review'
  custom_text TEXT,
  custom_images JSONB, -- Array of image URLs
  enrichment_notes TEXT,
  enrichment_submitted_at TIMESTAMP,
  customer_submission_email VARCHAR(255),

  -- Review Flagging
  needs_review BOOLEAN DEFAULT false,
  review_reason VARCHAR(100), -- 'poor_quality', 'wrong_format', 'missing_info', etc.
  review_notes TEXT,
  flagged_by UUID REFERENCES public.users(id), -- User who flagged
  flagged_at TIMESTAMP,
  resolved_by UUID REFERENCES public.users(id), -- User who resolved
  resolved_at TIMESTAMP,
  resolution_notes TEXT,

  -- Design
  product_design_group_id UUID, -- Links to unique product design
  canva_design_id VARCHAR(255),
  canva_edit_url TEXT,
  design_assigned_to UUID, -- VA user_id
  design_started_at TIMESTAMP,
  design_completed_at TIMESTAMP,

  -- Production
  production_status VARCHAR(50),
  production_notes TEXT,
  produced_by UUID, -- User ID
  produced_at TIMESTAMP,

  -- Metadata Image (for warehouse identification)
  metadata_image_generated BOOLEAN DEFAULT false,
  metadata_image_url TEXT, -- Link to generated metadata image with barcode

  -- Print Roll Assembly
  print_roll_generated BOOLEAN DEFAULT false,
  print_roll_url TEXT, -- Link to assembled print roll PDF/image
  print_roll_metadata JSONB, -- Layout info, efficiency stats

  -- Shipping
  package_length_inches DECIMAL(8,2),
  package_width_inches DECIMAL(8,2),
  package_height_inches DECIMAL(8,2),
  package_weight_oz DECIMAL(8,2),
  dimensions_overridden BOOLEAN DEFAULT false,

  tracking_number VARCHAR(255),
  carrier VARCHAR(100),
  service_type VARCHAR(100),
  shipstation_shipment_id VARCHAR(255),
  label_generated_at TIMESTAMP,
  label_pdf_url TEXT,

  -- Scan-to-Label
  scanned_for_label_at TIMESTAMP, -- When barcode was scanned to generate label
  label_auto_printed BOOLEAN DEFAULT false, -- Whether label was auto-printed

  loaded_for_shipment_at TIMESTAMP,
  loaded_by UUID, -- User ID

  shipped_at TIMESTAMP,
  delivered_at TIMESTAMP,
  current_tracking_status VARCHAR(100),
  last_tracking_update TIMESTAMP,
  tracking_history JSONB, -- Array of tracking events

  -- SLA
  expected_ship_date DATE,
  sla_days INTEGER, -- Business days allowed for this product

  -- Metadata
  raw_order_data JSONB, -- Original platform order data
  internal_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT unique_external_order UNIQUE(platform, external_order_id)
);

-- Indexes for performance
CREATE INDEX idx_orders_store ON orders(store_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_late ON orders(is_late);
CREATE INDEX idx_orders_tracking ON orders(tracking_number);
CREATE INDEX idx_orders_external ON orders(external_order_id);
CREATE INDEX idx_orders_design_group ON orders(product_design_group_id);
CREATE INDEX idx_orders_order_date ON orders(order_date);
```

### 5.3 Table: `product_design_groups`

Daily Canva files per product. One Canva file per product per day containing all orders for that product.

**Note:** A "product" is defined by its size/dimensions (e.g., "10x10 blanket", "20x20 blanket"). Each product gets one Canva file per day with multiple pages (one page per order).

```sql
CREATE TABLE product_design_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  product_sku VARCHAR(100) NOT NULL, -- Product identifier (e.g., "blanket-10x10")
  design_date DATE NOT NULL, -- Date for this batch of designs

  canva_design_id VARCHAR(255), -- Canva file ID
  canva_edit_url TEXT, -- Shareable Canva edit link
  canva_template_id VARCHAR(255), -- Template used to create design

  design_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_progress', 'complete'
  assigned_to UUID, -- VA user_id

  order_count INTEGER DEFAULT 0, -- How many orders (pages) in this Canva file

  -- Print roll assembly
  print_roll_generated BOOLEAN DEFAULT false,
  print_roll_url TEXT,
  print_roll_metadata JSONB, -- Roll dimensions, efficiency, layout

  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,

  CONSTRAINT unique_product_day UNIQUE(product_sku, design_date)
);

CREATE INDEX idx_design_groups_status ON product_design_groups(design_status);
CREATE INDEX idx_design_groups_sku ON product_design_groups(product_sku);
CREATE INDEX idx_design_groups_date ON product_design_groups(design_date);
```

### 5.4 Table: `users` (Profile Extension)

System users (admins, designers, warehouse users). This extends Supabase Auth's `auth.users` table with additional metadata.

**Note:** Supabase Auth manages the core `auth.users` table (email, password, etc.). We create a `public.users` table to store additional profile information and roles.

```sql
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  role VARCHAR(50) NOT NULL DEFAULT 'warehouse', -- 'admin', 'designer', 'warehouse'
  full_name VARCHAR(255),

  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Automatically create user profile when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, full_name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'warehouse')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS (no policies defined, use service role key)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_active ON public.users(is_active);
```

### 5.5 Table: `order_status_history`

Audit trail for order status changes.

```sql
CREATE TABLE order_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,

  previous_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,

  changed_by UUID REFERENCES users(id),
  change_reason TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_status_history_order ON order_status_history(order_id);
CREATE INDEX idx_status_history_created ON order_status_history(created_at);
```

### 5.6 Table: `product_templates`

Product configurations (dimensions, SLA, Canva templates).

```sql
CREATE TABLE product_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  sku VARCHAR(100) NOT NULL UNIQUE,
  product_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),

  -- Default shipping specs
  default_length_inches DECIMAL(8,2),
  default_width_inches DECIMAL(8,2),
  default_height_inches DECIMAL(8,2),
  default_weight_oz DECIMAL(8,2),

  -- SLA
  sla_business_days INTEGER DEFAULT 5,

  -- Canva
  canva_template_id VARCHAR(255),

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_product_templates_sku ON product_templates(sku);
CREATE INDEX idx_product_templates_active ON product_templates(is_active);
```

### 5.7 Table: `sync_logs`

Logging for order sync operations.

```sql
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  store_id UUID REFERENCES stores(id),
  sync_started_at TIMESTAMP NOT NULL,
  sync_completed_at TIMESTAMP,

  orders_fetched INTEGER DEFAULT 0,
  orders_imported INTEGER DEFAULT 0,
  orders_skipped INTEGER DEFAULT 0,

  status VARCHAR(50), -- 'success', 'partial', 'failed'
  error_message TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sync_logs_store ON sync_logs(store_id);
CREATE INDEX idx_sync_logs_created ON sync_logs(created_at);
```

### 5.8 Table: `system_config`

System-wide configuration settings. **Note:** Most API keys should be stored as environment variables, not in the database. This table is for user-configurable settings.

```sql
CREATE TABLE system_config (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS (no policies defined, use service role key)
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Example entries:
-- ('default_sla_days', '5', 'Default SLA in business days')
-- ('late_order_threshold_hours', '24', 'Hours past SLA before flagging as late')
```

### 5.9 Row Level Security (RLS) - Simplified for Internal Use

**Current Approach (Internal Tool):**

Since this is an **internal-only tool**, we're using a simplified security model:

- ✅ **Enable RLS on all tables** (for future-proofing)
- ❌ **No policies defined** (empty policy set)
- ✅ **Use service role key** server-side to bypass RLS entirely
- ✅ **Supabase Auth** still handles user authentication

**Why This Approach:**

- ✅ Faster development (no complex policies to debug)
- ✅ Full data access for all authenticated internal users
- ✅ RLS infrastructure in place for future
- ✅ Still get authentication and session management
- ✅ Easy to add policies later when needed (e.g., for external users or contractors)

**Implementation:**

```sql
-- Enable RLS on all tables (but create NO policies)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_design_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- NO POLICIES CREATED
-- Service role key bypasses RLS completely
```

**Server-Side Supabase Client (bypasses RLS):**

```javascript
// lib/supabase-admin.js
import { createClient } from "@supabase/supabase-js";

// Server-side only - has full access, bypasses RLS
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // Service role bypasses RLS
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Use this for all database operations
const { data, error } = await supabaseAdmin.from("orders").select("*");
// Full access, no RLS restrictions
```

**Client-Side Supabase Client (for auth only):**

```javascript
// lib/supabase-client.js
import { createClient } from "@supabase/supabase-js";

// Client-side - only use for authentication
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Use for: sign in, sign out, get user session
// Do NOT use for database queries (use API routes with admin client instead)
```

**Storage Buckets:**

```sql
-- Create customer-uploads bucket as PUBLIC for simplicity
INSERT INTO storage.buckets (id, name, public)
VALUES ('customer-uploads', 'customer-uploads', true);

-- No storage policies needed for internal use
-- Public bucket = anyone with URL can access (fine for internal tool)
```

---

### 5.10 Future: Role-Based RLS Policies (Not Implemented)

When the app needs to scale beyond internal use or needs granular access control, implement proper RLS policies. Examples are provided below but **not used currently**.

<details>
<summary>Click to expand: Example RLS policies for future implementation</summary>

```sql
-- Example: Admins have full access
CREATE POLICY "Admins have full access to orders"
  ON orders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Example: Designers can only view/update design-ready orders
CREATE POLICY "Designers can access design orders"
  ON orders FOR ALL
  USING (
    status IN ('enriched', 'ready_for_design', 'design_complete') AND
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'designer'
    )
  );

-- Example: Warehouse users can only see production orders
CREATE POLICY "Warehouse can access production orders"
  ON orders FOR ALL
  USING (
    status IN ('design_complete', 'printing', 'produced', 'labels_generated', 'loaded_for_shipment') AND
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'warehouse'
    )
  );

-- Example: Storage bucket policies
CREATE POLICY "Role-based file access"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'customer-uploads' AND
    (
      -- Admins can access everything
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
      OR
      -- Others can only access if authenticated
      auth.role() = 'authenticated'
    )
  );
```

</details>

---

## 6. API Integrations

### 6.1 Etsy API

**Authentication:** OAuth2 with personal API tokens  
**Key Endpoints:**

- `GET /v3/application/shops/{shop_id}/receipts` - Fetch orders
- `POST /v3/application/shops/{shop_id}/receipts/{receipt_id}/tracking` - Update tracking
- Rate Limit: 10 requests/second per app

**Implementation Notes:**

- Store encrypted API tokens per store
- Handle rate limiting with exponential backoff
- Cache shop_id per store to reduce API calls

### 6.2 Canva API

**Authentication:** API Key  
**Key Endpoints:**

- `POST /v1/designs` - Create new design from template
- `GET /v1/designs/{design_id}` - Get design details
- Rate Limit: TBD based on API tier

**Implementation Notes:**

- Use Canva Connect API
- Store design_id and edit_url for VA access
- Consider template library for different products

### 6.3 ShipStation API

**Authentication:** API Key + Secret (Basic Auth)  
**Key Endpoints:**

- `POST /shipments/createlabel` - Generate shipping label
- `GET /shipments` - Get shipment status
- Webhook: `shipnotify` for tracking updates

**Implementation Notes:**

- Batch label creation for efficiency
- Store shipment_id for reference
- Configure webhook endpoint for tracking updates
- Handle carrier-specific requirements

### 6.4 Future: Shopify API

**Authentication:** Access tokens  
**Key Endpoints:**

- `GET /admin/api/2024-01/orders.json` - Fetch orders
- `POST /admin/api/2024-01/fulfillments.json` - Create fulfillment

**Implementation Notes:**

- Similar abstraction to Etsy integration
- Map Shopify order structure to internal schema
- Handle Shopify-specific fields (variants, metafields)

---

## 7. User Interface / Pages

### 7.1 Authentication

- `/login` - Password login page
- `/logout` - Logout endpoint

### 7.2 Dashboard

- `/dashboard` - Main overview with key metrics
  - Orders by status (pie chart)
  - Late orders count (red alert)
  - Today's stats (new orders, completed, shipped)
  - Quick actions

### 7.3 Orders

- `/orders` - Main orders table
  - Filters: status, store, date range, is_late
  - Search: order number, customer name
  - Bulk actions
  - Column sorting
- `/orders/[id]` - Order detail page
  - Full order information
  - Status timeline
  - Customer enrichment data
  - Design preview
  - Tracking information
  - Action buttons (context-sensitive)
  - Status history

### 7.4 Enrichment

- `/enrich` - Public customer form (no auth)

  - Order number lookup
  - File upload
  - Text input fields
  - Submission confirmation

- `/enrichment-review` - Flagged orders dashboard

  - List of all `needs_review` orders
  - View flag reason and notes
  - Preview customer assets
  - Upload replacement assets
  - Add resolution notes
  - "Resolve" button (moves back to enriched)
  - "Cancel Order" button
  - Contact customer email link

- Order detail pages:
  - "Flag for Review" button (for VA/admin)
  - Review reason dropdown
  - Flag notes text area
  - Review history display

### 7.5 Design

- `/design-queue` - VA workflow dashboard
  - List of products needing design (grouped by size)
  - Canva links (one per product per day)
  - Number of orders (pages) per product
  - Mark as complete checkbox
  - Filter by status and date
- `/design-queue/metadata-images` - Generate metadata images
  - Select product/date
  - Generate metadata images for all orders in that product's Canva file
  - Download individual or batch
  - Preview metadata images
  - Shows order ID, ship-to info, barcode

### 7.6 Production

- `/production/assemble-roll` - Print roll assembly tool

  - Select product and date
  - Configure roll dimensions (width, segment length)
  - Set spacing/margins
  - Generate optimized roll layout
  - Preview with efficiency stats
  - Download print-ready PDF

- `/production` - Warehouse production queue
  - Orders ready to print
  - Mark as produced
  - Package dimension entry
  - Production notes
  - Bulk actions

### 7.7 Shipping

- `/shipping/scan-to-label` - **Primary method:** Scan-to-generate label

  - Large auto-focused input field
  - Scan barcode from metadata image
  - Automatically generates and prints shipping label
  - Real-time success/error feedback
  - Audio confirmation
  - Recent scans log

- `/shipping/bulk-labels` - **Alternative:** Manual bulk label generation
  - Select multiple orders
  - Generate labels button
  - Download aggregated PDF
  - Manual process for batch labeling
- `/shipping/scan-and-load` - Package loading confirmation
  - Scan tracking number barcodes
  - Mark as loaded for shipment
  - Progress tracker (X of Y loaded)

### 7.8 Tracking

- `/tracking` - Order tracking overview
  - In-transit orders
  - Delivery status
  - Late shipments
  - Exceptions

### 7.9 Settings

- `/settings/stores` - Store configuration
  - Add/edit Etsy stores
  - API token management
  - Sync frequency
- `/settings/products` - Product templates
  - SKU management
  - Default dimensions/weights
  - SLA configuration
  - Canva template assignment
- `/settings/users` - User management (admin only)
  - Add/edit users
  - Role assignment
- `/settings/system` - System configuration
  - Password change
  - API keys
  - SLA rules

---

## 8. Key User Flows

### 8.1 Order Fulfillment Flow (Happy Path)

```
1. Etsy Order Placed
   ↓
2. System Imports Order (cron job)
   Status: pending_enrichment
   ↓
3. Customer Submits Assets (/enrich form)
   Status: enriched
   ↓
4. Midnight Cron (Pacific Time): Generate Canva Links
   Groups orders by product, creates multi-page Canva files
   Status: ready_for_design
   ↓
5. VA Opens Canva Link & Creates Designs
   One Canva file per product, multiple pages per file
   ↓
6. VA Generates Metadata Images
   Downloads barcode labels for each order
   Places in Canva design margins
   ↓
7. VA Marks Product Complete
   All orders for that product → design_complete
   ↓
8. Warehouse: Assemble Print Roll
   Optimizes layout for all designs
   Prints roll on Epson printer
   ↓
9. Warehouse: Scan Barcodes to Generate Labels
   Scans each design's barcode
   Auto-generates & prints shipping label
   Staples label to design
   Status: labels_generated
   Etsy updated with tracking
   ↓
10. Factory: Produces Products
    Heat press, sewing, packaging
    ↓
11. Loader: Scans Packages for Shipment
    Scans shipping label on each package
    Status: loaded_for_shipment
    Loads onto truck
    ↓
12. ShipStation Webhook: Package Picked Up
    Status: in_transit
    ↓
13. ShipStation Webhook: Delivered
    Status: delivered
```

### 8.2 VA Daily Workflow

```
1. Log in at midnight (or whenever designs are ready)
2. Navigate to /design-queue
3. For each product (e.g., "10x10 blanket"):
   a. See: "15 orders for 10x10 blanket"
   b. Click Canva link (opens in new tab)
   c. Canva file has 15 pages (one per order)
   d. Create designs for all pages in Canva using customer assets
   e. Return to /design-queue/metadata-images
   f. Select product, click "Generate Metadata Images"
   g. Download all metadata images (order ID + barcode + ship-to)
   h. Place each metadata image in the margin of corresponding Canva page
   i. Return to SaaS, check "Complete" for product
4. System updates all orders for that product to design_complete
```

### 8.3 Warehouse Workflow (Complete Production & Shipping Flow)

**Step 1: Assemble & Print Roll (Warehouse User)**

```
1. Log in to production queue
2. Navigate to /production/assemble-roll
3. Select product (e.g., "10x10 blanket") and date
4. Configure roll: width=44", segment=60"
5. Click "Generate Roll" - system optimizes layout
6. Preview shows efficient packing, download PDF
7. Send to Epson sublimation printer and print roll
8. Cut roll into individual designs (follow cut lines)
9. Each design has embedded metadata image with barcode
```

**Step 2: Generate Shipping Labels (Warehouse User)**

```
10. Navigate to /shipping/scan-to-label
11. Scan barcode on each design → label auto-generates and prints
12. Staple shipping label to corresponding design
13. Repeat for all designs from the roll
14. Order status updates to: labels_generated
```

**Step 3: Production (Factory)**

```
15. Warehouse forwards labeled designs to factory
16. Factory produces physical products (heat press, sewing, etc.)
17. Factory packages finished products
```

**Step 4: Loading for Shipment (Factory Loader)**

```
18. Loader prepares packages for truck
19. At /shipping/scan-and-load interface
20. Scan shipping label barcode on each package
21. System marks as "loaded_for_shipment"
22. Load package onto truck
23. Repeat for all packages
24. Done - packages ready for carrier pickup!
```

### 8.3 OLD Warehouse Morning Workflow (For Reference)

```
1. Log in to production queue (DEPRECATED - see above)
2. View all design_complete orders
3. Print designs one by one
4. Produce physical product
5. Pack and weigh
6. Mark as produced (update dimensions if needed)
7. When all done, go to shipping page
8. Select all produced orders
9. Click "Generate Labels"
10. Download PDF, print labels
11. Apply labels to packages
12. Scan each label as loading onto truck
13. Done - packages now in_transit
```

---

## 9. Security Considerations

### 9.1 Authentication & Authorization

- **Supabase Auth handles:**

  - Password hashing (bcrypt)
  - JWT generation and signing
  - Token storage (localStorage/cookies)
  - Automatic token refresh
  - Session management
  - Password reset flows

- **Application responsibilities:**

  - Role-based access control via `public.users` table (for UI only)
  - Route protection middleware (auth required)
  - Session validation on each request

- **Row Level Security (RLS) - Simplified:**
  - RLS enabled on all tables (future-proofing)
  - **No policies defined** (service role key bypasses RLS)
  - All authenticated internal users (admin, designer, warehouse) have full access
  - Data operations use service role key server-side
  - Simpler development, can add policies later if needed

### 9.2 API Security

- **Supabase built-in:**

  - Automatic API key rotation
  - Row Level Security enforcement
  - SQL injection prevention (parameterized queries)
  - Rate limiting on database connections

- **Application level:**
  - Encrypt third-party API tokens at rest (Etsy, ShipStation, Canva)
  - HTTPS only (enforced by Vercel + Supabase)
  - CORS configuration for public enrichment form
  - Rate limiting on API routes (Vercel middleware)
  - Input validation and sanitization
  - Environment variable security (never commit secrets)

### 9.3 Data Privacy

- **Encryption:**

  - Data encrypted in transit (TLS/SSL)
  - Database encryption at rest (Supabase default)
  - Customer PII protected by RLS policies

- **Audit Trail:**

  - `order_status_history` table tracks all changes
  - User actions logged with timestamps
  - Changed_by field references user

- **GDPR Compliance:**

  - Right to deletion (cascade deletes)
  - Data export capability
  - Consent tracking for email notifications
  - Customer data retention policies

- **Password Security:**
  - Supabase handles all password hashing
  - No plain-text passwords ever stored
  - Password complexity requirements (configurable in Supabase)

### 9.4 File Uploads & Storage

- **Supabase Storage Security:**

  - File type validation (images only: PNG, JPG, JPEG)
  - File size limits (10MB max)
  - Storage bucket policies (RLS for buckets)
  - Signed URLs for temporary access
  - Automatic virus scanning (optional: integrate ClamAV)

- **Access Control:**
  - Bucket policies restrict who can upload/download
  - Order-specific folders prevent cross-contamination
  - Admin-only access to all uploads
  - Customers can only upload to their order

**Example Storage Policy:**

```sql
-- Only authenticated users can upload
CREATE POLICY "Users can upload files"
  ON storage.objects FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Users can only download files they uploaded or admins
CREATE POLICY "Users can download own files"
  ON storage.objects FOR SELECT
  USING (
    auth.uid()::text = owner OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

---

## 10. Performance Considerations

### 10.1 Database

- Proper indexing on frequently queried fields
- Pagination for large datasets (100 orders per page)
- Database connection pooling
- Query optimization (avoid N+1 queries)

### 10.2 API Rate Limiting

- Respect Etsy API rate limits (10 req/sec)
- Implement exponential backoff
- Queue system for bulk operations (consider Vercel Queue)
- Cache frequently accessed data (store configs, product templates)

### 10.3 Frontend

- Server-side rendering for initial page load
- Client-side state management (React Context or Zustand)
- Optimistic UI updates
- Lazy loading for images
- Infinite scroll for long lists

---

## 11. Error Handling & Monitoring

### 11.1 Error Logging

- Sentry integration for error tracking
- Log levels: error, warn, info, debug
- Structured logging with context
- Alert on critical failures (sync failures, API errors)

### 11.2 Monitoring

- Uptime monitoring (Vercel Analytics)
- API response times
- Order sync success rate
- Late order metrics
- User activity tracking

### 11.3 Failure Scenarios

- **Etsy API down:** Queue orders for retry, alert admin
- **ShipStation API down:** Fallback to manual label generation
- **Canva API down:** Allow manual Canva link entry
- **File upload fails:** Show user-friendly error, retry mechanism
- **Label generation partial failure:** Mark successful ones, flag failures

---

## 12. Testing Strategy

### 12.1 Unit Tests

- Database helper functions
- API integration functions
- Status transition logic
- Authentication/JWT generation

### 12.2 Integration Tests

- End-to-end order flow
- API mock responses
- Database transactions
- File upload handling

### 12.3 Manual Testing

- User acceptance testing per role
- Cross-browser compatibility
- Mobile responsiveness (tablet for scanning)
- Print label PDF formatting

---

## 13. Deployment & DevOps

### 13.1 Environments

- **Development:**
  - Local Next.js dev server (`npm run dev`)
  - Local Supabase via Docker (optional) or connect to dev project
  - Environment: `.env.local`
- **Staging:**
  - Vercel preview deployment (auto-deploy on PR)
  - Supabase staging project
  - Test data and API sandboxes
- **Production:**
  - Vercel production
  - Supabase production project
  - Production API keys and data

### 13.2 CI/CD

- **GitHub Actions workflow:**
  - Run tests on PR
  - Type checking (TypeScript)
  - Lint checking
  - Build verification
- **Deployment flow:**
  - Push to branch → Vercel preview deployment
  - Merge to main → Vercel production deployment
  - Manual approval for database migrations
- **Database Migrations:**
  - Use Supabase CLI for migrations
  - Version control migration files in `/supabase/migrations/`
  - Test migrations in staging before production
  - Rollback plan for failed migrations

### 13.3 Environment Variables

**Supabase:**

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key # Server-side only
```

**Third-Party APIs:**

```bash
ETSY_API_KEY=your-etsy-key
CANVA_API_KEY=your-canva-key
SHIPSTATION_API_KEY=your-shipstation-key
SHIPSTATION_API_SECRET=your-shipstation-secret
```

**Security & Monitoring:**

```bash
ENCRYPTION_KEY=your-encryption-key # For encrypting stored API tokens
SENTRY_DSN=your-sentry-dsn # Error tracking
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

**Optional:**

```bash
TURNSTILE_SECRET_KEY=your-turnstile-key # Captcha for public form
```

---

## 14. Future Enhancements

### 14.1 Phase 2 Features

- Shopify integration
- Multi-user support with granular permissions
- Customer portal (track own orders)
- Inventory management
- Automated reordering of supplies
- Analytics dashboard (revenue, turnaround time, etc.)
- Mobile app for warehouse (React Native)

### 14.2 Shopify Considerations

The architecture is designed to be platform-agnostic:

- `platform` field in orders table
- Database abstraction layer
- Order source tracking
- Similar API polling structure
- Unified status pipeline

**Key Differences to Handle:**

- Shopify uses variants (SKU at variant level)
- Different order structure (line_items vs receipts)
- Fulfillment API (mark as fulfilled)
- Shopify webhooks (more reliable than polling)

### 14.3 Advanced Supabase Features (Future)

**Real-time Subscriptions:**

- Live order updates without polling
- Real-time status changes visible to all users
- WebSocket connection for instant notifications

**Database Triggers:**

- Auto-update `updated_at` timestamps
- Automatic status history logging
- Send notifications on status changes

**Supabase Edge Functions:**

- Alternative to Vercel Functions for some tasks
- Close to database for faster queries
- Can handle webhooks from ShipStation, Etsy

**Supabase Storage:**

- CDN for fast image delivery
- Image transformations (resize, optimize)
- Automatic backup of customer uploads

---

## 15. Success Metrics

### 15.1 KPIs

- **Fulfillment Time:** Average days from order to shipment
- **On-Time Delivery Rate:** % of orders shipped within SLA
- **Enrichment Rate:** % of orders enriched within 24 hours
- **Error Rate:** Failed API calls, sync errors
- **User Adoption:** Active users per role
- **Order Volume:** Orders processed per day/week/month

### 15.2 Goals

- Reduce fulfillment time by 30% (baseline: current manual process)
- Achieve 95% on-time delivery rate
- Zero lost orders (all tracked through system)
- 99.9% uptime

---

## 16. Hardware Recommendations

### 16.1 Barcode Scanner

**Recommended:** Tera 1D 2D QR Barcode Scanner (or similar)

**Key Features:**

- Dual connectivity: USB wired + 2.4GHz wireless
- Reads 1D, 2D, and QR codes
- Plug-and-play (HID keyboard emulation)
- Battery indicator (for wireless mode)
- Compact and ergonomic handheld design
- ~$40-50 on Amazon

**Alternative Options:**

- Honeywell Voyager 1200g (~$150) - More durable for high-volume
- Symbol/Zebra DS2208 (~$200) - Enterprise-grade
- Any USB barcode scanner with HID keyboard wedge support

**Setup Requirements:**

- Plug into USB port (wired) or USB receiver (wireless)
- No software installation needed
- Works on any computer/tablet with USB port
- Compatible with Windows, Mac, Linux

### 16.2 Warehouse Workstation

**Recommended Setup:**

- **Desktop/Laptop:** Any computer with modern browser
- **Monitor:** 24"+ for comfortable viewing of order queues
- **Printer:** Standard desktop printer for shipping labels (thermal or laser)
- **Internet:** Stable connection for real-time updates
- **Optional:** Tablet with USB adapter for mobile scanning at loading dock

### 16.3 Sublimation Printing

**Current Equipment:**

- Epson sublimation printer (model TBD)
- [To be documented: specific model, workflow, consumables]

### 16.4 Label Printer (Optional)

**For High Volume:**

- Rollo Label Printer (~$200) or Zebra thermal printer
- Direct thermal printing (no ink cartridges)
- ShipStation-compatible
- 4x6" shipping labels
- Faster than standard printer, no label sheets needed

---

## 17. Open Questions & Decisions Needed

1. **Printer Integration:** Is there an API for the Epson sublimation printer? If not, what's the manual process?
2. **Canva Template Design:** Who creates the initial Canva templates per product?
3. **Shipping Carrier Selection:** Fixed carrier (e.g., USPS Priority) or dynamic based on package/destination?
4. **Return Handling:** How to handle returned packages? Need status for that?
5. **Holiday/Peak Season:** Different SLAs during high-volume periods?
6. **Multi-quantity Orders:** If customer orders 2 blankets, should they be separate line items or single order?

---

## 18. Development Roadmap

### Phase 0: Foundation ✅ COMPLETE

- [x] Next.js app setup (App Router) ✅
- [x] Supabase project creation (dev + production) ✅
- [x] Supabase Auth integration ✅
- [x] Database schema implementation (run migrations) ✅
- [x] Enable RLS on all tables (no policies needed) ✅
- [x] Supabase Storage buckets setup (private bucket) ✅
- [x] Server-side admin client setup (service role key) ✅
- [x] Basic UI framework (components, layout, Tailwind CSS) ✅
- [x] Environment variables configuration ✅
- [x] User roles system (admin, designer, warehouse) ✅

### Phase 1: Order Ingestion

- [ ] Etsy API integration
- [ ] Store configuration page
- [ ] Order polling cron job
- [ ] Order list and detail pages
- [ ] Status management

### Phase 2: Enrichment

- [ ] Public enrichment form
- [ ] File upload to Supabase Storage
- [ ] Order number validation
- [ ] **Flag for review feature**
  - [ ] "Flag for Review" UI in order detail
  - [ ] Review reason dropdown
  - [ ] Flagged orders dashboard (`/enrichment-review`)
  - [ ] Resolution workflow (resubmit/manual fix/cancel)
  - [ ] Asset replacement capability
  - [ ] Status transitions (enriched ↔ needs_review)

### Phase 3: Design Workflow

- [ ] Canva API integration
- [ ] Product design grouping logic (by size, not design content)
- [ ] Daily Canva link generation cron (midnight Pacific Time, one file per product per day)
- [ ] Multi-page Canva file creation (one page per order)
- [ ] VA design queue UI
- [ ] Design completion tracking
- [ ] **Metadata image generator**
  - [ ] Barcode generation library integration
  - [ ] Image composition (order info + barcode)
  - [ ] Batch generation for product
- [ ] Link orders to daily Canva files

### Phase 4: Production

- [ ] Production queue UI
- [ ] Package dimension management
- [ ] Production tracking and notes
- [ ] **Print roll assembly feature**
  - [ ] 2D bin packing algorithm
  - [ ] Canva page export (high-res images)
  - [ ] Image composition into print roll
  - [ ] Roll configuration UI
  - [ ] Efficiency preview and download
- [ ] Bulk production actions

### Phase 5: Shipping

- [ ] ShipStation API integration
- [ ] **Scan-to-label feature (primary method)**
  - [ ] Barcode scanner interface
  - [ ] Auto-generate label on scan
  - [ ] Auto-print integration
  - [ ] Real-time feedback UI
- [ ] Bulk label generation (alternative method)
  - [ ] PDF aggregation and download
- [ ] Etsy tracking update automation
- [ ] Package loading scan interface
- [ ] Load confirmation tracking

### Phase 6: Tracking & Late Orders

- [ ] ShipStation webhook integration
- [ ] Tracking status updates
- [ ] Late order detection logic
- [ ] Late order dashboard
- [ ] Alert system

### Phase 7: Polish & Testing

- [ ] Error handling improvements
- [ ] Performance optimization
- [ ] Comprehensive testing
- [ ] User acceptance testing
- [ ] Documentation
- [ ] Production deployment

---

## 19. Conclusion

This PRD outlines a comprehensive order fulfillment management system designed to streamline the entire lifecycle of custom product orders from multiple Etsy storefronts. The architecture leverages modern tools (Next.js, Supabase) to provide a scalable, secure, and maintainable solution that can grow with the business and easily extend to additional platforms (Shopify).

**Key success factors:**

- **Automation:** Eliminate manual work (order syncing, label generation, tracking updates)
- **Clear workflows:** Role-specific interfaces for designer, warehouse, and admin users
- **Robust tracking:** Real-time visibility into every order from placement to delivery
- **Enterprise security:** Supabase Auth + Row Level Security for data protection
- **Scalable architecture:** PostgreSQL database with real-time capabilities
- **Future-ready:** Platform-agnostic design for easy Shopify integration

**Technology Benefits:**

- **Supabase:** Built-in auth, real-time updates, storage, Row Level Security
- **Next.js:** Modern React framework with server-side rendering
- **Vercel:** Zero-config deployment with edge functions
- **TypeScript:** Type safety across the entire application
- **PostgreSQL:** Reliable, scalable relational database

**Next steps:**

1. Review and validate business requirements with stakeholders
2. Create Supabase projects (development + production)
3. Obtain API credentials:
   - Etsy API tokens for each store
   - Canva API key
   - ShipStation API credentials
4. Set up development environment (Next.js + Supabase CLI)
5. Begin Phase 0: Foundation work
6. Purchase hardware (barcode scanner, label printer optional)
