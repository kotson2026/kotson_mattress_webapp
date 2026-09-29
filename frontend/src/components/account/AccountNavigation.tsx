import React from "react";
import { ShoppingBag, MapPin, Users, Building2 } from "lucide-react";

export type AccountTabId = "orders" | "addresses" | "referrals" | "dealer";

interface AccountNavigationProps {
  activeTab: AccountTabId;
  onChangeTab: (tab: AccountTabId) => void;
  showDealerTab?: boolean;
}

export default function AccountNavigation({
  activeTab,
  onChangeTab,
  showDealerTab = false,
}: AccountNavigationProps) {
  const tabs = [
    {
      id: "orders" as const,
      label: "Orders",
      icon: ShoppingBag,
      testId: "account-tab-orders",
    },
    {
      id: "addresses" as const,
      label: "Addresses",
      icon: MapPin,
      testId: "account-tab-addresses",
    },
    {
      id: "referrals" as const,
      label: "Refer & Earn",
      icon: Users,
      testId: "account-tab-referrals",
    },
    ...(showDealerTab
      ? [
          {
            id: "dealer" as const,
            label: "Dealer Portal",
            icon: Building2,
            testId: "account-tab-dealer",
          },
        ]
      : []),
  ];

  return (
    <nav
      className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar border-b border-[#E3E8E1]/60"
      role="tablist"
      aria-label="Account sections"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            data-testid={tab.testId}
            onClick={() => onChangeTab(tab.id)}
            className={`relative flex items-center gap-2.5 rounded-t-xl px-5 sm:px-6 h-11 sm:h-12 text-sm font-medium transition-all shrink-0 cursor-pointer select-none ${
              isActive
                ? "bg-[#EAF0E7] text-[#467065] font-semibold"
                : "text-[#555555] hover:text-[#2D2D2D] hover:bg-[#F4F6F2] bg-transparent"
            }`}
          >
            <Icon
              className={`h-4 w-4 shrink-0 transition-colors ${
                isActive ? "text-[#467065]" : "text-[#777777]"
              }`}
            />
            <span className="whitespace-nowrap">{tab.label}</span>

            {/* Subtle bottom active indicator line */}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-t-full bg-[#467065]" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
