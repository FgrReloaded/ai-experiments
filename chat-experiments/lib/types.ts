type StreamChunk =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; input: any }
  | { type: 'tool-result'; toolCallId: string; toolName: string; output: any }
  | { type: 'tool-error'; toolCallId: string; toolName: string; error: string }
  | { type: 'finish-step'; stepNumber: number }
  | { type: 'finish'; reason: string; totalSteps: number }
  | { type: 'error'; error: string };

type Message = {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    input: any;
  }>;
  toolResults?: Array<{
    toolCallId: string;
    output: any;
  }>;
};