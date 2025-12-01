export type Tool<INPUT, OUTPUT> = {
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (input: INPUT) => Promise<OUTPUT> | OUTPUT;
};

export const tools = {
  sum: {
    description: 'Calculate sum of multiple numbers',
    inputSchema: {
      type: 'object',
      properties: {
        numbers: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of numbers to sum',
        },
      },
      required: ['numbers'],
    },
    execute: async ({ numbers }: { numbers: number[] }) => {
      const result = numbers.reduce((a, b) => a + b, 0);
      return { result, operation: 'sum', numbers };
    },
  },

  diff: {
    description: 'Calculate difference of multiple numbers',
    inputSchema: {
      type: 'object',
      properties: {
        numbers: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of numbers to subtract (first - rest)',
        },
      },
      required: ['numbers'],
    },
    execute: async ({ numbers }: { numbers: number[] }) => {
      const result = numbers.reduce((a, b) => a - b);
      return { result, operation: 'difference', numbers };
    },
  },

  prod: {
    description: 'Calculate product of multiple numbers',
    inputSchema: {
      type: 'object',
      properties: {
        numbers: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of numbers to multiply',
        },
      },
      required: ['numbers'],
    },
    execute: async ({ numbers }: { numbers: number[] }) => {
      const result = numbers.reduce((a, b) => a * b, 1);
      return { result, operation: 'product', numbers };
    },
  },
} as const;

export type ToolName = keyof typeof tools;