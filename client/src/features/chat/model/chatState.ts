import type { ApiError } from '../../../shared/api/http';
import type { ChatMessage, SendMessageResponse } from '../types';

export type ChatStatus =
  'idle' | 'loadingHistory' | 'historyError' | 'sending' | 'sendError';

export type ChatState = {
  conversationId: string | null;
  messages: ChatMessage[];
  status: ChatStatus;
  /** Text being sent, or the failed text kept for Retry. */
  pendingContent: string | null;
  error: ApiError | null;
};

export type ChatAction =
  | { type: 'reset' }
  | { type: 'historyRequested'; conversationId: string }
  | { type: 'historyLoaded'; conversationId: string; messages: ChatMessage[] }
  | { type: 'historyFailed'; error: ApiError }
  | { type: 'sendStarted'; content: string }
  | { type: 'sendSucceeded'; response: SendMessageResponse }
  | { type: 'sendFailed'; error: ApiError };

export const initialChatState: ChatState = {
  conversationId: null,
  messages: [],
  status: 'idle',
  pendingContent: null,
  error: null,
};

/** A new send is blocked while a request or history load is in flight. */
export const canSend = (state: ChatState) =>
  state.status !== 'sending' &&
  state.status !== 'loadingHistory' &&
  state.status !== 'historyError';

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'reset':
      return initialChatState;
    case 'historyRequested':
      return {
        ...initialChatState,
        conversationId: action.conversationId,
        status: 'loadingHistory',
      };
    case 'historyLoaded':
      if (action.conversationId !== state.conversationId) return state;
      return { ...state, messages: action.messages, status: 'idle' };
    case 'historyFailed':
      return { ...state, status: 'historyError', error: action.error };
    case 'sendStarted':
      if (!canSend(state)) return state;
      return {
        ...state,
        status: 'sending',
        pendingContent: action.content,
        error: null,
      };
    case 'sendSucceeded':
      if (state.status !== 'sending') return state;
      return {
        conversationId: action.response.conversationId,
        messages: [
          ...state.messages,
          action.response.userMessage,
          action.response.message,
        ],
        status: 'idle',
        pendingContent: null,
        error: null,
      };
    case 'sendFailed':
      if (state.status !== 'sending') return state;
      return { ...state, status: 'sendError', error: action.error };
    default:
      return state;
  }
}
