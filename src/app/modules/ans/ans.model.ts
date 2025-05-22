import { model, Schema } from 'mongoose';
import { IQuestionAndAns } from './ans.interface';

const questionAnswerSchema = new Schema<IQuestionAndAns>(
  {
    answer: {
      type: String,
      required: true,
    },
    question: {
      type: String,
      required: true,
    },
    createRoom: {
      type: Boolean,
      default: false,
    },

    room: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

export const QuestionAnswer = model<IQuestionAndAns>(
  'QuestionAnswer',
  questionAnswerSchema
);
