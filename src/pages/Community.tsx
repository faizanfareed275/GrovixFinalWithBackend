import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageSquare, Star, Users, Trophy, Calendar, 
  ThumbsUp, MessageCircle, Share2, BookOpen, Flame,
  Send, Image, Video, MoreHorizontal, Bookmark, Globe,
  Heart, Repeat2, Plus, ChevronDown, ChevronUp, UserPlus,
  Copy, Link2, Twitter, Facebook, Linkedin, Search, BookmarkCheck,
  Sparkles, BarChart3, Loader2, MapPin
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CommunitySidebar } from "@/components/CommunitySidebar";
import { CreatePostModal } from "@/components/CreatePostModal";
import { PostActions } from "@/components/PostActions";
import { EditPostModal } from "@/components/EditPostModal";
import { CommentSection, Comment } from "@/components/CommentSection";
import { FollowButton } from "@/components/FollowButton";
import { EventRegistrationModal } from "@/components/EventRegistrationModal";
import { CreateDiscussionModal } from "@/components/CreateDiscussionModal";
import { DiscussionDetail, Discussion, DiscussionReply } from "@/components/DiscussionDetail";
import { ImageLightbox } from "@/components/ImageLightbox";
import { ReactionPicker, ReactionType, REACTIONS } from "@/components/ReactionPicker";
import { PollDisplay, Poll } from "@/components/PollCreator";
import { HashtagRenderer, extractHashtags, TrendingHashtags } from "@/components/HashtagRenderer";
import { ReportDialog, ReportDialogTarget } from "@/components/ReportDialog";
import { useAuth } from "@/hooks/useAuth";
import { useFollow } from "@/hooks/useFollow";
import { useStreak } from "@/hooks/useStreak";
import { useForYouFeed } from "@/hooks/useForYouFeed";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import heroBg from "@/assets/hero-bg.jpg";
import skillAi from "@/assets/skill-ai.png";
import skillWebdev from "@/assets/skill-webdev.png";
import skillGamedev from "@/assets/skill-gamedev.png";
import skillBlockchain from "@/assets/skill-blockchain.png";

interface Post {
  id: number;
  userId: string;
  user: string;
  avatar: string;
  avatarUrl?: string | null;
  title: string;
  company: string;
  timeAgo: string;
  content: string;
  images: string[];
  xp: number;
  likes: number;
  comments: Comment[];
  shares: number;
  liked: boolean;
  saved: boolean;
  reactions?: Record<ReactionType, number>;
  userReaction?: ReactionType | null;
  poll?: Poll | null;
  aiScore?: number;
  aiReason?: string;
}

function countNestedComments(items: Comment[] = []): number {
  return items.reduce((sum, c) => sum + 1 + countNestedComments(Array.isArray(c.replies) ? c.replies : []), 0);
}

const initialFeedPosts: Post[] = [
  {
    id: 1,
    userId: "system-1",
    user: "Alex Chen",
    avatar: "AC",
    title: "Software Engineer Intern",
    company: "TechCorp",
    timeAgo: "2h",
    content: "Just completed my first AI Image Classifier challenge on Grovix! 🎉 After weeks of learning #NeuralNetworks, I finally built something that works. The community feedback was incredibly helpful. Thank you to everyone who reviewed my code! #AI #MachineLearning @Grovix",
    images: [],
    xp: 500,
    likes: 156,
    comments: [
      {
        id: 1,
        userId: "user-1",
        user: "Mike Wilson",
        avatar: "MW",
        content: "Great work Alex! The neural network implementation looks solid.",
        timeAgo: "1h",
        likes: 12,
        liked: false,
        replies: [
          {
            id: 1,
            userId: "system-1",
            user: "Alex Chen",
            avatar: "AC",
            content: "Thanks Mike! Appreciate the feedback.",
            timeAgo: "45m",
            likes: 3,
            liked: false,
          }
        ]
      }
    ],
    shares: 12,
    liked: false,
    saved: false,
    reactions: { like: 80, love: 45, laugh: 5, fire: 20, clap: 6 },
    userReaction: null,
    poll: null,
  },
  {
    id: 2,
    userId: "system-2",
    user: "Sarah Kim",
    avatar: "SK",
    title: "Full Stack Developer",
    company: "StartupXYZ",
    timeAgo: "5h",
    content: "Excited to share my E-commerce Dashboard project! Built with #React, #TypeScript, and #TailwindCSS. This was part of the Web Dev challenge track. Would love to get your feedback! #WebDev #Frontend",
    images: ["https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=60"],
    xp: 450,
    likes: 234,
    comments: [],
    shares: 28,
    liked: true,
    saved: true,
    reactions: { like: 100, love: 80, laugh: 2, fire: 40, clap: 12 },
    userReaction: "love",
    poll: {
      question: "Which framework should I use for my next project?",
      options: [
        { id: 1, text: "Next.js", votes: 45 },
        { id: 2, text: "Remix", votes: 23 },
        { id: 3, text: "Astro", votes: 18 },
      ],
      totalVotes: 86,
      userVote: null,
    },
  },
  {
    id: 3,
    userId: "system-3",
    user: "Marcus Johnson",
    avatar: "MJ",
    title: "Blockchain Developer",
    company: "Web3Labs",
    timeAgo: "1d",
    content: "🚀 Big milestone! Just hit Level 15 on Grovix and unlocked my first paid internship opportunity. The journey from learning #Solidity to building a full #DeFi protocol was incredible. Here's what I learned along the way...\n\n1. Start with the basics\n2. Build projects, not just tutorials\n3. Engage with the community\n4. Never stop learning\n\n#Blockchain #Web3 #Crypto @Grovix",
    images: [],
    xp: 800,
    likes: 512,
    comments: [],
    shares: 56,
    liked: false,
    saved: false,
    reactions: { like: 200, love: 150, laugh: 10, fire: 100, clap: 52 },
    userReaction: null,
    poll: null,
  },
  {
    id: 4,
    userId: "system-4",
    user: "Emily Zhang",
    avatar: "EZ",
    title: "AI/ML Enthusiast",
    company: "University Student",
    timeAgo: "2d",
    content: "Just published my first tutorial on building chatbots with #LLMs! Check it out in the Guidelines section. Thanks to the Grovix mentors who helped me refine the content. 📚 #AI #ChatGPT #Tutorial @TechNinja",
    images: ["https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&auto=format&fit=crop&q=60"],
    xp: 350,
    likes: 189,
    comments: [],
    shares: 21,
    liked: true,
    saved: false,
    reactions: { like: 89, love: 60, laugh: 5, fire: 25, clap: 10 },
    userReaction: "like",
    poll: null,
  },
];

