import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MoreHorizontal, Edit2, Trash2, X, Flag, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PostActionsProps {
  postId: number;
  isOwner: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onReport?: () => void;
  onReportUser?: () => void;
}

export function PostActions({ postId, isOwner, onEdit, onDelete, onReport, onReportUser }: PostActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-muted rounded-lg transition-colors"
      >
        <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute right-0 top-full mt-2 w-48 glass-card p-2 z-50"
            >
              {isOwner ? (
                <>
                  <button
                    onClick={() => {
                      onEdit();
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>Edit Post</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(true);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors text-left"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Post</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      onReport?.();
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    <Flag className="w-4 h-4" />
                    <span>Report Post</span>
                  </button>
                  {onReportUser && (
                    <button
                      onClick={() => {
                        onReportUser?.();
                        setIsOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
                    >
                      <UserX className="w-4 h-4" />
                      <span>Report User</span>
                    </button>
                  )}
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card p-6 max-w-sm w-full"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-display font-bold">Delete Post?</h3>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="p-1 hover:bg-muted rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-muted-foreground mb-6">
                This action cannot be undone. Are you sure you want to delete this post?
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    onDelete();
                    setShowDeleteConfirm(false);
                  }}
                >
                  Delete
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
