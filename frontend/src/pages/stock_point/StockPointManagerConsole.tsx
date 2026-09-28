import React from "react";
import ConsoleLayout from "@/components/layout/ConsoleLayout";
import StockPointHub from "@/components/admin/stock_point/StockPointHub";

const MANAGER_NAV = [
  { to: "/stock-point", label: "Stock Point Operations" },
];

export default function StockPointManagerConsole() {
  return (
    <ConsoleLayout
      area="Stock Point"
      title="Stock Point Warehouse Console"
      allowedRoles={["owner", "admin", "stock_point_manager"]}
      nav={MANAGER_NAV}
    >
      <StockPointHub isOwnerAdmin={false} />
    </ConsoleLayout>
  );
}
