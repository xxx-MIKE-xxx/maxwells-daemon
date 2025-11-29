import { KEY_OAI_HISTORY_DISABLED } from "/src/lib/chatgpt/constants.ts.js";
import { getBase64FromImageUrl, getBase64FromImg } from "/src/lib/chatgpt/utils/dom.ts.js";
import { getPageContextFromMainWorld } from "/src/lib/chatgpt/bridge.ts.js";
export function getHistoryDisabled() {
  return localStorage.getItem(KEY_OAI_HISTORY_DISABLED) === '"true"';
}
export async function getPageAccessToken() {
  const context = await getPageContextFromMainWorld();
  return context?.state?.loaderData?.root?.clientBootstrap?.session?.accessToken || context?.props?.pageProps?.user?.session?.accessToken || null;
}
async function getUserProfile() {
  const context = await getPageContextFromMainWorld();
  const user = context?.props?.pageProps?.user || context?.state?.loaderData?.root?.clientBootstrap?.session?.user;
  if (!user) throw new Error("No user found.");
  return user;
}
export function getChatIdFromUrl() {
  const match = location.pathname.match(/^\/(?:share|c|g\/[a-z0-9-]+\/c)\/([a-z0-9-]+)/i);
  if (match) return match[1];
  return null;
}
export function isSharePage() {
  return location.pathname.startsWith("/share") && !location.pathname.endsWith("/continue");
}
export async function getConversationFromSharePage() {
  const context = await getPageContextFromMainWorld();
  if (context?.props?.pageProps?.serverResponse?.data) {
    return JSON.parse(JSON.stringify(context.props.pageProps.serverResponse.data));
  }
  if (context?.state?.loaderData?.["routes/share.$shareId.($action)"]?.serverResponse?.data) {
    return JSON.parse(JSON.stringify(context.state.loaderData["routes/share.$shareId.($action)"].serverResponse.data));
  }
  return null;
}
const defaultAvatar = "data:image/svg+xml,%3Csvg%20stroke%3D%22currentColor%22%20fill%3D%22none%22%20stroke-width%3D%221.5%22%20viewBox%3D%22-6%20-6%2036%2036%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20style%3D%22color%3A%20white%3B%20background%3A%20%23ab68ff%3B%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M20%2021v-2a4%204%200%200%200-4-4H8a4%204%200%200%200-4%204v2%22%3E%3C%2Fpath%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%227%22%20r%3D%224%22%3E%3C%2Fcircle%3E%3C%2Fsvg%3E";
export async function getUserAvatar() {
  try {
    const { picture } = await getUserProfile();
    if (picture) return await getBase64FromImageUrl(picture);
  } catch (e) {
    console.error(e);
  }
  try {
    const avatars = Array.from(document.querySelectorAll("img[alt]:not([aria-hidden])"));
    const avatar = avatars.find((avatar2) => !avatar2.src.startsWith("data:"));
    if (avatar) return getBase64FromImg(avatar);
  } catch (e) {
    console.error(e);
  }
  return defaultAvatar;
}
export function checkIfConversationStarted() {
  return !!document.querySelector('[data-testid^="conversation-turn-"]');
}
