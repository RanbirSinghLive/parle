"use client";

import { useEffect, useRef } from "react";
import { useConversationStore } from "@/stores/conversation";
import { MessageBubble } from "./MessageBubble";

export function Transcript() {
  const messages = useConversationStore((state) => state.messages);
  const isProcessing = useConversationStore((state) => state.isProcessing);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0 && !isProcessing) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-500 dark:text-slate-400 text-lg mb-2">
            Bienvenue!
          </p>
          <p className="text-slate-400 dark:text-slate-500 text-sm">
            Press and hold the button below to start speaking French
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {isProcessing && (
        <div className="flex justify-start mb-3">
          <div className="bg-white dark:bg-slate-700 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-slate-200 dark:border-slate-600">
            <div className="flex space-x-1.5">
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
