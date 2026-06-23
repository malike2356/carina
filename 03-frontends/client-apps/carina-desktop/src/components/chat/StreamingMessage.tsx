import type { ChatMessage } from '../../store/chat.js';
import AssistantMessage from './AssistantMessage.js';

interface Props {
  message: ChatMessage;
}

export default function StreamingMessage({ message }: Props) {
  return <AssistantMessage message={message} />;
}
