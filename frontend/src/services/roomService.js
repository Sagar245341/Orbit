import { api } from "./api";

export const roomService = {
  async list() {
    const { data } = await api.get("/rooms");
    return data;
  },
  async create(name) {
    const { data } = await api.post("/rooms", { name });
    return data;
  },
  async join(roomId) {
    const { data } = await api.post(`/rooms/${roomId}/join`);
    return data;
  },
  async messages(roomId) {
    const { data } = await api.get(`/rooms/${roomId}/messages`, { params: { limit: 100 } });
    return data;
  }
};
