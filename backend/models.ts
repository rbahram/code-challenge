/** In-memory stores (If we want horizontal scale we should redis) */
export const UserIdToSocket = new Map<string, string>(); 
export const SocketToUserId = new Map<string, string>(); 
export const UserToRoom = new Map<string, string>(); 
export const Rooms = new Map<
  string,
  { a: string; b: string } 
>();
