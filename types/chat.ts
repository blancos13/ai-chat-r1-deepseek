export type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export type ChatMessage = {
  id: string;
  message: Message;
};

export type Chat = {
  id: string;
  title: string;
  messages: ChatMessage[];
  model: string;
  createdAt: Date;
  updatedAt: Date;
};

export type GroqModel = {
  id: string;
  name: string;
  developer: string;
  contextWindow: number;
  type: 'production' | 'preview';
};

export const GROQ_MODELS: GroqModel[] = [
  {
    id: 'llama-3.3-70b-versatile',
    name: 'LLaMA 3.3 70B Versatile',
    developer: 'Meta',
    contextWindow: 128000,
    type: 'production'
  },
  {
    id: 'mixtral-8x7b-32768',
    name: 'Mixtral 8x7B',
    developer: 'Mistral',
    contextWindow: 32768,
    type: 'production'
  },
  {
    id: 'llama3-70b-8192',
    name: 'LLaMA3 70B',
    developer: 'Meta',
    contextWindow: 8192,
    type: 'production'
  },
  {
    id: 'gemma2-9b-it',
    name: 'Gemma2 9B',
    developer: 'Google',
    contextWindow: 8192,
    type: 'production'
  },
  {
    id: 'deepseek-r1-distill-llama-70b',
    name: 'DeepSeek R1 Distill LLaMA 70B',
    developer: 'DeepSeek',
    contextWindow: 128000,
    type: 'preview'
  }
]; 