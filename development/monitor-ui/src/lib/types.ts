// Wire-protocol types (must match ws.ts on server)

export interface Job {
  sessionId: string;
  name: string;
  issueNumber: number;
  agent: string;
  step: number;
  status: "pending" | "running" | "succeeded" | "failed";
  startedAt: string | null;
  completedAt: string | null;
  podName: string | null;
  fixture?: boolean;
}

// Server → Client
export type ServerMessage =
  | { type: "jobs-snapshot"; ts: number; jobs: Job[] }
  | { type: "jobs-updated"; ts: number; jobs: Job[] }
  | { type: "log-line"; ts: number; sessionId: string; line: string }
  | { type: "verdict"; ts: number; sessionId: string; result: "PASS" | "FAIL" }
  | {
      type: "stream-end";
      ts: number;
      sessionId: string;
      reason: "completed" | "failed" | "cancelled";
    }
  | { type: "stream-error"; ts: number; sessionId: string; message: string; fatal?: true }
  | { type: "fixture-start"; ts: number; sessionId: string }
  | { type: "pong" }
  | { type: "error"; message: string };

// Client → Server
export type ClientMessage =
  | { type: "subscribe"; sessionId: string }
  | { type: "unsubscribe"; sessionId: string }
  | { type: "set-speed"; sessionId: string; speed: number }
  | { type: "ping" };

// Parsed display-ready job
export interface DisplayJob {
  sessionId: string;
  name: string;
  issue: string;
  step: string;
  agentKey: string;
  agentName: string;
  status: Job["status"];
  startTime: number | null;
  completionTime: number | null;
}

// JSONL event types
export interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string | ContentBlock[];
  is_error?: boolean;
}

export interface JsonEvent {
  type: string;
  subtype?: string;
  model?: string;
  cwd?: string;
  timestamp?: string;
  message?: {
    id?: string;
    role?: string;
    content?: ContentBlock[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  [key: string]: unknown;
}
