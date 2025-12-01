export type StreamChunk =
| { type: 'text-delta'; text: string }
| { type: 'tool-call'; toolCallId: string; toolName: string; input: unknown }
| { type: 'tool-result'; toolCallId: string; toolName: string; output: unknown }
| { type: 'tool-error'; toolCallId: string; toolName: string; error: string }
| { type: 'finish-step'; stepNumber: number }
| { type: 'finish'; reason: string; totalSteps: number }
| { type: 'error'; error: string };

export type Message = {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    input: unknown;
  }>;
  toolResults?: Array<{
    toolCallId: string;
    output: unknown;
  }>;
};