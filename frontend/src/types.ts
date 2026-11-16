export type RoomRole = "owner" | "moderator" | "member";
export type RoomType = "public" | "private";

export interface Room {
  id: number;
  name: string;
  created_by: number;
  owner_id: number;
  description: string;
  icon_url: string | null;
  room_type: RoomType;
  category: string | null;
  max_members: number | null;
  member_count: number;
  owner_username: string | null;
  is_member: boolean;
  current_user_role: RoomRole | null;
  created_at: string;
  updated_at: string;
  invite_code?: string;
  invite_url?: string;
}

export interface RoomMember {
  id: number;
  username: string;
  role: RoomRole;
  joined_at: string;
}

export interface ChatMessage {
  id: number;
  sender_id: number;
  room_id: number;
  channel_id: number | null;
  content: string;
  created_at: string;
  sender_username: string;
}

export interface Channel {
  id: number;
  room_id: number;
  name: string;
  topic: string;
  category: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ChannelInput {
  name: string;
  topic: string;
  category: string | null;
}

export interface RoomSearchParams {
  q?: string;
  category?: string;
  page?: number;
  page_size?: number;
}

export interface RoomPage {
  items: Room[];
  total: number;
  page: number;
  page_size: number;
}

export interface RoomCreateInput {
  name: string;
  description?: string;
  icon_url?: string | null;
  room_type?: RoomType;
  category?: string | null;
  max_members?: number | null;
}

export interface InvitationOptions {
  expiration: "never" | "1h" | "24h" | "7d";
  max_uses: 1 | 5 | 10 | null;
}

export interface Invitation {
  id: number;
  room_id: number;
  invite_code: string;
  invite_url: string;
  created_by: number;
  inviter_username: string;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  created_at: string;
}
