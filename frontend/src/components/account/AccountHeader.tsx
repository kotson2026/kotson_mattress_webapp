import React from "react";
import { Link } from "react-router-dom";
import { LogOut } from "lucide-react";
import type { User } from "@/lib/types";
import { Button, buttonVariants } from "@/components/ui/button";
import BotanicalBranch from "./BotanicalBranch";

interface AccountHeaderProps {
  user: User;
  onSignOut: () => void;
  isSigningOut?: boolean;
}

/**
 * Derives initials safely from customer name or email.
 * E.g. "UDAY SHANKAR SIMHADRI" -> "U"
 */
function getCustomerInitial(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const trimmed = name.trim();
    return trimmed[0].toUpperCase();
  }
  if (email && email.trim()) {
    return email.trim()[0].toUpperCase();
  }
  return "K";
}

/**
 * Formats customer greeting name into title-cased first name.
 * E.g. "UDAY SHANKAR SIMHADRI" -> "Uday"
 * Does NOT mutate stored customer record.
 */
function getGreetingFirstName(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const firstWord = name.trim().split(/\s+/)[0];
    if (firstWord) {
      return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
    }
  }
  if (email && email.includes("@")) {
    const localPart = email.split("@")[0].split(/[._-]/)[0];
    if (localPart) {
      return localPart.charAt(0).toUpperCase() + localPart.slice(1).toLowerCase();
    }
  }
  return "there";
}

export default function AccountHeader({ user, onSignOut, isSigningOut = false }: AccountHeaderProps) {
  const initial = getCustomerInitial(user.name, user.email);
  const firstName = getGreetingFirstName(user.name, user.email);

  // Staff roles for non-customer internal users
  const staffRoles = (user.roles ?? []).filter((r: string) => r !== "customer");

  return (
    <div
      className="relative overflow-hidden rounded-[20px] border border-[#E3E8E1] bg-[#F4F6F2] p-6 sm:p-8 md:p-9 shadow-[0_2px_8px_rgba(70,112,101,0.03)]"
      data-testid="account-header-card"
    >
      {/* Decorative Botanical Branch on right (hidden on small mobile to avoid text interference) */}
      <div className="absolute right-0 top-0 bottom-0 pointer-events-none select-none overflow-hidden w-64 md:w-96 opacity-60 hidden sm:block">
        <BotanicalBranch className="h-full w-full object-cover object-right" />
      </div>

      <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        {/* Left Side: Avatar + Customer Details */}
        <div className="flex items-start sm:items-center gap-4 sm:gap-6">
          {/* Avatar: Deep Kotson green with white dynamic initial */}
          <div
            className="flex h-16 w-16 sm:h-[72px] sm:w-[72px] shrink-0 items-center justify-center rounded-full bg-[#467065] text-2xl sm:text-3xl font-medium text-white shadow-sm ring-4 ring-[#E6EDE4]"
            aria-label={`Avatar for ${user.name || "Customer"}`}
          >
            {initial}
          </div>

          {/* Text block */}
          <div className="min-w-0 flex-1">
            <span className="block text-[11px] sm:text-xs font-bold uppercase tracking-[0.15em] text-[#7C9C59]">
              MY ACCOUNT
            </span>
            <h1
              className="mt-1 font-heading text-2xl sm:text-3xl lg:text-[34px] font-bold text-[#2D2D2D] leading-tight"
              data-testid="account-heading"
            >
              Hello, {firstName}
            </h1>
            <p
              className="mt-0.5 truncate text-sm sm:text-[15px] text-[#666666]"
              data-testid="account-email"
            >
              {user.email}
            </p>
            <p className="mt-1.5 text-xs sm:text-sm text-[#555555]">
              Manage your orders, addresses and rewards all in one place.
            </p>

            {/* Internal staff console shortcuts if user has elevated roles */}
            {staffRoles.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {staffRoles.map((r: string) => (
                  <Link
                    key={r}
                    to={r === "manager" ? "/manager" : r.startsWith("crm") ? "/crm" : r === "dealer" ? "/dealer" : "/admin"}
                    className={buttonVariants({ variant: "outline", size: "sm" }) + " text-xs h-7 bg-white/80 border-[#CBD6C7]"}
                  >
                    {r} console
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Sign Out Button */}
        <div className="flex items-center shrink-0 self-start md:self-center">
          <Button
            type="button"
            variant="outline"
            onClick={onSignOut}
            disabled={isSigningOut}
            className="h-10 sm:h-11 rounded-xl border-[#D3DCD0] bg-white/70 px-4 sm:px-5 text-sm font-medium text-[#2D2D2D] shadow-xs transition-colors hover:bg-white hover:border-[#CBD6C7] hover:text-[#467065] focus-visible:ring-[#467065]"
            data-testid="account-signout-button"
            aria-label="Sign out of your account"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sign out</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
