import { useState, useEffect, useCallback } from "react";

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  recipientId: string;
  content: string;
  timestamp: number;
  type: "text" | "image";
  imageUrl?: string;
  read: boolean;
}

export interface Conversation {
  recipientId: string;
  recipientName: string;
  recipientAvatar: string;
  lastMessage: string;
  lastMessageTime: number;
  unreadCount: number;
}

export function useMessages(userId: string) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);

  const getStorageKey = useCallback((recipientId: string) => {
    // Create a consistent key regardless of who initiated the conversation
    const ids = [userId, recipientId].sort();
    return `youthxp_messages_${ids[0]}_${ids[1]}`;
  }, [userId]);

  const loadConversations = useCallback(() => {
    const stored = localStorage.getItem(`youthxp_conversations_${userId}`);
    if (stored) {
      setConversations(JSON.parse(stored));
    }
  }, [userId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    const handleNewMessage = (e: CustomEvent) => {
      if (e.detail.recipientId === userId || e.detail.senderId === userId) {
        loadConversations();
      }
    };

    window.addEventListener("new-message", handleNewMessage as EventListener);
    return () => {
      window.removeEventListener("new-message", handleNewMessage as EventListener);
    };
  }, [userId, loadConversations]);

  const loadMessages = useCallback((recipientId: string) => {
    const stored = localStorage.getItem(getStorageKey(recipientId));
    const messages = stored ? JSON.parse(stored) : [];
    setActiveMessages(messages);
    return messages;
  }, [getStorageKey]);

  const sendMessage = useCallback((
    recipientId: string,
    recipientName: string,
    recipientAvatar: string,
    content: string,
    senderName: string,
    senderAvatar: string,
    type: "text" | "image" = "text",
    imageUrl?: string
  ) => {
    const newMessage: Message = {
      id: crypto.randomUUID(),
      senderId: userId,
      senderName,
      senderAvatar,
      recipientId,
      content,
      timestamp: Date.now(),
      type,
      imageUrl,
      read: false,
    };

    // Save message to conversation
    const storageKey = getStorageKey(recipientId);
    const stored = localStorage.getItem(storageKey);
    const messages = stored ? JSON.parse(stored) : [];
    messages.push(newMessage);
    localStorage.setItem(storageKey, JSON.stringify(messages));
    setActiveMessages(messages);

    // Update sender's conversations
    updateConversation(userId, recipientId, recipientName, recipientAvatar, content, 0);
    
    // Update recipient's conversations
    const recipientConversations = localStorage.getItem(`youthxp_conversations_${recipientId}`);
    const recipientConvos = recipientConversations ? JSON.parse(recipientConversations) : [];
    const existingRecipientConvo = recipientConvos.find((c: Conversation) => c.recipientId === userId);
    
    if (existingRecipientConvo) {
      existingRecipientConvo.lastMessage = content;
      existingRecipientConvo.lastMessageTime = Date.now();
      existingRecipientConvo.unreadCount += 1;
    } else {
      recipientConvos.unshift({
        recipientId: userId,
        recipientName: senderName,
        recipientAvatar: senderAvatar,
        lastMessage: content,
        lastMessageTime: Date.now(),
        unreadCount: 1,
      });
    }
    localStorage.setItem(`youthxp_conversations_${recipientId}`, JSON.stringify(recipientConvos));

    // Dispatch event for real-time updates
    window.dispatchEvent(new CustomEvent("new-message", { 
      detail: { 
        senderId: userId, 
        senderName,
        senderAvatar,
        recipientId, 
        message: newMessage 
      } 
    }));

    return newMessage;
  }, [userId, getStorageKey]);

  const updateConversation = useCallback((
    ownerId: string,
    recipientId: string,
    recipientName: string,
    recipientAvatar: string,
    lastMessage: string,
    unreadDelta: number
  ) => {
    const stored = localStorage.getItem(`youthxp_conversations_${ownerId}`);
    const convos: Conversation[] = stored ? JSON.parse(stored) : [];
    const existing = convos.find(c => c.recipientId === recipientId);
    
    if (existing) {
      existing.lastMessage = lastMessage;
      existing.lastMessageTime = Date.now();
      existing.unreadCount += unreadDelta;
      // Move to top
      const index = convos.indexOf(existing);
      convos.splice(index, 1);
      convos.unshift(existing);
    } else {
      convos.unshift({
        recipientId,
        recipientName,
        recipientAvatar,
        lastMessage,
        lastMessageTime: Date.now(),
        unreadCount: unreadDelta,
      });
    }
    
    localStorage.setItem(`youthxp_conversations_${ownerId}`, JSON.stringify(convos));
    if (ownerId === userId) {
      setConversations(convos);
    }
  }, [userId]);

  const markConversationAsRead = useCallback((recipientId: string) => {
    // Mark messages as read
    const storageKey = getStorageKey(recipientId);
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const messages: Message[] = JSON.parse(stored);
      const updated = messages.map(m => 
        m.recipientId === userId ? { ...m, read: true } : m
      );
      localStorage.setItem(storageKey, JSON.stringify(updated));
    }

    // Update conversation unread count
    const convStored = localStorage.getItem(`youthxp_conversations_${userId}`);
    if (convStored) {
      const convos: Conversation[] = JSON.parse(convStored);
      const convo = convos.find(c => c.recipientId === recipientId);
      if (convo) {
        convo.unreadCount = 0;
        localStorage.setItem(`youthxp_conversations_${userId}`, JSON.stringify(convos));
        setConversations(convos);
      }
    }
  }, [userId, getStorageKey]);

  const getTotalUnreadCount = useCallback(() => {
    return conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  }, [conversations]);

  const getTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return {
    conversations,
    activeMessages,
    loadMessages,
    sendMessage,
    markConversationAsRead,
    getTotalUnreadCount,
    getTimeAgo,
    loadConversations,
  };
}
