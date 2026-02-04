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
import AdminModerationReports from "@/admin/pages/AdminModerationReports";
import AdminCommunityGuidelines from "@/admin/pages/AdminCommunityGuidelines";
import AdminCommunityCategories from "@/admin/pages/AdminCommunityCategories";
import AdminCommunityUserDetail from "@/admin/pages/AdminCommunityUserDetail";
import AdminCommunityInsights from "@/admin/pages/AdminCommunityInsights";
import AdminInternshipCatalog from "@/admin/pages/AdminInternshipCatalog";
import AdminInternshipTasks from "@/admin/pages/AdminInternshipTasks";
import AdminInternshipSubmissions from "@/admin/pages/AdminInternshipSubmissions";
import AdminInternshipV2Templates from "@/admin/pages/AdminInternshipV2Templates";
import AdminInternshipV2Attempts from "@/admin/pages/AdminInternshipV2Attempts";
import AdminInternshipV2Batches from "@/admin/pages/AdminInternshipV2Batches";
import AdminInternshipV2Applications from "@/admin/pages/AdminInternshipV2Applications";
import AdminInternshipV2Enrollments from "@/admin/pages/AdminInternshipV2Enrollments";
import AdminInternshipV2Assignments from "@/admin/pages/AdminInternshipV2Assignments";
import AdminInternshipV2BadgeRules from "@/admin/pages/AdminInternshipV2BadgeRules";
import Index from "./pages/Index";
import Challenges from "./pages/Challenges";
import ChallengeWorkspace from "./pages/ChallengeWorkspace";
import Internships from "./pages/Internships";
import InternshipApplication from "./pages/InternshipApplication";
import InternshipDashboard from "./pages/InternshipDashboard";
import InternshipDashboardV2 from "./pages/InternshipDashboardV2";
import Community from "./pages/Community";
import Recruiters from "./pages/Recruiters";
import Jobs from "./pages/Jobs";
import CandidateProfile from "./pages/CandidateProfile";
import Profile from "./pages/Profile";
import Auth from "./pages/Auth";
import FollowersFollowing from "./pages/FollowersFollowing";
import Messages from "./pages/Messages";
import CertificateVerify from "./pages/CertificateVerify";
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
                <Route path="/internships/dashboard-v2/:id" element={<InternshipDashboardV2 />} />
                <Route path="/community" element={<Community />} />
                <Route path="/recruiters" element={<Recruiters />} />
                <Route path="/jobs" element={<Jobs />} />
                <Route path="/candidates/:id" element={<CandidateProfile />} />
                <Route path="/connections" element={<FollowersFollowing />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/verify/certificate" element={<CertificateVerify />} />
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
                  <Route path="reports" element={<AdminModerationReports />} />
                  <Route path="community-guidelines" element={<AdminCommunityGuidelines />} />
                  <Route path="community-categories" element={<AdminCommunityCategories />} />
                  <Route path="community-users/:id" element={<AdminCommunityUserDetail />} />
                  <Route path="community-insights" element={<AdminCommunityInsights />} />
                  <Route path="profile" element={<AdminProfileBadges />} />
                  <Route path="challenges" element={<AdminChallenges />} />
                  <Route path="internships" element={<AdminInternships />} />
                  <Route path="internship-catalog" element={<AdminInternshipCatalog />} />
                  <Route path="internship-tasks" element={<AdminInternshipTasks />} />
                  <Route path="internship-submissions" element={<AdminInternshipSubmissions />} />
                  <Route path="internship-v2-templates" element={<AdminInternshipV2Templates />} />
                  <Route path="internship-v2-badge-rules" element={<AdminInternshipV2BadgeRules />} />
                  <Route path="internship-v2-assignments" element={<AdminInternshipV2Assignments />} />
                  <Route path="internship-v2-attempts" element={<AdminInternshipV2Attempts />} />
                  <Route path="internship-v2-batches" element={<AdminInternshipV2Batches />} />
                  <Route path="internship-v2-applications" element={<AdminInternshipV2Applications />} />
                  <Route path="internship-v2-enrollments" element={<AdminInternshipV2Enrollments />} />
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
