import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/hooks/useAuth";
import { ChatProvider } from "@/hooks/useChat";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AdminLayout from "@/admin/layout/AdminLayout";
import { AdminGuard, AdminIndexRedirect } from "@/admin/components/AdminGuard";
import AdminDashboard from "@/admin/pages/AdminDashboard";
import AdminUsers from "@/admin/pages/AdminUsers";
import AdminCommunity from "@/admin/pages/AdminCommunity";
import AdminChallenges from "@/admin/pages/AdminChallenges";
import AdminInternships from "@/admin/pages/AdminInternships";
import AdminEvents from "@/admin/pages/AdminEvents";
import AdminMessages from "@/admin/pages/AdminMessages";
import AdminNotifications from "@/admin/pages/AdminNotifications";
import AdminStorage from "@/admin/pages/AdminStorage";
import AdminDiscussions from "@/admin/pages/AdminDiscussions";
import AdminProfileBadges from "@/admin/pages/AdminProfileBadges";
import AdminInternshipCatalog from "@/admin/pages/AdminInternshipCatalog";
import AdminInternshipTasks from "@/admin/pages/AdminInternshipTasks";
import AdminInternshipSubmissions from "@/admin/pages/AdminInternshipSubmissions";
import Index from "./pages/Index";
import Challenges from "./pages/Challenges";
import ChallengeWorkspace from "./pages/ChallengeWorkspace";
import Internships from "./pages/Internships";
import InternshipApplication from "./pages/InternshipApplication";
import InternshipDashboard from "./pages/InternshipDashboard";
import Community from "./pages/Community";
import Recruiters from "./pages/Recruiters";
import Jobs from "./pages/Jobs";
import CandidateProfile from "./pages/CandidateProfile";
import Profile from "./pages/Profile";
import Auth from "./pages/Auth";
import FollowersFollowing from "./pages/FollowersFollowing";
import Messages from "./pages/Messages";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <ChatProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/challenges" element={<Challenges />} />
                <Route path="/challenges/:id" element={<ChallengeWorkspace />} />
                <Route path="/internships" element={<Internships />} />
                <Route path="/internships/apply/:id" element={<InternshipApplication />} />
                <Route path="/internships/dashboard/:id" element={<InternshipDashboard />} />
                <Route path="/community" element={<Community />} />
                <Route path="/recruiters" element={<Recruiters />} />
                <Route path="/jobs" element={<Jobs />} />
                <Route path="/candidates/:id" element={<CandidateProfile />} />
                <Route path="/connections" element={<FollowersFollowing />} />
                <Route path="/messages" element={<Messages />} />
                <Route
                  path="/admin"
                  element={
                    <AdminGuard>
                      <AdminLayout />
                    </AdminGuard>
                  }
                >
                  <Route index element={<AdminIndexRedirect />} />
                  <Route path="dashboard" element={<AdminDashboard />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="community" element={<AdminCommunity />} />
                  <Route path="discussions" element={<AdminDiscussions />} />
                  <Route path="profile" element={<AdminProfileBadges />} />
                  <Route path="challenges" element={<AdminChallenges />} />
                  <Route path="internships" element={<AdminInternships />} />
                  <Route path="internship-catalog" element={<AdminInternshipCatalog />} />
                  <Route path="internship-tasks" element={<AdminInternshipTasks />} />
                  <Route path="internship-submissions" element={<AdminInternshipSubmissions />} />
                  <Route path="events" element={<AdminEvents />} />
                  <Route path="messages" element={<AdminMessages />} />
                  <Route path="notifications" element={<AdminNotifications />} />
                  <Route path="storage" element={<AdminStorage />} />
                </Route>
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </ChatProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
