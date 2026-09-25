import type { Product } from "@/lib/types";

export type ChatSender = "bot" | "user";

export interface ChatQuickReply {
  id: string;
  label: string;
  action: string;
  payload?: string;
}

export type CustomActionType =
  | "track_order"
  | "support_form"
  | "customizable_info"
  | "mattress_finder";

export interface ChatMessage {
  id: string;
  sender: ChatSender;
  text: string;
  timestamp: number;
  quickReplies?: ChatQuickReply[];
  products?: Product[];
  customAction?: CustomActionType;
  actionCompleted?: boolean;
}

export type ChatCrmEvent =
  | "CHAT_OPENED"
  | "PRODUCT_HELP_SELECTED"
  | "PRODUCT_VIEWED_FROM_CHAT"
  | "CUSTOMIZATION_SELECTED"
  | "ORDER_TRACKING_SELECTED"
  | "SUPPORT_REQUESTED";
