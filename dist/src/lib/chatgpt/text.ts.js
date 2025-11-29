import { fetchConversation, getCurrentChatId, processConversation } from "/src/lib/chatgpt/api.ts.js";
import { checkIfConversationStarted } from "/src/lib/chatgpt/page.ts.js";
import { flatMap, fromMarkdown, toMarkdown } from "/src/lib/chatgpt/utils/markdown.ts.js";
import { standardizeLineBreaks } from "/src/lib/chatgpt/utils/text.ts.js";
export async function fetchChatContent() {
  if (!checkIfConversationStarted()) {
    console.warn("Maxwell: No conversation started");
    return null;
  }
  const chatId = await getCurrentChatId();
  const rawConversation = await fetchConversation(chatId, false);
  const { conversationNodes } = processConversation(rawConversation);
  const text = conversationNodes.map(({ message }) => transformMessage(message)).filter(Boolean).join("\n\n");
  return standardizeLineBreaks(text);
}
const LatexRegex = /(\s\$\$.+\$\$\s|\s\$.+\$\s|\\\[.+\\\]|\\\(.+\\\))|(^\$$[\S\s]+^\$$)|(^\$\$[\S\s]+^\$\$$)/gm;
function transformMessage(message) {
  if (!message || !message.content) return null;
  if (message.recipient !== "all") return null;
  if (message.author.role === "tool") {
    if (message.content.content_type !== "multimodal_text" && !(message.content.content_type === "execution_output" && message.metadata?.aggregate_result?.messages?.some((msg) => msg.message_type === "image"))) {
      return null;
    }
  }
  const author = transformAuthor(message.author);
  let content = transformContent(message.content, message.metadata);
  const matches = content.match(LatexRegex);
  if (matches) {
    let index = 0;
    content = content.replace(LatexRegex, () => {
      return `╬${index++}╬`;
    });
  }
  if (message.author.role === "assistant") {
    content = transformFootNotes(content, message.metadata);
  }
  if (message.author.role === "assistant" && content) {
    content = reformatContent(content);
  }
  if (matches) {
    content = content.replace(/╬(\d+)╬/g, (_, index) => {
      return matches[+index];
    });
  }
  return `${author}:
${content}`;
}
function transformContent(content, metadata) {
  switch (content.content_type) {
    case "text":
      return content.parts?.join("\n") || "";
    case "code":
      return content.text || "";
    case "execution_output":
      if (metadata?.aggregate_result?.messages) {
        return metadata.aggregate_result.messages.filter((msg) => msg.message_type === "image").map(() => "[image]").join("\n");
      }
      return content.text || "";
    case "tether_quote":
      return `> ${content.title || content.text || ""}`;
    case "tether_browsing_code":
      return "";
    case "tether_browsing_display": {
      const metadataList = metadata?._cite_metadata?.metadata_list;
      if (Array.isArray(metadataList) && metadataList.length > 0) {
        return metadataList.map(({ title, url }) => `> [${title}](${url})`).join("\n");
      }
      return "";
    }
    case "multimodal_text": {
      return content.parts?.map((part) => {
        if (typeof part === "string") return part;
        if (part.content_type === "image_asset_pointer") return "[image]";
        if (part.content_type === "audio_transcription") return `[audio] ${part.text}`;
        return "[Unsupported multimodal content]";
      }).join("\n") || "";
    }
    default:
      return "[Unsupported Content]";
  }
}
function reformatContent(input) {
  const root = fromMarkdown(input);
  flatMap(root, (item) => {
    if (item.type === "strong") return item.children;
    if (item.type === "emphasis") return item.children;
    return [item];
  });
  const result = toMarkdown(root);
  if (result.startsWith("\\[") && input.startsWith("[")) {
    return result.slice(1);
  }
  return result;
}
function transformAuthor(author) {
  switch (author.role) {
    case "assistant":
      return "ChatGPT";
    case "user":
      return "You";
    case "tool":
      return `Plugin${author.name ? ` (${author.name})` : ""}`;
    default:
      return author.role;
  }
}
function transformFootNotes(input, metadata) {
  const footNoteMarkRegex = /【(\d+)†\((.+?)\)】/g;
  return input.replace(footNoteMarkRegex, (match, citeIndex, _evidenceText) => {
    const citation = metadata?.citations?.find((cite) => cite.metadata?.extra?.cited_message_idx === +citeIndex);
    if (citation) return "";
    return match;
  });
}
