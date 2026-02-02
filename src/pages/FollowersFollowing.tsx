import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Users, UserCheck, ArrowLeft, Search } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FollowButton } from "@/components/FollowButton";
import { useAuth } from "@/hooks/useAuth";
import { useFollow } from "@/hooks/useFollow";
import { UserAvatar } from "@/components/UserAvatar";
import { apiFetch } from "@/lib/api";

interface UserData {
  id: string;
  name: string;
  avatar: string;
  title?: string;
  isMutual?: boolean;
}

export default function FollowersFollowing() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const userId = user?.id || "guest";
  const { followers, following, isFollowing, isFollowedBy } = useFollow(userId);
  const [userMap, setUserMap] = useState<Record<string, UserData>>({});
  
  const initialTab = searchParams.get("tab") === "following" ? "following" : "followers";
  const [activeTab, setActiveTab] = useState<"followers" | "following">(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Listen for follow updates
  useEffect(() => {
    const handleFollowUpdate = () => {
      setRefreshTrigger(prev => prev + 1);
    };
    window.addEventListener("follow-update", handleFollowUpdate);
    return () => window.removeEventListener("follow-update", handleFollowUpdate);
  }, []);

  useEffect(() => {
    const ids = Array.from(new Set([...followers, ...following])).filter(Boolean);
    if (ids.length === 0) {
      setUserMap({});
      return;
    }

    apiFetch<{ users: Array<{ id: string; name: string; avatar: string; xp?: number }> }>(
      `/community/users/bulk?ids=${encodeURIComponent(ids.join(","))}`
    )
      .then((d) => {
        const map: Record<string, UserData> = {};
        for (const u of Array.isArray(d?.users) ? d.users : []) {
          map[u.id] = { id: u.id, name: u.name, avatar: u.avatar };
        }
        setUserMap(map);
      })
      .catch(() => {
        setUserMap({});
      });
  }, [followers, following, refreshTrigger]);

  const followersList = useMemo(() => {
    return followers
      .map(id => {
        const userData = userMap[id];
        if (!userData) return null;
        return {
          ...userData,
          isMutual: isFollowing(id),
        };
      })
      .filter((u): u is UserData & { isMutual: boolean } => u !== null);
  }, [followers, isFollowing, userMap, refreshTrigger]);

  const followingList = useMemo(() => {
    return following
      .map(id => {
        const userData = userMap[id];
        if (!userData) return null;
        return {
          ...userData,
          isMutual: isFollowedBy(id),
        };
      })
      .filter((u): u is UserData & { isMutual: boolean } => u !== null);
  }, [following, isFollowedBy, userMap, refreshTrigger]);

  const displayList = activeTab === "followers" ? followersList : followingList;
  
  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return displayList;
    return displayList.filter(user => 
      user.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [displayList, searchQuery]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="pt-24 pb-16 px-4">
        <div className="container-custom max-w-2xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            
            <h1 className="text-3xl font-display font-bold">Your Connections</h1>
            <p className="text-muted-foreground mt-1">
              Manage your followers and people you follow
            </p>
          </motion.div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setActiveTab("followers")}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                activeTab === "followers"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card/60 text-muted-foreground hover:bg-card"
              }`}
            >
              <Users className="w-5 h-5" />
              Followers
              <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-background/20">
                {followers.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("following")}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                activeTab === "following"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card/60 text-muted-foreground hover:bg-card"
              }`}
            >
              <UserCheck className="w-5 h-5" />
              Following
              <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-background/20">
                {following.length}
              </span>
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card/60"
            />
          </div>

          {/* User List */}
          <div className="space-y-3">
            {filteredList.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card p-12 text-center"
              >
                <Users className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-display font-bold text-lg mb-2">
                  {searchQuery ? "No results found" : `No ${activeTab} yet`}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {searchQuery 
                    ? "Try a different search term"
                    : activeTab === "followers" 
                      ? "When people follow you, they'll appear here"
                      : "Start following people to see them here"
                  }
                </p>
              </motion.div>
            ) : (
              filteredList.map((userData, index) => (
                <motion.div
                  key={userData.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="glass-card p-4 flex items-center gap-4"
                >
                  <div 
                    onClick={() => navigate(`/candidates/${userData.id}`)}
                    className="cursor-pointer hover:scale-105 transition-transform"
                  >
                    <UserAvatar initials={userData.avatar} size="lg" className="w-14 h-14" />
                  </div>
                  <div 
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => navigate(`/candidates/${userData.id}`)}
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate hover:text-primary transition-colors">
                        {userData.name}
                      </h3>
                      {userData.isMutual && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                          Mutual
                        </span>
                      )}
                    </div>
                    {userData.title && (
                      <p className="text-sm text-muted-foreground truncate">
                        {userData.title}
                      </p>
                    )}
                  </div>
                  <FollowButton
                    targetUserId={userData.id}
                    targetUserName={userData.name}
                    variant="default"
                  />
                </motion.div>
              ))
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
