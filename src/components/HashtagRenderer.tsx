import { Link } from "react-router-dom";

interface HashtagRendererProps {
  content: string;
  onHashtagClick?: (hashtag: string) => void;
  onMentionClick?: (username: string) => void;
}

export function HashtagRenderer({ content, onHashtagClick, onMentionClick }: HashtagRendererProps) {
  // Parse content for hashtags and mentions
  const parseContent = (text: string) => {
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    
    // Combined regex for hashtags and mentions
    const regex = /(#\w+)|(@\w+)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      const matchedText = match[0];
      const isHashtag = matchedText.startsWith("#");
      const value = matchedText.slice(1); // Remove # or @

      if (isHashtag) {
        parts.push(
          <button
            key={`${match.index}-hashtag`}
            onClick={() => onHashtagClick?.(value)}
            className="text-primary hover:underline font-medium"
          >
            {matchedText}
          </button>
        );
      } else {
        parts.push(
          <button
            key={`${match.index}-mention`}
            onClick={() => onMentionClick?.(value)}
            className="text-secondary hover:underline font-medium"
          >
            {matchedText}
          </button>
        );
      }

      lastIndex = match.index + matchedText.length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  };

  return <span className="whitespace-pre-line">{parseContent(content)}</span>;
}

// Extract hashtags from content
export function extractHashtags(content: string): string[] {
  const regex = /#(\w+)/g;
  const hashtags: string[] = [];
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    if (!hashtags.includes(match[1].toLowerCase())) {
      hashtags.push(match[1].toLowerCase());
    }
  }
  
  return hashtags;
}

// Extract mentions from content
export function extractMentions(content: string): string[] {
  const regex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    if (!mentions.includes(match[1].toLowerCase())) {
      mentions.push(match[1].toLowerCase());
    }
  }
  
  return mentions;
}

interface TrendingHashtagsProps {
  hashtags: { tag: string; count: number }[];
  onHashtagClick: (tag: string) => void;
}

export function TrendingHashtags({ hashtags, onHashtagClick }: TrendingHashtagsProps) {
  return (
    <div className="glass-card p-4">
      <h3 className="font-display font-bold mb-3 flex items-center gap-2">
        <span className="text-lg">🔥</span> Trending
      </h3>
      <div className="space-y-2">
        {hashtags.map((item, index) => (
          <button
            key={item.tag}
            onClick={() => onHashtagClick(item.tag)}
            className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors text-left"
          >
            <div>
              <span className="text-sm text-muted-foreground">#{index + 1}</span>
              <span className="ml-2 font-medium text-primary">#{item.tag}</span>
            </div>
            <span className="text-xs text-muted-foreground">{item.count} posts</span>
          </button>
        ))}
      </div>
    </div>
  );
}
