import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { AnsService } from './ans.service';

const createChat = catchAsync(async (req, res) => {
  const user = req.user.id;

  console.log(user);

  const value = {
    ...req.body,
    user,
  };

  const result = await AnsService.createChat(value);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Chat created successfully',
    data: result,
  });
});

export const AnsController = {
  createChat,
};
