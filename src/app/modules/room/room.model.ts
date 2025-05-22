import { model, Schema } from 'mongoose';
import { IChatRoom } from './room.interface';

const chatRoomSchema = new Schema<IChatRoom>(
  {
    roomName: {
      type: String,
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);
export const Room = model<IChatRoom>('Room', chatRoomSchema);
