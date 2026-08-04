import { jsx as _jsx } from "react/jsx-runtime";
import AssistantMessage from './AssistantMessage.js';
export default function StreamingMessage({ message }) {
    return _jsx(AssistantMessage, { message: message });
}
