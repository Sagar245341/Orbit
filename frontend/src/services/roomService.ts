import { api } from "./api";
import type {
  ChatMessage,
  Channel,
  ChannelInput,
  Invitation,
  InvitationOptions,
  Room,
  RoomCreateInput,
  RoomMember,
  RoomPage,
  RoomSearchParams,
} from "../types";

export const roomService = {
  async list(): Promise<Room[]> {
    const { data } = await api.get<Room[]>("/rooms");
    return data;
  },
  async create(room: RoomCreateInput): Promise<Room> {
    const { data } = await api.post<Room>("/rooms", room);
    return data;
  },
  async discover(params: RoomSearchParams): Promise<RoomPage> {
    const { data } = await api.get<RoomPage>("/rooms/discover", { params });
    return data;
  },
  async details(roomId: number): Promise<Room> {
    const { data } = await api.get<Room>(`/rooms/${roomId}`);
    return data;
  },
  async members(roomId: number): Promise<RoomMember[]> {
    const { data } = await api.get<RoomMember[]>(`/rooms/${roomId}/members`);
    return data;
  },
  async channels(roomId: number): Promise<Channel[]> {
    const { data } = await api.get<Channel[]>(`/rooms/${roomId}/channels`);
    return data;
  },
  async createChannel(roomId: number, input: ChannelInput): Promise<Channel> {
    const { data } = await api.post<Channel>(`/rooms/${roomId}/channels`, input);
    return data;
  },
  async updateChannel(channelId: number, input: ChannelInput): Promise<Channel> {
    const { data } = await api.patch<Channel>(`/channels/${channelId}`, input);
    return data;
  },
  async archiveChannel(channelId: number): Promise<void> {
    await api.delete(`/channels/${channelId}`);
  },
  async join(roomId: number): Promise<{ room_id: number; already_member: boolean }> {
    const { data } = await api.post(`/rooms/${roomId}/join`);
    return data;
  },
  async previewInvitation(code: string) {
    const { data } = await api.get(`/invitations/${encodeURIComponent(code)}`);
    return data;
  },
  async acceptInvitation(code: string) {
    const { data } = await api.post(`/invitations/${encodeURIComponent(code)}/accept`);
    return data;
  },
  async createInvitation(roomId: number, options: InvitationOptions): Promise<Invitation> {
    const { data } = await api.post<Invitation>(`/rooms/${roomId}/invitations`, options);
    return data;
  },
  async invitations(roomId: number): Promise<Invitation[]> {
    const { data } = await api.get<Invitation[]>(`/rooms/${roomId}/invitations`);
    return data;
  },
  async revokeInvitation(invitationId: number): Promise<void> {
    await api.delete(`/invitations/${invitationId}`);
  },
  async messages(roomId: number): Promise<ChatMessage[]> {
    const { data } = await api.get<ChatMessage[]>(`/rooms/${roomId}/messages`, { params: { limit: 100 } });
    return data;
  },
  async channelMessages(channelId: number): Promise<ChatMessage[]> {
    const { data } = await api.get<ChatMessage[]>(`/channels/${channelId}/messages`, { params: { limit: 100 } });
    return data;
  },
};
