import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Reply, Send, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFollow } from "@/hooks/useFollow";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";

export interface Comment {
  id: number;
  userId: string;
  user: string;
  avatar: string;
  avatarUrl?: string | null;
  content: string;
  timeAgo: string;
  likes: number;
  liked: boolean;
  replies?: Comment[];
}

interface CommentSectionProps {
  postId: number;
  comments: Comment[];
  onAddComment: (postId: number, content: string) => void;
  onAddReply: (postId: number, parentCommentId: number, content: string) => void;
  onLikeComment: (postId: number, commentId: number) => void;
  onDeleteComment: (postId: number, commentId: number) => void;
}

export function CommentSection({
  postId,
  comments,
  onAddComment,
  onAddReply,
  onLikeComment,
  onDeleteComment,
}: CommentSectionProps) {
  const { user } = useAuth();
  const { isFollowing } = useFollow(user?.id || "guest");
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [expandedReplies, setExpandedReplies] = useState<Record<number, boolean>>({});

  // Sort comments: followed users first, then by id
  const sortedComments = useMemo(() => {
    return [...comments].sort((a, b) => {
      const aFollowed = isFollowing(a.userId);
      const bFollowed = isFollowing(b.userId);
      
      if (aFollowed === bFollowed) {
        return b.id - a.id; // Newer first
      }
      return aFollowed ? -1 : 1; // Followed users first
    });
  }, [comments, isFollowing]);

  const handleSubmitComment = () => {
    if (newComment.trim()) {
      onAddComment(postId, newComment.trim());
      setNewComment("");
    }
  };

  const handleSubmitReply = (commentId: number) => {
    if (replyContent.trim()) {
      onAddReply(postId, commentId, replyContent.trim());
      setReplyContent("");
      setReplyingTo(null);
      setExpandedReplies((prev) => ({ ...prev, [commentId]: true }));
    }
  };

  const countNested = (items: Comment[] = []): number => {
    return items.reduce((sum, c) => sum + 1 + countNested(Array.isArray(c.replies) ? c.replies : []), 0);
  };

  const toggleExpand = (id: number) => {
    setExpandedReplies((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));
  };

  const renderCommentNode = (comment: Comment, depth: number) => {
    const isFollowedUser = isFollowing(comment.userId);
    const replies = Array.isArray(comment.replies) ? comment.replies : [];
    const isExpanded = expandedReplies[comment.id] ?? true;
    const nestedCount = replies.length > 0 ? countNested(replies) : 0;

    return (
      <motion.div
        key={comment.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="px-4 pb-4"
        style={{ marginLeft: depth > 0 ? depth * 16 : 0 }}
      >
        <div className="flex gap-3">
          <UserAvatar
            src={comment.avatarUrl || undefined}
            initials={comment.avatar}
            size={depth === 0 ? "sm" : "xs"}
            className={isFollowedUser && depth === 0 ? "ring-2 ring-primary" : ""}
            isCurrentUser={comment.userId === user?.id}
          />
          <div className="flex-1">
            <div className={`${depth === 0 ? "bg-muted/30 rounded-2xl px-4 py-2" : "bg-muted/20 rounded-xl px-3 py-2"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`${depth === 0 ? "font-semibold text-sm" : "font-semibold text-xs"} text-foreground`}>{comment.user}</span>
                  {isFollowedUser && depth === 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      Following
                    </span>
                  )}
                  {depth > 0 && (
                    <span className="text-[10px] text-muted-foreground">{comment.timeAgo}</span>
                  )}
                </div>
                {user?.id === comment.userId && (
                  <button
                    onClick={() => onDeleteComment(postId, comment.id)}
                    className={`${depth === 0 ? "p-1" : "p-0.5"} hover:bg-destructive/20 rounded transition-colors`}
                  >
                    <Trash2 className={`${depth === 0 ? "w-3 h-3" : "w-2.5 h-2.5"} text-muted-foreground hover:text-destructive`} />
                  </button>
                )}
              </div>
              <p className={`${depth === 0 ? "text-sm" : "text-xs mt-1"} text-foreground`}>{comment.content}</p>
            </div>

            <div className={`flex items-center gap-4 ${depth === 0 ? "mt-1 ml-2" : "mt-1 ml-1"}`}>
              <button
                onClick={() => onLikeComment(postId, comment.id)}
                className={`flex items-center gap-1 ${depth === 0 ? "text-xs" : "text-[10px]"} transition-colors ${
                  comment.liked ? "text-destructive" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Heart className={`${depth === 0 ? "w-3 h-3" : "w-2.5 h-2.5"} ${comment.liked ? "fill-destructive" : ""}`} />
                {comment.likes > 0 && comment.likes}
              </button>
              <button
                onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                className={`flex items-center gap-1 ${depth === 0 ? "text-xs" : "text-[10px]"} text-muted-foreground hover:text-foreground transition-colors`}
              >
                <Reply className={`${depth === 0 ? "w-3 h-3" : "w-2.5 h-2.5"}`} />
                Reply
              </button>
              {nestedCount > 0 && (
                <button
                  onClick={() => toggleExpand(comment.id)}
                  className={`${depth === 0 ? "text-xs" : "text-[10px]"} text-muted-foreground hover:text-foreground transition-colors`}
                >
                  {isExpanded ? `Hide ${nestedCount} repl${nestedCount === 1 ? "y" : "ies"}` : `View ${nestedCount} repl${nestedCount === 1 ? "y" : "ies"}`}
                </button>
              )}
              {depth === 0 && (
                <span className="text-xs text-muted-foreground">{comment.timeAgo}</span>
              )}
            </div>

            {nestedCount > 0 && isExpanded && (
              <div className="relative mt-3 ml-4 pl-4 border-l-2 border-border space-y-3">
                {replies
                  .slice()
                  .sort((a, b) => a.id - b.id)
                  .map((r) => renderCommentNode(r, depth + 1))}
              </div>
            )}

            <AnimatePresence>
              {replyingTo === comment.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 ml-4 flex items-center gap-2"
                >
                  <UserAvatar isCurrentUser size="xs" />
                  <input
                    type="text"
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder={`Reply to ${comment.user}...`}
                    className="flex-1 bg-muted/30 rounded-full px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    onKeyPress={(e) => e.key === "Enter" && handleSubmitReply(comment.id)}
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleSubmitReply(comment.id)}
                    disabled={!replyContent.trim()}
                  >
                    <Send className="w-3 h-3" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="border-t border-border">
      {/* Add Comment */}
      <div className="p-4 flex items-center gap-3">
        <UserAvatar isCurrentUser size="sm" />
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment..."
          className="flex-1 bg-muted/50 rounded-full px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          onKeyPress={(e) => e.key === "Enter" && handleSubmitComment()}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSubmitComment}
          disabled={!newComment.trim()}
          className="shrink-0"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>

      {/* Comments List */}
      <AnimatePresence>
        {sortedComments.map((comment) => renderCommentNode(comment, 0))}
      </AnimatePresence>
    </div>
  );
}
