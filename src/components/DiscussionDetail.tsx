import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, MessageSquare, Flame, ThumbsUp, Send, 
  MoreHorizontal, Trash2, Clock, Eye, Flag 
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { Textarea } from "@/components/ui/textarea";
import { FollowButton } from "@/components/FollowButton";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface DiscussionReply {
  id: number;
  userId: string;
  user: string;
  avatar: string;
  avatarUrl?: string | null;
  content: string;
  timeAgo: string;
  likes: number;
  liked: boolean;
  replies?: DiscussionReply[];
}

export interface Discussion {
  id: number;
  userId: string;
  category: string;
  title: string;
  content: string;
  author: string;
  avatar: string;
  avatarUrl?: string | null;
  replies: DiscussionReply[];
  views: number;
  hot: boolean;
  createdAt: string;
}

interface DiscussionDetailProps {
  discussion: Discussion;
  onBack: () => void;
  onAddReply: (discussionId: number, content: string, parentReplyId?: number) => void;
  onLikeReply: (discussionId: number, replyId: number) => void;
  onDeleteReply: (discussionId: number, replyId: number) => void;
  onDeleteDiscussion: (discussionId: number) => void;
  onReportDiscussion?: (discussionId: number) => void;
  onReportReply?: (discussionId: number, replyId: number) => void;
  onReportUser?: (userId: string) => void;
}

