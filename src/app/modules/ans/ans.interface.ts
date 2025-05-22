import { Types } from 'mongoose';

export type IQuestionAndAns = {
  user: Types.ObjectId;
  question: string;
  answer: string;
  room: Types.ObjectId;
  createRoom: boolean;
};
