import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import openai from '../../../shared/openAi';
import { Room } from '../room/room.model';
import { IQuestionAndAns } from './ans.interface';
import OpenAI from 'openai';
import moment from 'moment';
import { QuestionAnswer } from './ans.model';

// const createChat = async (payload: IQuestionAndAns) => {
//   // Step 2: Generate a business-related response
//   const result = await openai.chat.completions.create({
//     model: 'gpt-4',
//     messages: [
//       {
//         role: 'system',
//         content:
//           'You are an AI expert in business strategy. Answer business-related questions only.',
//       },
//       { role: 'user', content: payload.question },
//     ],
//   });

//   let roomId;
//   let room;

//   if (payload.room) {
//     room = await Room.findOne({ roomName: payload.room });

//     if (room) {
//       roomId = room.roomName;
//     } else {
//       throw new ApiError(StatusCodes.NOT_FOUND, 'Room not found!');
//     }
//   } else if (!payload.createRoom) {
//     room = await Room.findOne({ user: payload.user }).sort({ createdAt: -1 });
//     if (room) {
//       roomId = room.roomName;
//     }
//   }

//   if (!room || payload.createRoom) {
//     const formattedDate = moment().format('HH:mm:ss');
//     room = await Room.create({
//       user: payload.user,
//       roomName: payload.question + ' ' + formattedDate,
//     });
//   }

//   const answer = result.choices[0].message?.content;

//   const value = {
//     question: payload.question,
//     answer: answer,
//     room: room._id,
//     user: payload.user,
//     createRoom: payload.createRoom,
//   };

//   const res = await QuestionAnswer.create(value);
//   return res;
// };

const createChat = async (payload: IQuestionAndAns) => {
  // 1. Find the room by roomId

  if (!payload.roomId) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'roomId is required!');
  }

  const room = await Room.findById(payload.roomId);

  if (!room) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Room not found!');
  }

  // 2. Get previous Q&A from this room
  const previousQA = await QuestionAnswer.find({ room: room._id }).sort({
    createdAt: 1,
  });

  // 3. Format messages for OpenAI
  const historyMessages = previousQA.flatMap(item => [
    { role: 'user', content: item.question },
    { role: 'assistant', content: item.answer || '' },
  ]);

  const messages: any = [
    {
      role: 'system',
      content:
        'You are an AI expert in business strategy. Answer business-related questions only.',
    },
    ...historyMessages,
    { role: 'user', content: payload.question },
  ];

  // 4. Generate response from OpenAI
  const result = await openai.chat.completions.create({
    model: 'gpt-4',
    messages,
  });

  const answer = result.choices[0].message?.content;

  // 5. Save current Q&A to DB
  const value = {
    question: payload.question,
    answer,
    room: room._id,
    user: payload.user,
  };

  const savedQA = await QuestionAnswer.create(value);
  return savedQA;
};

export const AnsService = {
  createChat,
};