export function DiscussionDetail({
  discussion,
  onBack,
  onAddReply,
  onLikeReply,
  onDeleteReply,
  onDeleteDiscussion,
  onReportDiscussion,
  onReportReply,
  onReportUser,
}: DiscussionDetailProps) {
  const { user } = useAuth();
  const [rootReplyContent, setRootReplyContent] = useState("");
  const [nestedReplyContent, setNestedReplyContent] = useState("");
  const [activeParentId, setActiveParentId] = useState<number | null>(null);

  const handleSubmitRootReply = () => {
    if (rootReplyContent.trim()) {
      onAddReply(discussion.id, rootReplyContent.trim());
      setRootReplyContent("");
    }
  };

  const handleSubmitNestedReply = () => {
    if (!activeParentId) return;
    if (nestedReplyContent.trim()) {
      onAddReply(discussion.id, nestedReplyContent.trim(), activeParentId);
      setNestedReplyContent("");
      setActiveParentId(null);
    }
  };

  const getTotalReplies = (replies: DiscussionReply[]): number => {
    return replies.reduce((sum, r) => sum + 1 + getTotalReplies(r.replies || []), 0);
  };

  const findReplyById = (replies: DiscussionReply[], id: number): DiscussionReply | null => {
    for (const r of replies) {
      if (r.id === id) return r;
      if (r.replies && r.replies.length > 0) {
        const found = findReplyById(r.replies, id);
        if (found) return found;
      }
    }
    return null;
  };

  const isOwner = user?.id === discussion.userId;

  return (
    <div className="space-y-4">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Discussions</span>
      </button>

      {/* Discussion Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <div className="flex items-start gap-4">
          <Link to={`/candidates/${discussion.userId}`} onClick={(e) => e.stopPropagation()} className="shrink-0">
            <UserAvatar src={discussion.avatarUrl || undefined} initials={discussion.avatar} size="lg" className="w-12 h-12" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary font-medium">
                {discussion.category}
              </span>
              {discussion.hot && (
                <span className="flex items-center gap-1 text-xs text-streak-fire">
                  <Flame className="w-3 h-3" />
                  HOT
                </span>
              )}
            </div>
            <h1 className="font-display font-bold text-xl mb-2">{discussion.title}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>
                by{" "}
                <Link
                  to={`/candidates/${discussion.userId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-primary transition-colors"
                >
                  {discussion.author}
                </Link>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {discussion.createdAt}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {discussion.views} views
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isOwner && (
              <FollowButton
                targetUserId={discussion.userId}
                targetUserName={discussion.author}
                variant="icon"
              />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2 rounded-full hover:bg-muted transition-colors">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isOwner ? (
                  <DropdownMenuItem
                    onClick={() => onDeleteDiscussion(discussion.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Discussion
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => onReportDiscussion?.(discussion.id)}>
                      <Flag className="w-4 h-4 mr-2" />
                      Report Discussion
                    </DropdownMenuItem>
                    {onReportUser && (
                      <DropdownMenuItem onClick={() => onReportUser(discussion.userId)}>
                        <Flag className="w-4 h-4 mr-2" />
                        Report User
                      </DropdownMenuItem>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-foreground whitespace-pre-line">{discussion.content}</p>
        </div>

        <div className="mt-4 pt-4 border-t border-border flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <MessageSquare className="w-4 h-4" />
            {getTotalReplies(discussion.replies)} replies
          </span>
        </div>
      </motion.div>

      {/* Reply Input */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-4"
      >
        <div className="flex items-start gap-3">
          <UserAvatar isCurrentUser size="md" className="w-10 h-10" />
          <div className="flex-1">
            <Textarea
              placeholder="Write a reply..."
              value={rootReplyContent}
              onChange={(e) => setRootReplyContent(e.target.value)}
              rows={3}
              maxLength={1000}
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-muted-foreground">{rootReplyContent.length}/1000</span>
              <Button
                variant="neon"
                size="sm"
                onClick={handleSubmitRootReply}
                disabled={!rootReplyContent.trim()}
              >
                <Send className="w-4 h-4 mr-2" />
                Reply
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Replies */}
      <div className="space-y-3">
        <h3 className="font-display font-bold text-lg">
          Replies ({getTotalReplies(discussion.replies)})
        </h3>
        <AnimatePresence>
          {discussion.replies.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card p-8 text-center"
            >
              <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No replies yet. Be the first to reply!</p>
            </motion.div>
          ) : (
            discussion.replies.map((reply, index) => {
              const renderReplies = (items: DiscussionReply[], level = 0) => {
                return items.map((r, idx) => {
                  const isReplyOwner = user?.id === r.userId;
                  return (
                    <motion.div
                      id={`discussion-reply-${discussion.id}-${r.id}`}
                      key={r.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ delay: (index + idx) * 0.05 }}
                      className={`glass-card p-4 ${level > 0 ? "ml-6" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        <UserAvatar src={r.avatarUrl || undefined} initials={r.avatar} size="sm" className="w-10 h-10 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Link
                              to={`/candidates/${r.userId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-semibold hover:text-primary transition-colors"
                            >
                              {r.user}
                            </Link>
                            <span className="text-xs text-muted-foreground">{r.timeAgo}</span>
                          </div>
                          <p className="text-foreground whitespace-pre-line">{r.content}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <button
                              onClick={() => onLikeReply(discussion.id, r.id)}
                              className={`flex items-center gap-1 text-sm transition-colors ${
                                r.liked
                                  ? "text-primary"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              <ThumbsUp className={`w-4 h-4 ${r.liked ? "fill-primary" : ""}`} />
                              <span>{r.likes}</span>
                            </button>
                            {!isReplyOwner && (
                              <FollowButton
                                targetUserId={r.userId}
                                targetUserName={r.user}
                                variant="compact"
                              />
                            )}
                            <button
                              className="text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setActiveParentId(r.id);
                                setNestedReplyContent("");
                              }}
                            >
                              Reply
                            </button>
                          </div>
                        </div>
                        {isReplyOwner && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1 rounded-full hover:bg-muted transition-colors">
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => onDeleteReply(discussion.id, r.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Reply
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        {!isReplyOwner && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1 rounded-full hover:bg-muted transition-colors">
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onReportReply?.(discussion.id, r.id)}>
                                <Flag className="w-4 h-4 mr-2" />
                                Report Reply
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                      {/* Inline nested reply box for this specific reply */}
                      {activeParentId === r.id && (
                        <div className="mt-3 ml-6">
                          <div className="flex items-start gap-2">
                            <UserAvatar isCurrentUser size="sm" className="w-8 h-8" />
                            <div className="flex-1">
                              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                                <span>Replying to {r.user}</span>
                                <button
                                  type="button"
                                  className="text-[11px] text-primary hover:underline"
                                  onClick={() => {
                                    setActiveParentId(null);
                                    setNestedReplyContent("");
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                              <Textarea
                                placeholder="Write a reply..."
                                value={nestedReplyContent}
                                onChange={(e) => setNestedReplyContent(e.target.value)}
                                rows={2}
                                maxLength={500}
                              />
                              <div className="flex justify-between items-center mt-1">
                                <span className="text-[11px] text-muted-foreground">
                                  {nestedReplyContent.length}/500
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleSubmitNestedReply}
                                  disabled={!nestedReplyContent.trim()}
                                >
                                  <Send className="w-3 h-3 mr-1" />
                                  Reply
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {r.replies && r.replies.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {renderReplies(r.replies, level + 1)}
                        </div>
                      )}
                    </motion.div>
                  );
                });
              };

              return <div key={reply.id}>{renderReplies([reply])}</div>;
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
