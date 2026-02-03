import { useEffect, useMemo, useState } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Menu, ChevronDown, ChevronRight, Target, ClipboardCheck } from "lucide-react";
import { LayoutDashboard, Users, MessageSquare, Trophy, Briefcase, Calendar, Bell, Mail, Database, Award, BookOpen, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navSections: Array<{
  title: string;
  items: Array<{ to: string; label: string; icon: any }>;
}> = [
  {
    title: "Overview",
    items: [
      { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Users & Rewards",
    items: [
      { to: "/admin/users", label: "Users", icon: Users },
      { to: "/admin/profile", label: "Profile & Badges", icon: Award },
      { to: "/admin/challenges", label: "Challenges & XP", icon: Trophy },
    ],
  },
  {
    title: "Community",
    items: [
      { to: "/admin/community", label: "Posts", icon: MessageSquare },
      { to: "/admin/discussions", label: "Discussions", icon: MessageSquare },
      { to: "/admin/events", label: "Events", icon: Calendar },
    ],
  },
  {
    title: "Internships",
    items: [
      { to: "/admin/internship-catalog", label: "Catalog", icon: BookOpen },
      { to: "/admin/internships", label: "Enrollments", icon: Briefcase },
      { to: "/admin/internship-tasks", label: "Tasks", icon: Target },
      { to: "/admin/internship-submissions", label: "Submissions", icon: ClipboardCheck },
      { to: "/admin/internship-v2-templates", label: "v2 Templates", icon: Target },
      { to: "/admin/internship-v2-badge-rules", label: "v2 Badge Rules", icon: Award },
      { to: "/admin/internship-v2-assignments", label: "v2 Assignments", icon: Target },
      { to: "/admin/internship-v2-attempts", label: "v2 Attempts", icon: ClipboardCheck },
      { to: "/admin/internship-v2-batches", label: "v2 Batches", icon: Calendar },
      { to: "/admin/internship-v2-applications", label: "v2 Applications", icon: Users },
      { to: "/admin/internship-v2-enrollments", label: "v2 Enrollments", icon: Briefcase },
    ],
  },
  {
    title: "Communication",
    items: [
      { to: "/admin/messages", label: "Messages", icon: Mail },
      { to: "/admin/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    title: "System",
    items: [
      { to: "/admin/storage", label: "Storage Tools", icon: Database },
    ],
  },
];

export default function AdminLayout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("youthxp_admin_sidebar_collapsed") === "1";
    } catch {
      return false;
    }
  });

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Overview: true,
    "Users & Rewards": true,
    Community: true,
    Internships: true,
    Communication: true,
    System: true,
  });

  const handleLogout = async () => {
    await logout();
    navigate("/auth");
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("youthxp_admin_sidebar_collapsed", next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  const activeInfo = (() => {
    for (const section of navSections) {
      for (const item of section.items) {
        if (location.pathname === item.to) {
          return { sectionTitle: section.title, itemLabel: item.label };
        }
      }
    }
    // fallback when nested routes change
    const match = navSections
      .flatMap(s => s.items.map(i => ({ sectionTitle: s.title, item: i })))
      .find(x => location.pathname.startsWith(x.item.to));
    return match ? { sectionTitle: match.sectionTitle, itemLabel: match.item.label } : { sectionTitle: "Admin", itemLabel: "" };
  })();

  const activeSectionTitle = useMemo(() => activeInfo.sectionTitle, [activeInfo.sectionTitle]);

  useEffect(() => {
    setOpenSections((prev) => ({
      ...prev,
      [activeSectionTitle]: true,
    }));
  }, [activeSectionTitle]);

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="space-y-5">
      {navSections.map((section) => (
        <div key={section.title} className="space-y-1">
          <button
            type="button"
            onClick={() =>
              setOpenSections((prev) => ({
                ...prev,
                [section.title]: !prev[section.title],
              }))
            }
            className={`w-full px-3 py-2 flex items-center justify-between rounded-lg hover:bg-muted transition-colors ${
              isSidebarCollapsed ? "hidden" : ""
            }`}
          >
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground/80">
              {section.title}
            </span>
            <ChevronRight
              className={`w-4 h-4 text-muted-foreground transition-transform ${
                openSections[section.title] ? "rotate-90" : "rotate-0"
              }`}
            />
          </button>

          {(isSidebarCollapsed || openSections[section.title]) && (
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  title={item.label}
                  className={({ isActive }) =>
                    `flex items-center gap-3 py-2 rounded-lg transition-colors ${
                      isSidebarCollapsed ? "px-3 justify-center" : "pl-6 pr-3"
                    } ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`
                  }
                >
                  <item.icon className="w-4 h-4" />
                  {!isSidebarCollapsed && (
                    <span className="text-sm font-medium">{item.label}</span>
                  )}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="min-h-screen flex">
        <aside
          className={`hidden lg:flex shrink-0 border-r border-border bg-card/60 backdrop-blur-lg transition-all ${
            isSidebarCollapsed ? "w-20" : "w-72"
          }`}
        >
          <div className="w-full flex flex-col">
            <div className="p-5 border-b border-border">
              <div className="flex items-start justify-between gap-2">
                <div className={isSidebarCollapsed ? "hidden" : ""}>
                  <div className="text-lg font-display font-bold">Admin Panel</div>
                  <div className="text-sm text-muted-foreground truncate">{user?.email || ""}</div>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleSidebar}
                  title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  <ChevronRight
                    className={`w-5 h-5 transition-transform ${
                      isSidebarCollapsed ? "rotate-0" : "rotate-180"
                    }`}
                  />
                </Button>
              </div>
            </div>

            <div className="p-3 flex-1">
              <NavList />
            </div>

            <div className="p-4 border-t border-border">
              <Button
                variant="outline"
                className={isSidebarCollapsed ? "w-full justify-center" : "w-full"}
                onClick={handleLogout}
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
                {!isSidebarCollapsed && "Logout"}
              </Button>
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <div className="border-b border-border bg-card/60 backdrop-blur-lg sticky top-0 z-40">
            <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="lg:hidden">
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="icon">
                        <Menu className="w-5 h-5" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0">
                      <SheetHeader className="p-5 border-b border-border">
                        <SheetTitle>Admin Panel</SheetTitle>
                        <div className="text-sm text-muted-foreground truncate">{user?.email || ""}</div>
                      </SheetHeader>
                      <div className="p-3">
                        <NavList />
                      </div>
                      <div className="p-4 border-t border-border">
                        <Button variant="outline" className="w-full" onClick={handleLogout}>
                          <LogOut className="w-4 h-4" />
                          Logout
                        </Button>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>

                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground truncate">{activeInfo.sectionTitle}</div>
                  <div className="font-display font-bold truncate">{activeInfo.itemLabel || "Admin"}</div>
                </div>

                {/* Category dropdown navigation */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      Categories
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    {navSections.map((section) => (
                      <DropdownMenuSub key={section.title}>
                        <DropdownMenuSubTrigger>
                          {section.title}
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-60">
                          {section.items.map((item) => (
                            <DropdownMenuItem
                              key={item.to}
                              onClick={() => navigate(item.to)}
                            >
                              <item.icon className="w-4 h-4 mr-2" />
                              {item.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  <LogOut className="w-4 h-4" />
                  Logout
                </Button>
              </div>
            </div>
          </div>

          <main className="container mx-auto px-4 py-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