const initialDiscussions: Discussion[] = [
  {
    id: 1,
    userId: "system-1",
    category: "AI & ML",
    title: "Best practices for training large language models",
    content: "I've been working on fine-tuning LLMs for specific tasks and wanted to share some insights. What techniques have worked best for you?\n\n1. Start with a smaller model and scale up\n2. Use quality data over quantity\n3. Implement proper evaluation metrics early\n\nWould love to hear your experiences!",
    author: "TechNinja",
    avatar: "TN",
    replies: [
      {
        id: 1,
        userId: "user-1",
        user: "DataScientist",
        avatar: "DS",
        content: "Great points! I'd add that using LoRA for fine-tuning can significantly reduce compute costs.",
        timeAgo: "2h ago",
        likes: 12,
        liked: false,
      },
    ],
    views: 1234,
    hot: true,
    createdAt: "2 days ago",
  },
  {
    id: 2,
    userId: "system-2",
    category: "Web Dev",
    title: "React vs Vue in 2024 - which one to learn?",
    content: "I'm starting my web development journey and trying to decide between React and Vue. What would you recommend for a beginner in 2024?\n\nI've heard React has more job opportunities but Vue is easier to learn. What's your take?",
    author: "CodeMaster",
    avatar: "CM",
    replies: [],
    views: 2567,
    hot: true,
    createdAt: "3 days ago",
  },
  {
    id: 3,
    userId: "system-3",
    category: "Internships",
    title: "How I landed my first tech internship at 19",
    content: "Just got my first tech internship offer and wanted to share my journey! Here's what helped me:\n\n1. Built 5 projects showcasing different skills\n2. Contributed to open source\n3. Networked on LinkedIn and tech communities\n4. Practiced coding interviews for 2 months\n\nAsk me anything!",
    author: "YoungDev",
    avatar: "YD",
    replies: [],
    views: 5678,
    hot: false,
    createdAt: "1 week ago",
  },
];

interface Event {
  id: number;
  title: string;
  date: string | null;
  participants: number;
  prize: string | null;
  type: string;
  description?: string;
  venue?: string;
  link?: string | null;
  enrolled?: boolean;
}

function getEventCoverImage(type: string | null | undefined) {
  const t = String(type || "").toLowerCase();
  if (t.includes("hack")) return skillAi;
  if (t.includes("work")) return heroBg;
  if (t.includes("challenge")) return skillWebdev;
  if (t.includes("game")) return skillGamedev;
  if (t.includes("block")) return skillBlockchain;
  return heroBg;
}

function addReplyToTree(replies: DiscussionReply[], parentId: number, reply: DiscussionReply): DiscussionReply[] {
  return replies.map((r) => {
    if (r.id === parentId) {
      return { ...r, replies: [...(r.replies || []), reply] };
    }
    if (r.replies && r.replies.length > 0) {
      return { ...r, replies: addReplyToTree(r.replies, parentId, reply) };
    }
    return r;
  });
}

function updateReplyInTree(
  replies: DiscussionReply[],
  replyId: number,
  updater: (reply: DiscussionReply) => DiscussionReply
): DiscussionReply[] {
  return replies.map((r) => {
    if (r.id === replyId) return updater(r);
    if (r.replies && r.replies.length > 0) {
      return { ...r, replies: updateReplyInTree(r.replies, replyId, updater) };
    }
    return r;
  });
}

function deleteReplyFromTree(replies: DiscussionReply[], replyId: number): DiscussionReply[] {
  return replies
    .filter((r) => r.id !== replyId)
    .map((r) => {
      if (r.replies && r.replies.length > 0) {
        return { ...r, replies: deleteReplyFromTree(r.replies, replyId) };
      }
      return r;
    });
}

function toggleReplyLike(replies: DiscussionReply[], replyId: number): DiscussionReply[] {
  return updateReplyInTree(replies, replyId, (r) => ({
    ...r,
    liked: !r.liked,
    likes: r.liked ? Math.max(0, r.likes - 1) : r.likes + 1,
  }));
}

