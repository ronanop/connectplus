/** Mirrors backend `HR_MODULES` for labels before fetch. */
export const HR_MODULES_STATIC = [
  { id: "departments", label: "Department management", path: "/hr/departments" },
  { id: "payroll", label: "Payroll", path: "/hr/payroll" },
  { id: "attendance", label: "Attendance", path: "/hr/attendance" },
  { id: "onboarding", label: "Onboarding", path: "/hr/onboarding" },
  { id: "assets", label: "Assets", path: "/hr/assets" },
  { id: "rooms", label: "Rooms & bookings", path: "/hr/rooms" },
  { id: "tickets", label: "Tickets", path: "/hr/tickets" },
  { id: "expenses", label: "Expenses", path: "/hr/expenses" },
  { id: "announcements", label: "Announcements", path: "/hr/announcements" },
  { id: "settings", label: "HR settings", path: "/hr/settings" },
] as const;
