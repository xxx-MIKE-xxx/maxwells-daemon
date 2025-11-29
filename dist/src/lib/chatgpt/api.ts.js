import urlcat from "/vendor/.vite-deps-urlcat.js__v--f79f5941.js";
import { apiUrl, baseUrl } from "/src/lib/chatgpt/constants.ts.js";
import { getChatIdFromUrl, getConversationFromSharePage, getPageAccessToken, isSharePage } from "/src/lib/chatgpt/page.ts.js";
import { blobToDataURL } from "/src/lib/chatgpt/utils/dom.ts.js";
import { memorize } from "/src/lib/chatgpt/utils/memorize.ts.js";
var ChatGPTCookie = /* @__PURE__ */ ((ChatGPTCookie2) => {
  ChatGPTCookie2["AgeVerification"] = "oai-av-seen";
  ChatGPTCookie2["AllowNonessential"] = "oai-allow-ne";
  ChatGPTCookie2["DeviceId"] = "oai-did";
  ChatGPTCookie2["DomainMigrationSourceCompleted"] = "oai-dm-src-c-240329";
  ChatGPTCookie2["DomainMigrationTargetCompleted"] = "oai-dm-tgt-c-240329";
  ChatGPTCookie2["HasClickedOnTryItFirstLink"] = "oai-tif-20240402";
  ChatGPTCookie2["HasLoggedInBefore"] = "oai-hlib";
  ChatGPTCookie2["HideLoggedOutBanner"] = "hide-logged-out-banner";
  ChatGPTCookie2["IntercomDeviceIdDev"] = "intercom-device-id-izw1u7l7";
  ChatGPTCookie2["IntercomDeviceIdProd"] = "intercom-device-id-dgkjq2bp";
  ChatGPTCookie2["IpOverride"] = "oai-ip-country";
  ChatGPTCookie2["IsEmployee"] = "_oaiauth";
  ChatGPTCookie2["IsPaidUser"] = "_puid";
  ChatGPTCookie2["LastLocation"] = "oai-ll";
  ChatGPTCookie2["SegmentUserId"] = "ajs_user_id";
  ChatGPTCookie2["SegmentUserTraits"] = "ajs_user_traits";
  ChatGPTCookie2["ShowPaymentModal"] = "ui-show-payment-modal";
  ChatGPTCookie2["TempEnableUnauthedCompliance"] = "temp-oai-compliance";
  ChatGPTCookie2["Workspace"] = "_account";
  return ChatGPTCookie2;
})(ChatGPTCookie || {});
const sessionApi = urlcat(baseUrl, "/api/auth/session");
const conversationApi = (id) => urlcat(apiUrl, "/conversation/:id", { id });
const conversationsApi = (offset, limit) => urlcat(apiUrl, "/conversations", { offset, limit });
const fileDownloadApi = (id) => urlcat(apiUrl, "/files/:id/download", { id });
const projectsApi = () => urlcat(apiUrl, "/gizmos/snorlax/sidebar", { conversations_per_gizmo: 0 });
const projectConversationsApi = (gizmo, offset, limit) => urlcat(apiUrl, "/gizmos/:gizmo/conversations", { gizmo, cursor: offset, limit });
const accountsCheckApi = urlcat(apiUrl, "/accounts/check/v4-2023-04-27");
export async function getCurrentChatId() {
  if (isSharePage()) {
    return `__share__${getChatIdFromUrl()}`;
  }
  const chatId = getChatIdFromUrl();
  if (chatId) return chatId;
  const conversations = await fetchConversations();
  if (conversations && conversations.items.length > 0) {
    return conversations.items[0].id;
  }
  throw new Error("No chat id found.");
}
async function fetchImageFromPointer(uri) {
  const pointer = uri.replace("file-service://", "");
  const imageDetails = await fetchApi(fileDownloadApi(pointer));
  if (imageDetails.status === "error") {
    console.error("Failed to fetch image asset", imageDetails.error_code, imageDetails.error_message);
    return null;
  }
  const image = await fetch(imageDetails.download_url);
  const blob = await image.blob();
  const base64 = await blobToDataURL(blob);
  return base64.replace(/^data:.*?;/, `data:${image.headers.get("content-type")};`);
}
async function replaceImageAssets(conversation) {
  const isMultiModalInputImage = (part) => {
    return typeof part === "object" && part !== null && "content_type" in part && part.content_type === "image_asset_pointer" && "asset_pointer" in part && typeof part.asset_pointer === "string" && part.asset_pointer.startsWith("file-service://");
  };
  const imageAssets = Object.values(conversation.mapping).flatMap((node) => {
    if (!node.message) return [];
    if (node.message.content.content_type !== "multimodal_text") return [];
    return (Array.isArray(node.message.content.parts) ? node.message.content.parts : []).filter(isMultiModalInputImage);
  });
  const executionOutputs = Object.values(conversation.mapping).flatMap((node) => {
    if (!node.message) return [];
    if (node.message.content.content_type !== "execution_output") return [];
    if (!node.message.metadata?.aggregate_result?.messages) return [];
    return node.message.metadata.aggregate_result.messages.filter((msg) => msg.message_type === "image");
  });
  await Promise.all([
    ...imageAssets.map(async (asset) => {
      try {
        const newAssetPointer = await fetchImageFromPointer(asset.asset_pointer);
        if (newAssetPointer) asset.asset_pointer = newAssetPointer;
      } catch (error) {
        console.error("Failed to fetch image asset", error);
      }
    }),
    ...executionOutputs.map(async (msg) => {
      try {
        const newImageUrl = await fetchImageFromPointer(msg.image_url);
        if (newImageUrl) msg.image_url = newImageUrl;
      } catch (error) {
        console.error("Failed to fetch image asset", error);
      }
    })
  ]);
}
export async function fetchConversation(chatId, shouldReplaceAssets) {
  if (chatId.startsWith("__share__")) {
    const id = chatId.replace("__share__", "");
    const shareConversation = await getConversationFromSharePage();
    await replaceImageAssets(shareConversation);
    return {
      id,
      ...shareConversation
    };
  }
  const url = conversationApi(chatId);
  const conversation = await fetchApi(url);
  if (shouldReplaceAssets) {
    await replaceImageAssets(conversation);
  }
  return {
    id: chatId,
    ...conversation
  };
}
export async function fetchProjects() {
  const url = projectsApi();
  const { items } = await fetchApi(url);
  return items.map((gizmo) => gizmo.gizmo.gizmo);
}
async function fetchConversations(offset = 0, limit = 20, project = null) {
  if (project) {
    return fetchProjectConversations(project, offset, limit);
  }
  const url = conversationsApi(offset, limit);
  return fetchApi(url);
}
async function fetchProjectConversations(project, offset = 0, limit = 20) {
  const url = projectConversationsApi(project, offset, limit);
  const { items } = await fetchApi(url);
  return {
    has_missing_conversations: false,
    items,
    limit,
    offset,
    total: null
  };
}
export async function fetchAllConversations(project = null, maxConversations = 1e3) {
  const conversations = [];
  const limit = project === null ? 100 : 50;
  let offset = 0;
  while (true) {
    try {
      const result = project === null ? await fetchConversations(offset, limit) : await fetchProjectConversations(project, offset, limit);
      if (!result.items) {
        console.warn("fetchAllConversations received no items at offset:", offset);
        break;
      }
      conversations.push(...result.items);
      if (result.items.length === 0) break;
      if (result.total !== null && offset + limit >= result.total) break;
      if (conversations.length >= maxConversations) break;
      offset += limit;
    } catch (error) {
      console.error("Error fetching conversations batch:", error);
      break;
    }
  }
  return conversations.slice(0, maxConversations);
}
export async function archiveConversation(chatId) {
  const url = conversationApi(chatId);
  const { success } = await fetchApi(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_archived: true })
  });
  return success;
}
export async function deleteConversation(chatId) {
  const url = conversationApi(chatId);
  const { success } = await fetchApi(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_visible: false })
  });
  return success;
}
async function fetchApi(url, options) {
  const accessToken = await getAccessToken();
  const accountId = await getTeamAccountId();
  const response = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "X-Authorization": `Bearer ${accessToken}`,
      ...accountId ? { "Chatgpt-Account-Id": accountId } : {},
      ...options?.headers
    }
  });
  if (!response.ok) {
    throw new Error(response.statusText);
  }
  return response.json();
}
async function _fetchSession() {
  const response = await fetch(sessionApi);
  if (!response.ok) {
    throw new Error(response.statusText);
  }
  return response.json();
}
const fetchSession = memorize(_fetchSession);
async function getAccessToken() {
  const pageAccessToken = await getPageAccessToken();
  if (pageAccessToken) return pageAccessToken;
  const session = await fetchSession();
  return session.accessToken;
}
async function _fetchAccountsCheck() {
  const accessToken = await getAccessToken();
  const response = await fetch(accountsCheckApi, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "X-Authorization": `Bearer ${accessToken}`
    }
  });
  if (!response.ok) {
    throw new Error(response.statusText);
  }
  return response.json();
}
const fetchAccountsCheck = memorize(_fetchAccountsCheck);
const getCookie = (key) => document.cookie.match(`(^|;)\\s*${key}\\s*=\\s*([^;]+)`)?.pop() || "";
export async function getTeamAccountId() {
  const accountsCheck = await fetchAccountsCheck();
  const workspaceId = getCookie("_account" /* Workspace */);
  if (workspaceId) {
    const account = accountsCheck.accounts[workspaceId];
    if (account) {
      return account.account.account_id;
    }
  }
  return null;
}
const ModelMapping = {
  "text-davinci-002-render-sha": "GPT-3.5",
  "text-davinci-002-render-paid": "GPT-3.5",
  "text-davinci-002-browse": "GPT-3.5",
  "gpt-4": "GPT-4",
  "gpt-4-browsing": "GPT-4 (Browser)",
  "gpt-4o": "GPT-4o",
  "text-davinci-002": "GPT-3.5"
};
export function processConversation(conversation) {
  const title = conversation.title || "ChatGPT Conversation";
  const createTime = conversation.create_time;
  const updateTime = conversation.update_time;
  const { model, modelSlug } = extractModel(conversation.mapping);
  const startNodeId = conversation.current_node || Object.values(conversation.mapping).find((node) => !node.children || node.children.length === 0)?.id;
  if (!startNodeId) throw new Error("Failed to find start node.");
  const conversationNodes = extractConversationResult(conversation.mapping, startNodeId);
  const mergedConversationNodes = mergeContinuationNodes(conversationNodes);
  return {
    id: conversation.id,
    title,
    model,
    modelSlug,
    createTime,
    updateTime,
    conversationNodes: mergedConversationNodes
  };
}
function extractModel(conversationMapping) {
  let model = "";
  const modelSlug = Object.values(conversationMapping).find((node) => node.message?.metadata?.model_slug)?.message?.metadata?.model_slug || "";
  if (modelSlug) {
    if (ModelMapping[modelSlug]) {
      model = ModelMapping[modelSlug];
    } else {
      Object.keys(ModelMapping).forEach((key) => {
        if (modelSlug.startsWith(key)) {
          model = key;
        }
      });
    }
  }
  return {
    model,
    modelSlug
  };
}
function extractConversationResult(conversationMapping, startNodeId) {
  const result = [];
  let currentNodeId = startNodeId;
  while (currentNodeId) {
    const node = conversationMapping[currentNodeId];
    if (!node) {
      break;
    }
    if (node.parent === void 0) {
      break;
    }
    if (node.message?.author.role !== "system" && node.message?.content.content_type !== "model_editable_context" && node.message?.content.content_type !== "user_editable_context") {
      result.unshift(node);
    }
    currentNodeId = node.parent;
  }
  return result;
}
function mergeContinuationNodes(nodes) {
  const result = [];
  for (const node of nodes) {
    const prevNode = result[result.length - 1];
    if (prevNode?.message?.author.role === "assistant" && node.message?.author.role === "assistant" && prevNode.message.recipient === "all" && node.message.recipient === "all" && prevNode.message.content.content_type === "text" && node.message.content.content_type === "text") {
      prevNode.message.content.parts[prevNode.message.content.parts.length - 1] += node.message.content.parts[0];
      prevNode.message.content.parts.push(...node.message.content.parts.slice(1));
    } else {
      result.push(node);
    }
  }
  return result;
}