function PostCard({
  post,
  currentUserId,
  isFollowedPost,
  onEdit,
  onDelete,
  onSave,
  onReportPost,
  onReportComment,
  onRepost,
  onShare,
  onReact,
  onVotePoll,
  onHashtagClick,
  onMentionClick,
  onAddComment,
  onAddReply,
  onLikeComment,
  onDeleteComment,
}: {
  post: Post;
  currentUserId: string | null;
  isFollowedPost?: boolean;
  onEdit: (postId: number) => void;
  onDelete: (postId: number) => void;
  onSave: (postId: number) => void;
  onReportPost: (postId: number) => void;
  onReportComment: (postId: number, commentId: number) => void;
  onRepost: (post: Post) => void;
  onShare: (postId: number) => void;
  onReact: (postId: number, reaction: ReactionType) => void;
  onVotePoll: (postId: number, optionId: number) => void;
  onHashtagClick: (hashtag: string) => void;
  onMentionClick: (username: string) => void;
  onAddComment: (postId: number, content: string) => void;
  onAddReply: (postId: number, commentId: number, content: string) => void;
  onLikeComment: (postId: number, commentId: number) => void;
  onDeleteComment: (postId: number, commentId: number) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const handleSave = () => {
    onSave(post.id);
  };

  const handleReact = (type: ReactionType) => {
    onReact(post.id, type);
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/community/post/${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
      onShare(post.id);
    } catch {
      toast.error("Failed to copy link");
    }
    setShowShareMenu(false);
  };

  const handleNativeShare = async () => {
    const url = `${window.location.origin}/community/post/${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Post by ${post.user}`,
          text: post.content.slice(0, 100) + "...",
          url,
        });
        onShare(post.id);
      } catch (err) {
        // User cancelled
      }
    } else {
      handleCopyLink();
    }
    setShowShareMenu(false);
  };

  const handleSocialShare = (platform: string) => {
    const url = `${window.location.origin}/community/post/${post.id}`;
    const text = encodeURIComponent(post.content.slice(0, 100));
    let shareUrl = "";
    
    switch (platform) {
      case "twitter":
        shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${text}`;
        break;
      case "facebook":
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        break;
      case "linkedin":
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
        break;
    }
    
    window.open(shareUrl, "_blank", "width=600,height=400");
    onShare(post.id);
    setShowShareMenu(false);
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const isOwner = currentUserId === post.userId;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-card overflow-hidden ${isFollowedPost ? 'ring-1 ring-primary/20' : ''}`}
    >
      {/* Post Header */}
      <div className="p-4 flex items-start gap-3">
        <UserAvatar
          src={post.avatarUrl || undefined}
          initials={post.avatar}
          size="lg"
          isCurrentUser={post.userId === currentUserId}
          className={isFollowedPost ? "ring-2 ring-primary" : ""}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground">{post.user}</h3>
            {isFollowedPost && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                Following
              </span>
            )}
            {post.xp && (
              <span className="text-xs text-primary font-medium">+{post.xp} XP</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{post.title} at {post.company}</p>
          <p className="text-xs text-muted-foreground">{post.timeAgo}</p>
        </div>
        <div className="flex items-center gap-1">
          {!isOwner && (
            <FollowButton 
              targetUserId={post.userId} 
              targetUserName={post.user}
              variant="icon"
            />
          )}
          <PostActions
            postId={post.id}
            isOwner={isOwner}
            onEdit={() => onEdit(post.id)}
            onDelete={() => onDelete(post.id)}
            onReport={() => onReportPost(post.id)}
          />
        </div>
      </div>

      {/* Post Content with Hashtags/Mentions */}
      <div className="px-4 pb-3">
        <HashtagRenderer 
          content={post.content} 
          onHashtagClick={onHashtagClick}
          onMentionClick={onMentionClick}
        />
      </div>

      {/* Post Images - Clickable with full display */}
      {post.images && post.images.length > 0 && (
        <div className={`grid gap-1 ${
          post.images.length === 1 ? 'grid-cols-1' : 
          post.images.length === 2 ? 'grid-cols-2' :
          post.images.length === 3 ? 'grid-cols-2' :
          'grid-cols-2'
        }`}>
          {post.images.map((image, index) => (
            <div 
              key={index}
              onClick={() => openLightbox(index)}
              className={`relative cursor-pointer group overflow-hidden ${
                post.images.length === 3 && index === 0 ? 'row-span-2' : ''
              }`}
            >
              <img 
                src={image} 
                alt={`Post content ${index + 1}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                style={{ 
                  aspectRatio: post.images.length === 1 ? '16/9' : 
                         (post.images.length === 3 && index === 0) ? '9/16' : '1/1',
                  maxHeight: post.images.length === 1 ? '500px' : '250px'
                }}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-gray-800" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Lightbox */}
      <ImageLightbox
        images={post.images}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />

      {/* Engagement Stats */}
      <div className="px-4 py-2 flex items-center justify-between text-sm text-muted-foreground border-t border-border">
        <div className="flex items-center gap-2">
          {post.reactions && Object.entries(post.reactions)
            .filter(([_, count]) => count > 0)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([type]) => (
              <span key={type}>{REACTIONS.find(r => r.type === type)?.emoji}</span>
            ))}
          <span>{Object.values(post.reactions || {}).reduce((a, b) => a + b, 0) || post.likes}</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowComments(!showComments)}
            className="hover:text-foreground transition-colors"
          >
            {countNestedComments(post.comments)} comments
          </button>
          <span>{post.shares} shares</span>
        </div>
      </div>

      {/* Poll Display */}
      {post.poll && (
        <div className="px-4 pb-3">
          <PollDisplay poll={post.poll} onVote={(optionId) => onVotePoll(post.id, optionId)} />
        </div>
      )}

      {/* Action Buttons */}
      <div className="px-4 py-2 flex items-center justify-between border-t border-border">
        <ReactionPicker
          onReact={handleReact}
          currentReaction={post.userReaction}
          reactionCounts={post.reactions || { like: 0, love: 0, laugh: 0, fire: 0, clap: 0 }}
        />
        <button 
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline">Comment</span>
          {showComments ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        
        {/* Share Button with Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setShowShareMenu(!showShareMenu)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Share2 className="w-5 h-5" />
            <span className="text-sm font-medium hidden sm:inline">Share</span>
          </button>
          
          <AnimatePresence>
            {showShareMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowShareMenu(false)} 
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="absolute bottom-full right-0 mb-2 w-48 glass-card p-2 z-50"
                >
                  <button
                    onClick={() => {
                      onRepost(post);
                      setShowShareMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left text-primary"
                  >
                    <Repeat2 className="w-4 h-4" />
                    <span>Repost</span>
                  </button>
                  <hr className="my-1 border-border" />
                  <button
                    onClick={handleNativeShare}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Share</span>
                  </button>
                  <button
                    onClick={handleCopyLink}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copy Link</span>
                  </button>
                  <hr className="my-1 border-border" />
                  <button
                    onClick={() => handleSocialShare("twitter")}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    <Twitter className="w-4 h-4" />
                    <span>Twitter/X</span>
                  </button>
                  <button
                    onClick={() => handleSocialShare("facebook")}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    <Facebook className="w-4 h-4" />
                    <span>Facebook</span>
                  </button>
                  <button
                    onClick={() => handleSocialShare("linkedin")}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    <Linkedin className="w-4 h-4" />
                    <span>LinkedIn</span>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <button 
          onClick={handleSave}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
            post.saved ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Bookmark className={`w-5 h-5 ${post.saved ? "fill-primary" : ""}`} />
          <span className="text-sm font-medium hidden sm:inline">Save</span>
        </button>
      </div>

      {/* Comments Section */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <CommentSection
              postId={post.id}
              comments={post.comments}
              onAddComment={onAddComment}
              onAddReply={onAddReply}
              onLikeComment={onLikeComment}
              onDeleteComment={onDeleteComment}
              onReportComment={onReportComment}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Community() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { following, isFollowing } = useFollow(user?.id || "guest");
  const { recordActivity } = useStreak();
  const [activeTab, setActiveTab] = useState("feed");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [followUpdateTrigger, setFollowUpdateTrigger] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventRegistrationTick, setEventRegistrationTick] = useState(0);
  const [events, setEvents] = useState<Event[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const sseRefetchTimer = useRef<number | null>(null);
  const sseSourceRef = useRef<EventSource | null>(null);
  
  // Discussion state
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [selectedDiscussion, setSelectedDiscussion] = useState<Discussion | null>(null);
  const [isCreateDiscussionOpen, setIsCreateDiscussionOpen] = useState(false);

  const [reportTarget, setReportTarget] = useState<ReportDialogTarget | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const defaultApiUrl =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:4000`
      : "http://localhost:4000";
  const apiUrl = (import.meta as any).env?.VITE_GROVIX_API_URL || defaultApiUrl;

  const ensureSignedIn = () => {
    if (user) return true;
    toast.error("Please sign in to continue");
    navigate("/auth");
    return false;
  };

  const openReport = (target: ReportDialogTarget) => {
    if (!ensureSignedIn()) return;
    setReportTarget(target);
    setReportOpen(true);
  };

  const handleReportPost = (postId: number) => {
    openReport({ targetType: "POST", targetLegacyId: postId, label: `Post #${postId}` });
  };

  const handleReportPostComment = (postId: number, commentId: number) => {
    openReport({
      targetType: "POST_COMMENT",
      targetLegacyId: postId,
      targetNodeId: commentId,
      label: `Comment #${commentId} on Post #${postId}`,
    });
  };

  const handleReportDiscussionReply = (discussionId: number, replyId: number) => {
    openReport({
      targetType: "DISCUSSION_REPLY",
      targetLegacyId: discussionId,
      targetNodeId: replyId,
      label: `Reply #${replyId} on Discussion #${discussionId}`,
    });
  };

  const toastApiError = (e: any, fallback: string) => {
    const status = e?.status;
    if (status === 401) return toast.error("Please sign in to continue");
    if (status === 403) return toast.error("You don't have permission to do that");
    return toast.error(fallback);
  };

  const persistDiscussions = (next: Discussion[]) => {
    if (!ensureSignedIn()) return;

    let prevSnapshot: Discussion[] = [];
    setDiscussions((prev) => {
      prevSnapshot = prev;
      return next;
    });

    apiFetch("/community/discussions", {
      method: "PUT",
      body: JSON.stringify({ discussions: next }),
    }).catch((e) => {
      setDiscussions(prevSnapshot);
      toastApiError(e, "Failed to save discussions");
    });
  };

  const fetchDiscussions = useCallback(async () => {
    try {
      const d = await apiFetch<{ discussions: Discussion[] }>("/community/discussions");
      if (Array.isArray(d?.discussions)) setDiscussions(d.discussions);
    } catch {
    }
  }, []);

  const fetchPosts = useCallback(async () => {
    try {
      const d = await apiFetch<{ posts: Post[] }>("/community/posts");
      if (Array.isArray(d?.posts)) setPosts(d.posts);
    } catch {
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const d = await apiFetch<{ events: Event[] }>("/events");
      if (Array.isArray((d as any)?.events)) setEvents((d as any).events);
    } catch {
    }
  }, []);

  const persistPosts = (next: Post[]) => {
    if (!ensureSignedIn()) return;

    let prevSnapshot: Post[] = [];
    setPosts((prev) => {
      prevSnapshot = prev;
      return next;
    });

    apiFetch("/community/posts", {
      method: "PUT",
      body: JSON.stringify({ posts: next }),
    }).catch((e) => {
      setPosts(prevSnapshot);
      toastApiError(e, "Failed to save posts");
    });
  };

  useEffect(() => {
    fetchDiscussions().catch(() => {});
    fetchPosts().catch(() => {});
    fetchEvents().catch(() => {});
  }, [fetchDiscussions, fetchPosts, fetchEvents]);

  useEffect(() => {
    const onProfileUpdated = () => {
      fetchDiscussions().catch(() => {});
      fetchPosts().catch(() => {});
    };

    window.addEventListener("profile-updated", onProfileUpdated);
    return () => window.removeEventListener("profile-updated", onProfileUpdated);
  }, [fetchDiscussions, fetchPosts]);

  useAutoRefresh({
    enabled: true,
    intervalMs: 45000,
    onRefresh: () => {
      fetchDiscussions().catch(() => {});
      fetchEvents().catch(() => {});
      fetchPosts().catch(() => {});
    },
  });

  useEffect(() => {
    if (!user?.id) return;

    if (sseSourceRef.current) {
      try {
        sseSourceRef.current.close();
      } catch {
      }
      sseSourceRef.current = null;
    }

    const url = `${apiUrl}/community/events`;
    const es = new EventSource(url, { withCredentials: true } as any);
    sseSourceRef.current = es;

    const scheduleRefetch = () => {
      if (sseRefetchTimer.current) return;
      sseRefetchTimer.current = window.setTimeout(() => {
        sseRefetchTimer.current = null;
        apiFetch<{ posts: Post[] }>("/community/posts")
          .then((d) => {
            if (Array.isArray(d.posts)) setPosts(d.posts);
          })
          .catch(() => {});
      }, 350);
    };

    es.addEventListener("posts_changed", scheduleRefetch as any);

    es.onerror = () => {
      // Let the browser auto-reconnect.
    };

    return () => {
      if (sseRefetchTimer.current) {
        window.clearTimeout(sseRefetchTimer.current);
        sseRefetchTimer.current = null;
      }
      try {
        es.close();
      } catch {
      }
      if (sseSourceRef.current === es) sseSourceRef.current = null;
    };
  }, [user?.id, apiUrl]);

  // Listen for follow updates to re-sort feed
  useEffect(() => {
    const handleFollowUpdate = () => {
      setFollowUpdateTrigger(prev => prev + 1);
    };
    window.addEventListener("follow-update", handleFollowUpdate);
    return () => window.removeEventListener("follow-update", handleFollowUpdate);
  }, []);

  // Filter and sort posts
  const filteredAndSortedPosts = useMemo(() => {
    let filtered = posts;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = posts.filter(post => 
        post.content.toLowerCase().includes(query) ||
        post.user.toLowerCase().includes(query) ||
        post.title.toLowerCase().includes(query) ||
        post.company.toLowerCase().includes(query)
      );
    }
    
    // Sort: followed users' posts first, then by id (newer first)
    return [...filtered].sort((a, b) => {
      const aFollowed = isFollowing(a.userId);
      const bFollowed = isFollowing(b.userId);
      
      if (aFollowed === bFollowed) {
        return b.id - a.id;
      }
      return aFollowed ? -1 : 1;
    });
  }, [posts, isFollowing, followUpdateTrigger, searchQuery]);

  // Get saved posts
  const savedPosts = useMemo(() => {
    return posts.filter(post => post.saved);
  }, [posts]);

  const handleCreatePost = (newPost: { content: string; images: string[]; poll?: Poll | null }) => {
    if (!ensureSignedIn()) return;

    apiFetch<{ post: Post }>("/community/posts", {
      method: "POST",
      body: JSON.stringify({ content: newPost.content, images: newPost.images, poll: newPost.poll || null }),
    })
      .then((d) => {
        if (d?.post) setPosts((prev) => [d.post, ...prev]);
        toast.success("Post created successfully! +50 XP");
      })
      .catch((e) => {
        toastApiError(e, "Failed to create post");
      });
    
    // Record activity for streak
    recordActivity();
  };

  const handleEditPost = (postId: number) => {
    const post = posts.find(p => p.id === postId);
    if (post) {
      setEditingPost(post);
    }
  };

  const handleSaveEdit = (content: string, images: string[]) => {
    if (editingPost) {
      if (!ensureSignedIn()) return;

      apiFetch<{ post: Post }>(`/community/posts/${editingPost.id}`, {
        method: "PATCH",
        body: JSON.stringify({ content, images }),
      })
        .then((d) => {
          if (d?.post) setPosts((prev) => prev.map((p) => (p.id === d.post.id ? d.post : p)));
          setEditingPost(null);
          toast.success("Post updated successfully!");
        })
        .catch((e) => {
          toastApiError(e, "Failed to update post");
        });
    }
  };

  const handleDeletePost = (postId: number) => {
    if (!ensureSignedIn()) return;

    apiFetch(`/community/posts/${postId}`, { method: "DELETE" })
      .then(() => {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        toast.success("Post deleted successfully!");
      })
      .catch((e) => {
        toastApiError(e, "Failed to delete post");
      });
  };

  const handleSavePost = (postId: number) => {
    if (!ensureSignedIn()) return;

    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, saved: !p.saved } : p))
    );

    apiFetch<{ saved: boolean }>(`/community/posts/${postId}/save`, { method: "POST" })
      .then((d) => {
        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, saved: !!d.saved } : p)));
        toast.success(d.saved ? "Post saved!" : "Post unsaved");
      })
      .catch((e) => {
        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, saved: !p.saved } : p)));
        toastApiError(e, "Failed to save post");
      });
  };

  // Reaction handler
  const handleReact = (postId: number, reaction: ReactionType) => {
    if (!ensureSignedIn()) return;

    const prev = posts;
    setPosts((p) =>
      p.map((x) => (x.id === postId ? { ...x, userReaction: x.userReaction === reaction ? null : reaction } : x))
    );

    apiFetch<{ userReaction: ReactionType | null; reactions: Record<ReactionType, number> }>(
      `/community/posts/${postId}/reaction`,
      {
        method: "POST",
        body: JSON.stringify({ reaction }),
      }
    )
      .then((d) => {
        setPosts((p) =>
          p.map((x) => (x.id === postId ? { ...x, userReaction: d.userReaction, reactions: d.reactions } : x))
        );
      })
      .catch((e) => {
        setPosts(prev);
        toastApiError(e, "Failed to react to post");
      });
  };

  // Poll vote handler
  const handleVotePoll = (postId: number, optionId: number) => {
    if (!ensureSignedIn()) return;

    const prevSnapshot = posts;

    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId || !p.poll || p.poll.userVote) return p;
        const updatedPoll: Poll = {
          ...p.poll,
          options: p.poll.options.map((opt) => (opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt)),
          totalVotes: p.poll.totalVotes + 1,
          userVote: optionId,
        };
        return { ...p, poll: updatedPoll };
      })
    );

    apiFetch<{ poll: Poll }>(`/community/posts/${postId}/poll/vote`, {
      method: "POST",
      body: JSON.stringify({ optionId }),
    })
      .then((d) => {
        if (!d?.poll) return;
        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, poll: d.poll } : p)));
      })
      .catch((e) => {
        setPosts(prevSnapshot);
        const status = e?.status;
        if (status === 409) return toast.error("You already voted on this poll");
        toastApiError(e, "Failed to vote on poll");
      });
  };

  // Hashtag/Mention handlers
  const handleHashtagClick = (hashtag: string) => {
    setSearchQuery(`#${hashtag}`);
    setActiveTab("feed");
    toast.success(`Showing posts with #${hashtag}`);
  };

  const handleMentionClick = (username: string) => {
    setSearchQuery(`@${username}`);
    setActiveTab("feed");
  };

  // Repost handler
  const handleRepost = (post: Post) => {
    if (!ensureSignedIn()) return;

    apiFetch<{ post: Post }>("/community/posts", {
      method: "POST",
      body: JSON.stringify({
        content: `🔁 Reposted from @${post.user}:\n\n${post.content}`,
        images: post.images,
        xp: 25,
        title: "Grovix Member",
        company: "Reposted",
      }),
    })
      .then((d) => {
        if (d?.post) setPosts((prev) => [d.post, ...prev]);
        handleShare(post.id);
        toast.success("Post reposted successfully!");
      })
      .catch((e) => {
        toastApiError(e, "Failed to repost");
      });
  };

  const handleShare = (postId: number) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, shares: p.shares + 1 } : p)));
    apiFetch(`/community/posts/${postId}/share`, { method: "POST" }).catch(() => {});
  };

  // Comment handlers
  const handleAddComment = (postId: number, content: string) => {
    if (!ensureSignedIn()) return;

    apiFetch<{ comments: Comment[] }>(`/community/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ content }),
    })
      .then((d) => {
        if (Array.isArray(d?.comments)) {
          setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: d.comments } : p)));
        }
      })
      .catch((e) => {
        toastApiError(e, "Failed to add comment");
      });
  };

  const handleAddReply = (postId: number, commentId: number, content: string) => {
    if (!ensureSignedIn()) return;

    apiFetch<{ comments: Comment[] }>(`/community/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ content, parentId: commentId }),
    })
      .then((d) => {
        if (Array.isArray(d?.comments)) {
          setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: d.comments } : p)));
        }
      })
      .catch((e) => {
        toastApiError(e, "Failed to add reply");
      });
  };

  const handleLikeComment = (postId: number, commentId: number) => {
    if (!ensureSignedIn()) return;

    apiFetch<{ comments: Comment[] }>(`/community/posts/${postId}/comments/${commentId}/like`, { method: "POST" })
      .then((d) => {
        if (Array.isArray(d?.comments)) {
          setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: d.comments } : p)));
        }
      })
      .catch((e) => {
        toastApiError(e, "Failed to like comment");
      });
  };

  const handleDeleteComment = (postId: number, commentId: number) => {
    if (!ensureSignedIn()) return;

    apiFetch<{ comments: Comment[] }>(`/community/posts/${postId}/comments/${commentId}`, { method: "DELETE" })
      .then((d) => {
        if (Array.isArray(d?.comments)) {
          setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: d.comments } : p)));
        }
        toast.success("Comment deleted");
      })
      .catch((e) => {
        toastApiError(e, "Failed to delete comment");
      });
  };

  const handleCreateDiscussion = (discussion: { category: string; title: string; content: string }) => {
    if (!ensureSignedIn()) return;

    const newDiscussion: Discussion = {
      id: Date.now(),
      userId: user?.id || "guest",
      category: discussion.category,
      title: discussion.title,
      content: discussion.content,
      author: user?.name || "Guest User",
      avatar: user?.avatar || "GU",
      avatarUrl: user?.avatarUrl || null,
      replies: [],
      views: 0,
      hot: false,
      createdAt: "Just now",
    };

    persistDiscussions([newDiscussion, ...discussions]);
    toast.success("Discussion created successfully!");
  };

  const handleAddDiscussionReply = (discussionId: number, content: string, parentReplyId?: number) => {
    if (!ensureSignedIn()) return;

    const reply: DiscussionReply = {
      id: Date.now(),
      userId: user?.id || "guest",
      user: user?.name || "Guest User",
      avatar: user?.avatar || "GU",
      avatarUrl: user?.avatarUrl || null,
      content,
      timeAgo: "Just now",
      likes: 0,
      liked: false,
      replies: [],
    };

    const nextDiscussions = discussions.map((d) => {
      if (d.id !== discussionId) return d;
      const nextReplies = parentReplyId
        ? addReplyToTree(d.replies, parentReplyId, reply)
        : [...d.replies, reply];
      return { ...d, replies: nextReplies };
    });
    persistDiscussions(nextDiscussions);

    if (selectedDiscussion?.id === discussionId) {
      setSelectedDiscussion((prev) => {
        if (!prev) return null;
        const nextReplies = parentReplyId
          ? addReplyToTree(prev.replies, parentReplyId, reply)
          : [...prev.replies, reply];
        return { ...prev, replies: nextReplies };
      });
    }
  };

  const handleLikeDiscussionReply = (discussionId: number, replyId: number) => {
    if (!ensureSignedIn()) return;

    const nextDiscussions = discussions.map((d) => {
      if (d.id !== discussionId) return d;
      return { ...d, replies: toggleReplyLike(d.replies, replyId) };
    });
    persistDiscussions(nextDiscussions);

    if (selectedDiscussion?.id === discussionId) {
      setSelectedDiscussion((prev) => {
        if (!prev) return null;
        return { ...prev, replies: toggleReplyLike(prev.replies, replyId) };
      });
    }
  };

  const handleDeleteDiscussionReply = (discussionId: number, replyId: number) => {
    if (!ensureSignedIn()) return;

    const nextDiscussions = discussions.map(d => {
      if (d.id === discussionId) {
        return { ...d, replies: deleteReplyFromTree(d.replies, replyId) };
      }
      return d;
    });
    persistDiscussions(nextDiscussions);

    if (selectedDiscussion?.id === discussionId) {
      setSelectedDiscussion(prev => {
        if (!prev) return null;
        return { ...prev, replies: deleteReplyFromTree(prev.replies, replyId) };
      });
    }

    toast.success("Reply deleted");
  };

  const handleDeleteDiscussion = (discussionId: number) => {
    if (!ensureSignedIn()) return;

    apiFetch(`/community/discussions/${discussionId}`, { method: "DELETE" })
      .then(() => {
        setDiscussions((prev) => prev.filter((d) => d.id !== discussionId));
        setSelectedDiscussion(null);
        toast.success("Discussion deleted");
      })
      .catch((e) => {
        toastApiError(e, "Failed to delete discussion");
      });
  };

  const handleOpenDiscussion = (discussion: Discussion) => {
    setDiscussions((prev) => prev.map((d) => (d.id === discussion.id ? { ...d, views: d.views + 1 } : d)));
    setSelectedDiscussion({ ...discussion, views: discussion.views + 1 });
    apiFetch(`/community/discussions/${discussion.id}/view`, { method: "POST" }).catch(() => {});
  };

  useEffect(() => {
    const onRegistered = () => setEventRegistrationTick((x) => x + 1);
    window.addEventListener("event-registered", onRegistered);
    return () => window.removeEventListener("event-registered", onRegistered);
  }, []);

  useEffect(() => {
    apiFetch<{ events: Event[] }>("/events")
      .then((d) => {
        if (Array.isArray((d as any)?.events)) setEvents((d as any).events);
      })
      .catch(() => {});
  }, [eventRegistrationTick]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="pt-28 pb-16">
        <div className="container mx-auto px-4">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <span className="inline-block px-4 py-1 rounded-full bg-secondary/20 text-secondary text-sm font-medium mb-4">
              COMMUNITY
            </span>
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">
              Connect, Learn, <span className="gradient-text">Grow Together</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Join thousands of young professionals sharing knowledge and building skills
            </p>
          </motion.div>

          {/* Main Layout - Sidebar + Content */}
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar - Hidden on mobile, shown on desktop with independent scroll */}
            <div className="hidden lg:block w-80 shrink-0">
              <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-cyber">
                <CommunitySidebar activeTab={activeTab} onTabChange={setActiveTab} />
              </div>
            </div>

            {/* Mobile Tabs */}
            <div className="lg:hidden">
              <div className="flex overflow-x-auto gap-2 pb-4 scrollbar-cyber">
                {[
                  { id: "feed", label: "Feed", icon: Globe },
                  { id: "saved", label: "Saved", icon: BookmarkCheck },
                  { id: "discussions", label: "Discussions", icon: MessageSquare },
                  { id: "guidelines", label: "Guidelines", icon: BookOpen },
                  { id: "events", label: "Events", icon: Calendar },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
                      activeTab === tab.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-card/60 text-muted-foreground"
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Feed Tab */}
                  {activeTab === "feed" && (
                    <div className="space-y-4">
                      {/* Search Bar */}
                      <div className="glass-card p-4">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                          <Input
                            placeholder="Search posts by keyword, user, or topic..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 bg-muted/50 border-0"
                          />
                        </div>
                      </div>

                      {/* Create Post Card */}
                      <div className="glass-card p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-neon flex items-center justify-center text-sm font-bold text-primary-foreground dark:text-cyber-dark shrink-0">
                            {user?.avatar || "GU"}
                          </div>
                          <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="flex-1 bg-muted/50 rounded-full px-4 py-3 text-left text-muted-foreground hover:bg-muted transition-colors"
                          >
                            Share your progress, ask questions, or celebrate wins...
                          </button>
                          <Button 
                            variant="neon" 
                            size="icon"
                            onClick={() => setIsCreateModalOpen(true)}
                            className="shrink-0"
                          >
                            <Plus className="w-5 h-5" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                          <button 
                            onClick={() => setIsCreateModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-primary"
                          >
                            <Image className="w-5 h-5" />
                            <span className="text-sm">Photo</span>
                          </button>
                          <button className="flex items-center gap-2 px-4 py-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-secondary">
                            <Video className="w-5 h-5" />
                            <span className="text-sm">Video</span>
                          </button>
                          <button className="flex items-center gap-2 px-4 py-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-accent">
                            <Trophy className="w-5 h-5" />
                            <span className="text-sm">Achievement</span>
                          </button>
                        </div>
                      </div>

                      {/* Search Results Info */}
                      {searchQuery && (
                        <div className="text-sm text-muted-foreground px-2">
                          Found {filteredAndSortedPosts.length} post{filteredAndSortedPosts.length !== 1 ? 's' : ''} matching "{searchQuery}"
                        </div>
                      )}

                      {/* Feed Posts */}
                      {filteredAndSortedPosts.length > 0 ? (
                        filteredAndSortedPosts.map((post) => (
                          <PostCard 
                            key={post.id} 
                            post={post}
                            currentUserId={user?.id || null}
                            isFollowedPost={isFollowing(post.userId)}
                            onEdit={handleEditPost}
                            onDelete={handleDeletePost}
                            onSave={handleSavePost}
                            onReportPost={handleReportPost}
                            onReportComment={handleReportPostComment}
                            onRepost={handleRepost}
                            onShare={handleShare}
                            onReact={handleReact}
                            onVotePoll={handleVotePoll}
                            onHashtagClick={handleHashtagClick}
                            onMentionClick={handleMentionClick}
                            onAddComment={handleAddComment}
                            onAddReply={handleAddReply}
                            onLikeComment={handleLikeComment}
                            onDeleteComment={handleDeleteComment}
                          />
                        ))
                      ) : (
                        <div className="glass-card p-8 text-center">
                          <Search className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                          <p className="text-muted-foreground">No posts found matching your search.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Saved Posts Tab */}
                  {activeTab === "saved" && (
                    <div className="space-y-4">
                      <div className="glass-card p-4">
                        <div className="flex items-center gap-3">
                          <BookmarkCheck className="w-6 h-6 text-primary" />
                          <div>
                            <h2 className="font-display font-bold text-lg">Saved Posts</h2>
                            <p className="text-sm text-muted-foreground">
                              {savedPosts.length} saved post{savedPosts.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                      </div>

                      {savedPosts.length > 0 ? (
                        savedPosts.map((post) => (
                          <PostCard 
                            key={post.id} 
                            post={post}
                            currentUserId={user?.id || null}
                            isFollowedPost={isFollowing(post.userId)}
                            onEdit={handleEditPost}
                            onDelete={handleDeletePost}
                            onSave={handleSavePost}
                            onReportPost={handleReportPost}
                            onReportComment={handleReportPostComment}
                            onRepost={handleRepost}
                            onShare={handleShare}
                            onReact={handleReact}
                            onVotePoll={handleVotePoll}
                            onHashtagClick={handleHashtagClick}
                            onMentionClick={handleMentionClick}
                            onAddComment={handleAddComment}
                            onAddReply={handleAddReply}
                            onLikeComment={handleLikeComment}
                            onDeleteComment={handleDeleteComment}
                          />
                        ))
                      ) : (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="glass-card p-8 text-center"
                        >
                          <Bookmark className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                          <p className="text-muted-foreground mb-2">No saved posts yet</p>
                          <p className="text-sm text-muted-foreground">
                            Click the bookmark icon on any post to save it for later.
                          </p>
                        </motion.div>
                      )}
                    </div>
                  )}

                  {/* Discussions Tab */}
                  {activeTab === "discussions" && (
                    <div className="space-y-4">
                      {selectedDiscussion ? (
                        <DiscussionDetail
                          discussion={selectedDiscussion}
                          onBack={() => setSelectedDiscussion(null)}
                          onAddReply={handleAddDiscussionReply}
                          onLikeReply={handleLikeDiscussionReply}
                          onDeleteReply={handleDeleteDiscussionReply}
                          onDeleteDiscussion={handleDeleteDiscussion}
                          onReportDiscussion={(discussionId) => openReport({ targetType: "DISCUSSION", targetLegacyId: discussionId, label: `Discussion #${discussionId}` })}
                          onReportReply={handleReportDiscussionReply}
                          onReportUser={(userId) => handleReportUser(userId, `User ${selectedDiscussion.author}`)}
                        />
                      ) : (
                        <>
                          {/* Create Discussion Button */}
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="glass-card p-4"
                          >
                            <Button
                              variant="neon"
                              className="w-full"
                              onClick={() => setIsCreateDiscussionOpen(true)}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Start a Discussion
                            </Button>
                          </motion.div>

                          {/* Discussion List */}
                          {discussions.map((discussion) => (
                            <motion.div
                              key={discussion.id}
                              whileHover={{ x: 5 }}
                              onClick={() => handleOpenDiscussion(discussion)}
                              className="glass-card p-5 flex items-center gap-4 cursor-pointer group"
                            >
                              <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center shrink-0">
                                <MessageSquare className="w-6 h-6 text-secondary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs text-primary font-medium">{discussion.category}</span>
                                  {discussion.hot && (
                                    <span className="flex items-center gap-1 text-xs text-streak-fire">
                                      <Flame className="w-3 h-3" />
                                      HOT
                                    </span>
                                  )}
                                </div>
                                <h3 className="font-display font-bold truncate group-hover:text-primary transition-colors">
                                  {discussion.title}
                                </h3>
                                <div className="text-sm text-muted-foreground">
                                  by{" "}
                                  <button
                                    type="button"
                                    className="hover:text-primary transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/candidates/${discussion.userId}`);
                                    }}
                                  >
                                    {discussion.author}
                                  </button>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-bold text-primary">{discussion.replies.length}</div>
                                <div className="text-xs text-muted-foreground">replies</div>
                              </div>
                            </motion.div>
                          ))}

                          {discussions.length === 0 && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="glass-card p-8 text-center"
                            >
                              <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                              <p className="text-muted-foreground">No discussions yet. Start one!</p>
                            </motion.div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Guidelines Tab */}
                  {activeTab === "guidelines" && (
                    <div className="grid sm:grid-cols-2 gap-6">
                      {[
                        { title: "Getting Started Guide", desc: "Learn how to start your journey on Grovix", icon: "🚀" },
                        { title: "Challenge Submission Rules", desc: "Quality standards for submitting challenges", icon: "📝" },
                        { title: "Community Guidelines", desc: "Rules for a healthy and supportive community", icon: "🤝" },
                        { title: "Mentorship Program", desc: "How to become or find a mentor", icon: "🎓" },
                        { title: "XP & Leveling System", desc: "Understanding how XP and levels work", icon: "⚡" },
                        { title: "Internship Application Tips", desc: "Best practices for applying to internships", icon: "💼" },
                      ].map((guide, index) => (
                        <motion.div
                          key={guide.title}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="glass-card p-6 cursor-pointer hover:bg-card/80 transition-colors group"
                        >
                          <div className="text-4xl mb-4">{guide.icon}</div>
                          <h3 className="font-display font-bold text-lg mb-2 group-hover:text-primary transition-colors">
                            {guide.title}
                          </h3>
                          <p className="text-muted-foreground text-sm">{guide.desc}</p>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Events Tab */}
                  {activeTab === "events" && (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {events.map((event, index) => (
                        <motion.div
                          key={event.id}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.08 }}
                          className="h-full"
                        >
                          <Card className="h-full overflow-hidden border-border/50 bg-card/50 backdrop-blur">
                            <div className="relative h-40 w-full">
                              <img
                                src={getEventCoverImage(event.type)}
                                alt={event.title}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
                              <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
                                <Badge variant="secondary" className="capitalize">
                                  {event.type || "event"}
                                </Badge>
                                {event.enrolled && <Badge>Enrolled</Badge>}
                              </div>
                            </div>

                            <CardContent className="p-5">
                              <div className="flex items-start justify-between gap-3">
                                <h3 className="font-display font-bold text-lg leading-tight line-clamp-2">
                                  {event.title}
                                </h3>
                              </div>
                              {event.description && (
                                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{event.description}</p>
                              )}
                              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4" />
                                  <span>{event.date || "TBA"}</span>
                                </div>
                                {event.venue && (
                                  <div className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4" />
                                    <span className="truncate">{event.venue}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <Users className="w-4 h-4" />
                                  <span>{event.participants} participants</span>
                                </div>
                                {event.prize && (
                                  <div className="flex items-center gap-2">
                                    <Trophy className="w-4 h-4" />
                                    <span className="truncate">{event.prize}</span>
                                  </div>
                                )}
                              </div>
                            </CardContent>

                            <CardFooter className="p-5 pt-0">
                              <div className="w-full flex items-center justify-end">
                                <Button
                                  variant={event.enrolled ? "outline" : "neon"}
                                  disabled={!!event.enrolled}
                                  onClick={() => {
                                    if (!ensureSignedIn()) return;
                                    setSelectedEvent(event);
                                    setIsEventModalOpen(true);
                                  }}
                                >
                                  {event.enrolled ? "Enrolled" : "Register"}
                                </Button>
                              </div>
                            </CardFooter>
                          </Card>
                        </motion.div>
                      ))}

                      {events.length === 0 && (
                        <div className="sm:col-span-2 lg:col-span-3 glass-card p-10 text-center text-muted-foreground">
                          No events available right now.
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreatePost}
      />

      {/* Edit Post Modal */}
      <EditPostModal
        isOpen={!!editingPost}
        onClose={() => setEditingPost(null)}
        onSave={handleSaveEdit}
        initialContent={editingPost?.content || ""}
        initialImages={editingPost?.images || []}
      />

      {/* Event Registration Modal */}
      <EventRegistrationModal
        isOpen={isEventModalOpen}
        onClose={() => {
          setIsEventModalOpen(false);
          setSelectedEvent(null);
        }}
        event={selectedEvent}
      />

      {/* Create Discussion Modal */}
      <CreateDiscussionModal
        isOpen={isCreateDiscussionOpen}
        onClose={() => setIsCreateDiscussionOpen(false)}
        onSubmit={handleCreateDiscussion}
      />

      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} target={reportTarget} />
    </div>
  );
}
