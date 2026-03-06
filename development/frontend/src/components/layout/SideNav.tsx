"use client";

/**
 * SideNav — collapsible left sidebar navigation.
 *
 * Expanded (w-56): icon + label
 * Collapsed (w-14): icon only (native title tooltip)
 *
 * Active route is highlighted with a gold left border.
 * Stub items are shown disabled for future routes.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface SideNavProps {
  collapsed: boolean;
  onToggle: () => void;
}

/**
 * RuneIcon — renders an Elder Futhark rune glyph as a nav icon.
 * Sized and styled to match the 16×16 Lucide icon footprint.
 * Aria-hidden: the label text provides the accessible name.
 */
function RuneIcon({ rune }: { rune: string }) {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 shrink-0 flex items-center justify-center text-base leading-none"
      style={{ fontFamily: "serif" }}
    >
      {rune}
    </span>
  );
}

interface NavItem {
  label: string;
  href: string;
  /** Lucide icon component or custom component accepting className */
  icon: React.ElementType;
  /** Custom icon node — used when icon cannot be a standard Lucide component */
  iconNode?: React.ReactNode;
  disabled?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Cards", href: "/", icon: CreditCard },
  {
    label: "Valhalla",
    href: "/valhalla",
    icon: CreditCard, // Fallback (unused when iconNode is set)
    iconNode: <RuneIcon rune="ᛏ" />,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function SideNav({ collapsed, onToggle }: SideNavProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "shrink-0 flex flex-col border-r border-border bg-background",
        "transition-all duration-200 ease-in-out",
        collapsed ? "w-14" : "w-56"
      )}
    >
      {/* Nav items */}
      <nav className="flex-1 py-3 space-y-0.5 px-1.5">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-sm px-2.5 py-2 text-base transition-colors",
                isActive
                  ? "bg-primary/10 text-gold border-l-2 border-gold"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground border-l-2 border-transparent"
              )}
            >
              {/* Render custom iconNode (rune) or fallback to Lucide icon */}
              {item.iconNode ?? <Icon className="h-4 w-4 shrink-0" />}
              {!collapsed && (
                <span className="font-body truncate">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-1.5 border-t border-border">
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex items-center gap-3 w-full rounded-sm px-2.5 py-2 text-base min-h-[44px]",
            "text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4 shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4 shrink-0" />
              <span className="font-body">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
