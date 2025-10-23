"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export default function Navigation({ user }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
      setLoggingOut(false);
    }
  };

  const navItems = [
    {
      href: "/dashboard",
      label: "Dashboard",
      roles: ["admin", "designer", "warehouse"],
    },
    {
      href: "/orders",
      label: "Orders",
      roles: ["admin", "designer", "warehouse"],
    },
    { href: "/design-queue", label: "Design", roles: ["admin", "designer"] },
    { href: "/production", label: "Production", roles: ["admin", "warehouse"] },
    { href: "/shipping", label: "Shipping", roles: ["admin", "warehouse"] },
    { href: "/tracking", label: "Tracking", roles: ["admin", "warehouse"] },
    { href: "/settings", label: "Settings", roles: ["admin"] },
  ];

  const visibleNavItems = navItems.filter((item) =>
    item.roles.includes(user?.role || "warehouse")
  );

  return (
    <nav
      style={{
        backgroundColor: "var(--bg-primary)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-8">
            <Link
              href="/dashboard"
              className="text-lg font-semibold"
              style={{ color: "var(--primary)" }}
            >
              Etsy SaaS
            </Link>
            <div className="flex gap-1">
              {visibleNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-2 rounded text-sm font-medium transition-colors"
                  style={{
                    color: pathname.startsWith(item.href)
                      ? "var(--primary)"
                      : "var(--text-secondary)",
                    backgroundColor: pathname.startsWith(item.href)
                      ? "var(--bg-hover)"
                      : "transparent",
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span
                className="text-sm font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                {user?.full_name || user?.email}
              </span>
              <span
                className="text-xs px-2 py-1 rounded"
                style={{
                  backgroundColor: "var(--bg-hover)",
                  color: "var(--text-secondary)",
                }}
              >
                {user?.role || "warehouse"}
              </span>
            </div>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-sm px-3 py-1.5 rounded transition-colors"
              style={{
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = "var(--bg-hover)";
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "transparent";
              }}
            >
              {loggingOut ? "..." : "Logout"}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
