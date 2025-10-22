import crypto from 'crypto';
import { Rooms, UserToRoom } from './models';

// Creates random id using crypto lib
export const makeId = () => crypto.randomBytes(8).toString('hex');
export const getPeerId = (roomId: string, me: string) => {
    const r = Rooms.get(roomId);
    if (!r) return undefined;
    return r.a === me ? r.b : r.b === me ? r.a : undefined;
}

export const isBusy = (userId: string) => UserToRoom.has(userId);

