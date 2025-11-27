"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";

interface Message {
  id: number;
  content: string;
}

export default function Home() {
  const [userMessages, setUserMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [assistantMessages, setAssistantMessages] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    setUserMessages([...userMessages, { id: Date.now(), content: prompt }]);
    setAssistantMessages("");
    setIsLoading(true);
    const response = await fetch("/api/stream/sse", {
      method: "POST",
      body: JSON.stringify({ messages: prompt, name: "chat" }),
    });
    setIsLoading(false);
    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);

      const lines = chunk.split('\n');
      for (const line of lines) {
        const cleanText = line.replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"');
        setAssistantMessages((prev) => prev + cleanText);
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-zinc-900">
      <div className="flex h-screen w-full max-w-4xl flex-col bg-white dark:bg-zinc-950">
        <div className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Chat
          </h1>
        </div>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-4">
            {(assistantMessages.length > 0 || isLoading) && (
            <div className="flex justify-start">
              <div className="max-w-[70%] rounded-lg bg-zinc-100 dark:bg-zinc-800 px-4 py-2">
                <p className="text-sm text-zinc-900 dark:text-zinc-50">
                  {isLoading ? "Thinking..." : assistantMessages}
                </p>
                </div>
              </div>
            )}

            {userMessages.length > 0 && (
              <div className="flex justify-end">
                <div className="max-w-[70%] rounded-lg bg-blue-600 px-4 py-2">
                  {userMessages.map((message) => (
                    <p key={message.id} className="text-sm text-white">
                      {message.content}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-4">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Type your message..."
              className="flex-1"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSend();
                }
              }}
            />
            <Button onClick={handleSend}>Send</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
