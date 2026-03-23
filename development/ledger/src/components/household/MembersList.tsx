"use client";

/**
 * MembersList — renders the household members list with avatars and role badges.
 *
 * Each row shows: avatar initials, display name (+ "(you)" suffix), email, role badge.
 * When `onKick` is provided (owner-only), non-owner rows show a Remove button.
 *
 * @see ux/wireframes/household/settings-household.html § Members list
 * Issue #1123
 * Issue #1818 — owner kick action
 */

interface HouseholdMember {
  userId: string;
  displayName: string;
  email: string;
  role: "owner" | "member";
  isCurrentUser: boolean;
}

interface MembersListProps {
  members: HouseholdMember[];
  /** Called when the owner clicks Remove on a non-owner member row */
  onKick?: (member: HouseholdMember) => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function MembersList({ members, onKick }: MembersListProps) {
  return (
    <div className="flex flex-col gap-2" role="list" aria-label="Household members">
      {members.map((member) => (
        <div
          key={member.userId}
          role="listitem"
          className="flex items-center gap-3 border border-border px-3 py-2.5"
        >
          {/* Avatar */}
          <div
            className="w-8 h-8 border border-border flex items-center justify-center text-xs font-bold font-heading text-foreground flex-shrink-0"
            aria-hidden="true"
          >
            {getInitials(member.displayName)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <div className="text-sm font-bold font-body text-foreground truncate">
              {member.displayName}
              {member.isCurrentUser && (
                <span className="ml-1 text-xs italic font-normal text-muted-foreground">
                  (you)
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground font-body truncate">
              {member.email}
            </div>
          </div>

          {/* Role badge */}
          <span className="border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-widest font-heading text-foreground flex-shrink-0">
            {member.role === "owner" ? "Owner" : "Member"}
          </span>

          {/* Remove button — owner only, non-owner members only */}
          {onKick && member.role !== "owner" && (
            <button
              type="button"
              onClick={() => onKick(member)}
              className="min-h-[32px] px-2.5 py-1 border border-destructive/50 text-xs font-heading text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 flex-shrink-0"
              aria-label={`Remove ${member.displayName} from household`}
            >
              Remove
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
