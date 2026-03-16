"use client";

/**
 * MembersList — Displays household members with avatar, name, email, role badge.
 *
 * - Owner listed first (sorted by caller)
 * - Current user row shows "(you)" suffix
 * - Role badge: OWNER / MEMBER
 *
 * Issue #1123 — household invite code flow
 */

export interface HouseholdMember {
  clerkUserId: string;
  displayName: string;
  email: string;
  role: "owner" | "member";
  isCurrentUser: boolean;
}

interface MembersListProps {
  members: HouseholdMember[];
}

function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function MembersList({ members }: MembersListProps) {
  return (
    <ul className="flex flex-col gap-2" aria-label="Household members">
      {members.map((member) => (
        <li
          key={member.clerkUserId}
          className="flex items-center gap-3 border border-border px-3 py-2.5"
        >
          {/* Avatar initials */}
          <div
            className="w-8 h-8 border border-border flex items-center justify-center text-[13px] font-bold text-foreground bg-muted/30 flex-shrink-0"
            aria-hidden="true"
          >
            {getInitials(member.displayName)}
          </div>

          {/* Name + email */}
          <div className="flex-1 flex flex-col gap-0.5 min-w-0">
            <div className="text-[13px] font-bold text-foreground leading-tight">
              {member.displayName}
              {member.isCurrentUser && (
                <span className="text-[10px] font-normal italic text-muted-foreground ml-1">
                  (you)
                </span>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              {member.email}
            </div>
          </div>

          {/* Role badge */}
          <span
            className="border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.05em] text-muted-foreground flex-shrink-0"
            aria-label={`Role: ${member.role}`}
          >
            {member.role}
          </span>
        </li>
      ))}
    </ul>
  );
}
