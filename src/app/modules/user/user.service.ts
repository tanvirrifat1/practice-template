import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import { SortOrder } from 'mongoose';
import { USER_ROLES } from '../../../enums/user';
import ApiError from '../../../errors/ApiError';
import { emailHelper } from '../../../helpers/emailHelper';
import { emailTemplate } from '../../../shared/emailTemplate';
import generateOTP from '../../../util/generateOTP';
import { IUser } from './user.interface';
import { User } from './user.model';
import { sendNotifications } from '../../../helpers/notificationHelper';
import unlinkFile from '../../../shared/unlinkFile';

const createUserFromDb = async (payload: IUser) => {
  payload.role = USER_ROLES.USER;
  const result = await User.create(payload);

  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  const otp = generateOTP();
  const emailValues = {
    name: result.name,
    otp,
    email: result.email,
  };

  const accountEmailTemplate = emailTemplate.createAccount(emailValues);
  emailHelper.sendEmail(accountEmailTemplate);

  // Update user with authentication details
  const authentication = {
    oneTimeCode: otp,
    expireAt: new Date(Date.now() + 3 * 60000),
  };
  const updatedUser = await User.findOneAndUpdate(
    { _id: result._id },
    { $set: { authentication } }
  );
  if (!updatedUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found for update');
  }

  if (result.status === 'active') {
    const data = {
      text: `Registered successfully, ${result?.name}`,
      type: 'ADMIN',
    };

    await sendNotifications(data);
  }

  return result;
};

const getAllUsers = async (query: Record<string, unknown>) => {
  const {
    searchTerm,
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    order = 'desc',
    ...filterData
  } = query;

  // Search conditions
  const conditions: any[] = [];

  if (searchTerm) {
    conditions.push({
      $or: [{ fullName: { $regex: searchTerm, $options: 'i' } }],
    });
  }

  // Add filter conditions
  if (Object.keys(filterData).length > 0) {
    const filterConditions = Object.entries(filterData).map(
      ([field, value]) => ({
        [field]: value,
      })
    );
    conditions.push({ $and: filterConditions });
  }

  conditions.push({ role: USER_ROLES.USER });

  const whereConditions = conditions.length ? { $and: conditions } : {};

  // Pagination setup
  const currentPage = Number(page);
  const pageSize = Number(limit);
  const skip = (currentPage - 1) * pageSize;

  // Sorting setup
  const sortOrder = order === 'desc' ? -1 : 1;
  const sortCondition: { [key: string]: SortOrder } = {
    [sortBy as string]: sortOrder,
  };

  // Query the database
  const [users, total] = await Promise.all([
    User.find(whereConditions)
      .sort(sortCondition)
      .skip(skip)
      .limit(pageSize)
      .lean<IUser[]>(), // Assert type
    User.countDocuments(whereConditions),
  ]);

  // Format the `updatedAt` field
  const formattedUsers = users?.map(user => ({
    ...user,
    updatedAt: user.updatedAt
      ? new Date(user.updatedAt).toISOString().split('T')[0]
      : null,
  }));

  // Meta information for pagination
  return {
    result: formattedUsers,
    meta: {
      total,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize),
      currentPage,
    },
  };
};

const getUserProfileFromDB = async (
  user: JwtPayload
): Promise<Partial<IUser>> => {
  const { id } = user;
  const isExistUser = await User.findById(id);
  if (!isExistUser) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  return isExistUser;
};

const updateProfileToDB = async (
  user: JwtPayload,
  payload: Partial<IUser>
): Promise<Partial<IUser | null>> => {
  const { id } = user;
  const isExistUser = await User.isExistUserById(id);

  if (!isExistUser) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  // Delete old images if new images are provided
  if (payload.image && isExistUser.image) {
    if (Array.isArray(isExistUser.image)) {
      isExistUser.image.forEach((img: string) => unlinkFile(img));
    } else {
      unlinkFile(isExistUser.image as string);
    }
  }

  if (payload.document && isExistUser.document) {
    if (Array.isArray(isExistUser.document)) {
      isExistUser.document.forEach((doc: string) => unlinkFile(doc));
    } else {
      unlinkFile(isExistUser.document as string);
    }
  }

  // Delete old video if a new video is provided
  if (payload.video && isExistUser.video) {
    unlinkFile(isExistUser.video as string);
  }

  const updateDoc = await User.findOneAndUpdate({ _id: id }, payload, {
    new: true,
  });

  return updateDoc;
};

const getSingleUser = async (id: string): Promise<IUser | null> => {
  const result = await User.findById(id);
  return result;
};

export const UserService = {
  createUserFromDb,
  getUserProfileFromDB,
  updateProfileToDB,
  getAllUsers,
  getSingleUser,
};
