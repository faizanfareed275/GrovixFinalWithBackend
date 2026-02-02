import { useMemo } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

export function UserAvatar({
  initials,
  src,
  isCurrentUser = false,
  size = "md",
  className,
  rounded = "full",
}: {
  initials?: string;
  src?: string;
  isCurrentUser?: boolean;
  size?: Size;
  className?: string;
  rounded?: "full" | "md" | "lg" | "xl";
}) {
  const { user } = useAuth();

  const imageSrc = useMemo(() => {
    if (isCurrentUser) {
      if (
        user?.avatarUrl &&
        typeof user.avatarUrl === "string" &&
        (user.avatarUrl.startsWith("http") || user.avatarUrl.startsWith("data:"))
      ) {
        return user.avatarUrl;
      }
    }
    if (src && (src.startsWith("data:") || src.startsWith("http"))) return src;
    return null;
  }, [isCurrentUser, src, user?.id, user?.avatarUrl]);

  const label = useMemo(() => {
    if (initials && typeof initials === "string" && initials.trim()) return initials.slice(0, 2).toUpperCase();
    if (isCurrentUser && user?.name) return user.name.split(" ").map((n) => n[0]).join("").toUpperCase();
    return "?";
  }, [initials, isCurrentUser, user?.name]);

  const sizeClasses: Record<Size, string> = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
    xl: "h-16 w-16 text-xl",
  };

  const roundedClass = rounded === "full" ? "rounded-full" : rounded === "md" ? "rounded-md" : rounded === "lg" ? "rounded-lg" : "rounded-xl";

  return (
    <Avatar className={cn(sizeClasses[size], roundedClass, className)}>
      {imageSrc ? (
        <AvatarImage src={imageSrc} alt="Avatar" className={roundedClass} />
      ) : (
        <AvatarFallback className={cn("font-bold text-white", roundedClass)} style={{ backgroundColor: "#4CAF50" }}>
          {label}
        </AvatarFallback>
      )}
    </Avatar>
  );
}
