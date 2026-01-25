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
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-xs">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <svg className="w-10 h-10 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <p className="text-slate-900 dark:text-white text-xl font-medium mb-2">
            Bienvenue!
          </p>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
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
