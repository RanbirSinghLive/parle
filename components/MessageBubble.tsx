import { Message } from "@/stores/conversation";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const hasCorrections = message.corrections && message.corrections.length > 0;

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? "bg-primary-600 text-white rounded-br-md"
            : "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-bl-md shadow-sm border border-slate-200 dark:border-slate-600"
        } ${hasCorrections ? "border-l-4 border-l-amber-400" : ""}`}
      >
        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
          {message.content}
        </p>
        <p
          className={`text-[11px] mt-1 ${
            isUser
              ? "text-primary-200"
              : "text-slate-400 dark:text-slate-500"
          }`}
        >
          {formatTime(message.timestamp)}
          {hasCorrections && (
            <span className="ml-2 text-amber-500">
              ({message.corrections!.length} correction{message.corrections!.length > 1 ? "s" : ""})
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
