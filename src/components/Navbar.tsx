import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, Trophy, Users, Briefcase, Building2, User, Gamepad2, Home, MessageCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import { useAuth } from "@/hooks/useAuth";
import { useChat } from "@/hooks/useChat";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Home", href: "/", icon: Home },
  { name: "Challenges", href: "/challenges", icon: Gamepad2 },
  { name: "Internships", href: "/internships", icon: Briefcase },
  { name: "Community", href: "/community", icon: Users },
  { name: "Recruiters", href: "/recruiters", icon: Trophy },
  { name: "Jobs", href: "/jobs", icon: Building2 },
];

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { getTotalUnreadCount, loadConversations } = useChat(user?.id || null);
  const unreadMessages = getTotalUnreadCount();

  useEffect(() => {
    if (!user?.id) return;
    loadConversations().catch(() => {});
  }, [user?.id, loadConversations]);

  return (
    <>
      {/* Desktop/Tablet Top Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 hidden md:block">
        <div className="glass-card mx-4 mt-4 rounded-2xl border border-border">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              {/* Logo */}
              <Link to="/" className="flex items-center gap-2 group">
                <div className="relative">
                  <div className="w-10 h-10 rounded-lg bg-gradient-neon flex items-center justify-center">
                    <Zap className="w-6 h-6 text-primary-foreground dark:text-cyber-dark" />
                  </div>
                  <div className="absolute inset-0 rounded-lg bg-gradient-neon blur-lg opacity-50 group-hover:opacity-100 transition-opacity" />
                </div>
                <span className="font-display text-xl font-bold gradient-text">
                  Grovix
                </span>
              </Link>

              {/* Desktop Navigation */}
              <div className="flex items-center gap-1">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={cn(
                        "relative px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 flex items-center gap-2",
                        isActive
                          ? "text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.name}
                      {isActive && (
                        <motion.div
                          layoutId="navbar-indicator"
                          className="absolute inset-0 bg-primary/10 rounded-lg border border-primary/20"
                          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                      )}
                    </Link>
                  );
                })}
              </div>

              {/* Desktop Actions */}
              <div className="flex items-center gap-2">
                <Link to="/messages" className="relative p-2 hover:bg-muted rounded-lg transition-colors">
                  <MessageCircle className="w-5 h-5" />
                  {unreadMessages > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                      {unreadMessages > 9 ? "9+" : unreadMessages}
                    </span>
                  )}
                </Link>
                <NotificationDropdown />
                <ThemeToggle />
                <Link to="/profile">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <User className="w-4 h-4" />
                    Profile
                  </Button>
                </Link>
                {user ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await logout();
                      navigate("/auth");
                    }}
                  >
                    Logout
                  </Button>
                ) : (
                  <Link to="/auth">
                    <Button variant="neon" size="sm">
                      Get Started
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Top Bar (minimal) */}
      <nav className="fixed top-0 left-0 right-0 z-50 md:hidden">
        <div className="glass-card mx-3 mt-3 rounded-xl border border-border">
          <div className="flex items-center justify-between h-14 px-4">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-neon flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary-foreground dark:text-cyber-dark" />
              </div>
              <span className="font-display text-lg font-bold gradient-text">
                Grovix
              </span>
            </Link>

            {/* Mobile Actions */}
            <div className="flex items-center gap-1">
              <Link to="/messages" className="relative p-2 hover:bg-muted rounded-lg transition-colors">
                <MessageCircle className="w-5 h-5" />
                {unreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadMessages > 9 ? "9+" : unreadMessages}
                  </span>
                )}
              </Link>
              <NotificationDropdown />
              <ThemeToggle />
              <Link to={user ? "/profile" : "/auth"}>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <User className="w-5 h-5" />
                </Button>
              </Link>
              {user && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={async () => {
                    await logout();
                    navigate("/auth");
                  }}
                >
                  <LogOut className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Tab Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        <div className="glass-card border-t border-border">
          <div className="flex items-center justify-around h-16 px-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-xl transition-all duration-300 min-w-[60px]",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="mobile-tab-indicator"
                      className="absolute inset-0 bg-primary/10 rounded-xl border border-primary/20"
                      transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                    />
                  )}
                  <item.icon className={cn(
                    "w-5 h-5 relative z-10 transition-transform duration-200",
                    isActive && "scale-110"
                  )} />
                  <span className={cn(
                    "text-[10px] font-medium relative z-10 transition-all duration-200",
                    isActive ? "opacity-100" : "opacity-70"
                  )}>
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

    </>
  );
}
