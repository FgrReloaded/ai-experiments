"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useRef } from "react";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ToolCall {
  id: string;
  name: string;
  input: unknown;
  result?: unknown;
  error?: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [currentResponse, setCurrentResponse] = useState<string>("");
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const currentResponseRef = useRef<string>("");

  const handleSend = async () => {
    if (!prompt.trim()) return;

    const userMessage: Message = { role: 'user', content: prompt };
    const allMessages = [...messages, userMessage];

    setMessages(allMessages);
    setPrompt("");
    setCurrentResponse("");
    currentResponseRef.current = "";
    setToolCalls([]);
    setIsLoading(true);
    setStatus("Thinking...");

    try {
      const response = await fetch("/api/stream/sse_tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.slice(6));

            switch (data.type) {
              case 'text-delta':
                currentResponseRef.current += data.text;
                setCurrentResponse(currentResponseRef.current);
                setStatus("Responding...");
                break;

              case 'tool-call':
                setToolCalls((prev) => [
                  ...prev,
                  {
                    id: data.toolCallId,
                    name: data.toolName,
                    input: data.input,
                  },
                ]);
                setStatus(`Calling tool: ${data.toolName}...`);
                break;

              case 'tool-result':
                setToolCalls((prev) =>
                  prev.map((tc) =>
                    tc.id === data.toolCallId
                      ? { ...tc, result: data.output }
                      : tc
                  )
                );
                setStatus(`Tool ${data.toolName} completed`);
                break;

              case 'tool-error':
                setToolCalls((prev) =>
                  prev.map((tc) =>
                    tc.id === data.toolCallId
                      ? { ...tc, error: data.error }
                      : tc
                  )
                );
                setStatus(`Tool error: ${data.error}`);
                break;

              case 'finish-step':
                setStatus(`Step ${data.stepNumber + 1} complete, continuing...`);
                break;

              case 'finish':
                setIsLoading(false);
                setStatus(
                  data.reason === 'completed'
                    ? 'Complete'
                    : `Finished: ${data.reason} (${data.totalSteps} steps)`
                );
                const finalResponse = currentResponseRef.current;
                if (finalResponse) {
                  setMessages((prev) => [
                    ...prev,
                    { role: 'assistant', content: finalResponse },
                  ]);
                }
                setTimeout(() => {
                  setCurrentResponse("");
                  currentResponseRef.current = "";
                  setToolCalls([]);
                }, 500);
                break;

              case 'error':
                setIsLoading(false);
                setStatus(`Error: ${data.error}`);
                break;
            }
          } catch (e) {
            console.error('Failed to parse SSE data:', e);
          }
        }
      }
    } catch (error) {
      console.error('Request failed:', error);
      setStatus('Request failed');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-zinc-900">
      <div className="flex h-screen w-full max-w-4xl flex-col bg-white dark:bg-zinc-950">
        <div className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Chat with Tools
          </h1>
          {status && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              {status}
            </p>
          )}
        </div>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
              >
                <div
                  className={`max-w-[70%] rounded-lg px-4 py-2 ${message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50'
                    }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}

            {(currentResponse || isLoading) && (
              <div className="flex justify-start">
                <div className="max-w-[70%] rounded-lg bg-zinc-100 dark:bg-zinc-800 px-4 py-2">
                  <p className="text-sm text-zinc-900 dark:text-zinc-50 whitespace-pre-wrap">
                    {currentResponse || "Thinking..."}
                  </p>
                </div>
              </div>
            )}

            {toolCalls.length > 0 && (
              <div className="flex justify-start">
                <div className="max-w-[85%] space-y-2">
                  {toolCalls.map((toolCall) => (
                    <div
                      key={toolCall.id}
                      className="rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 px-4 py-2"
                    >
                      <div className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                        🛠️ Tool: {toolCall.name}
                      </div>
                      <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                        Input: {JSON.stringify(toolCall.input)}
                      </div>
                      {toolCall.result !== undefined && (
                        <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                          ✓ Result: {JSON.stringify(toolCall.result)}
                        </div>
                      )}
                      {toolCall.error && (
                        <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                          ✗ Error: {toolCall.error}
                        </div>
                      )}
                    </div>
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
              placeholder="Try: What is 15 + 27?"
              className="flex-1"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isLoading) {
                  handleSend();
                }
              }}
              disabled={isLoading}
            />
            <Button onClick={handleSend} disabled={isLoading}>
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
