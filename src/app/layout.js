import "./globals.css";

export const metadata = {
  title: "Etsy Store Management",
  description:
    "Order fulfillment management system for custom product businesses",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-50">{children}</body>
    </html>
  );
}
