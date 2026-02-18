'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { WS_URL, STORAGE_KEYS } from '@/lib/constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LiveMessageEvent {
  type: 'message_sent' | 'message_delivered' | 'message_failed';
  data: {
    messageId: string;
    senderId: string;
    senderName: string;
    recipientId: string;
    recipientName: string;
    type: string;
    timestamp: string;
    correlationId: string | null;
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMessagesSocket(enabled: boolean) {
  const [isConnected, setIsConnected] = useState(false);
  const [liveMessages, setLiveMessages] = useState<LiveMessageEvent[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (!token) return;

    const socket = io(WS_URL, {
      path: '/ws/messages',
      auth: { token },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Backend emits each event type directly (not wrapped in a single event)
    const handleEvent = (type: LiveMessageEvent['type']) => (data: LiveMessageEvent['data']) => {
      setLiveMessages((prev) => [{ type, data }, ...prev]);
    };

    socket.on('message_sent', handleEvent('message_sent'));
    socket.on('message_delivered', handleEvent('message_delivered'));
    socket.on('message_failed', handleEvent('message_failed'));

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [enabled]);

  const clearLiveMessages = useCallback(() => {
    setLiveMessages([]);
  }, []);

  return { isConnected, liveMessages, clearLiveMessages };
}
