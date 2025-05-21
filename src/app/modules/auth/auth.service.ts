import bcrypt from 'bcryptjs';
import { StatusCodes } from 'http-status-codes';
import { JwtPayload, Secret } from 'jsonwebtoken';
import config from '../../../config';
import ApiError from '../../../errors/ApiError';
import { emailHelper } from '../../../helpers/emailHelper';
import { jwtHelper } from '../../../helpers/jwtHelper';
import { emailTemplate } from '../../../shared/emailTemplate';
import {
  IAuthResetPassword,
  IChangePassword,
  ILoginData,
  IVerifyEmail,
} from '../../../types/auth';
import cryptoToken from '../../../util/cryptoToken';
import generateOTP from '../../../util/generateOTP';
import { User } from '../user/user.model';
import { ResetToken } from '../resetToken/resetToken.model';

const loginUserSocial = async (payload: ILoginData) => {
  const { email, appId, role, type } = payload;

  if (type !== 'social') {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid login type');
  }

  let user = await User.findOne({ email });

  if (!user) {
    try {
      user = await User.create({
        email,
        appId,
        role,
        verified: true,
      });
    } catch (error) {
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to create user'
      );
    }
  }

  const payloadData = {
    id: user._id,
    role: user.role,
    email: user.email,
  };

  const accessToken = jwtHelper.createToken(
    payloadData,
    config.jwt.jwt_secret as Secret,
    config.jwt.jwt_expire_in as string
  );

  const refreshToken = jwtHelper.createToken(
    payloadData,
    config.jwt.jwtRefreshSecret as Secret,
    config.jwt.jwt_refresh_expire_in as string
  );

  const userData: any = user.toObject();

  return { accessToken, refreshToken, userData };
};

const loginUserFromDB = async (payload: ILoginData) => {
  const { email, password } = payload;

  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  if (!user.verified) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Please verify your account, then try to login again'
    );
  }

  const isMatch = await User.isMatchPassword(password, user.password);
  if (!isMatch) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Password is incorrect!');
  }

  // Generate OTP & Expiry
  const otp = generateOTP();
  const expireAt = new Date(Date.now() + 30 * 60 * 1000);
  const authentication = { oneTimeCode: otp, expireAt };

  // Prepare email content (non-blocking)
  const emailContent = emailTemplate.createAccount({
    name: user.name,
    otp,
    email: user.email,
  });

  void Promise.all([
    User.findByIdAndUpdate(user._id, { authentication }),
    emailHelper.sendEmail(emailContent),
  ]);

  return {
    message: 'OTP sent to your email. Please verify to continue.',
  };
};

const verifyOtpAndLogin = async (email: string, otp: any) => {
  const user = await User.findOne({ email }).select('+authentication');

  if (!user || !user.authentication) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid user or no OTP found');
  }

  const { oneTimeCode, expireAt } = user.authentication;

  if (new Date() > new Date(expireAt)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'OTP has expired');
  }

  if (oneTimeCode !== otp) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid OTP');
  }

  // Clear OTP after successful verification
  user.authentication = undefined;
  await user.save();

  // Generate tokens
  const accessToken = jwtHelper.createToken(
    { id: user._id, role: user.role, email: user.email },
    config.jwt.jwt_secret as Secret,
    config.jwt.jwt_expire_in as string
  );

  const refreshToken = jwtHelper.createToken(
    { id: user._id, role: user.role, email: user.email },
    config.jwt.jwtRefreshSecret as Secret,
    config.jwt.jwt_refresh_expire_in as string
  );

  const userData: any = user.toObject();

  return { accessToken, refreshToken, userData };
};

//forget password
const forgetPasswordToDB = async (email: string) => {
  const isExistUser = await User.isExistUserByEmail(email);
  if (!isExistUser) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  //send mail
  const otp = generateOTP();
  const value = {
    otp,
    email: isExistUser.email,
  };
  const forgetPassword = emailTemplate.resetPassword(value);
  emailHelper.sendEmail(forgetPassword);

  //save to DB
  const authentication = {
    oneTimeCode: otp,
    expireAt: new Date(Date.now() + 3 * 60000),
  };
  await User.findOneAndUpdate({ email }, { $set: { authentication } });
};

//verify email
const verifyEmailToDB = async (payload: IVerifyEmail) => {
  const { email, oneTimeCode } = payload;
  const isExistUser = await User.findOne({ email }).select('+authentication');
  if (!isExistUser) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  if (!oneTimeCode) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Please give the otp, check your email we send a code'
    );
  }

  if (isExistUser.authentication?.oneTimeCode !== oneTimeCode) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'You provided wrong otp');
  }

  const date = new Date();
  if (date > isExistUser.authentication?.expireAt) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Otp already expired, Please try again'
    );
  }

  let message;
  let data;

  if (!isExistUser.verified) {
    await User.findOneAndUpdate(
      { _id: isExistUser._id },
      { verified: true, authentication: { oneTimeCode: null, expireAt: null } }
    );
    message =
      'Your email has been successfully verified. Your account is now fully activated.';
  } else {
    await User.findOneAndUpdate(
      { _id: isExistUser._id },
      {
        authentication: {
          isResetPassword: true,
          oneTimeCode: null,
          expireAt: null,
        },
      }
    );

    //create token ;
    const createToken = cryptoToken();
    await ResetToken.create({
      user: isExistUser._id,
      token: createToken,
      expireAt: new Date(Date.now() + 5 * 60000),
    });
    message =
      'Verification Successful: Please securely store and utilize this code for reset password';
    data = createToken;
  }
  return { data, message };
};

//forget password
const resetPasswordToDB = async (
  token: string,
  payload: IAuthResetPassword
) => {
  const { newPassword, confirmPassword } = payload;
  //isExist token
  const isExistToken = await ResetToken.isExistToken(token);
  if (!isExistToken) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'You are not authorized');
  }

  //user permission check
  const isExistUser = await User.findById(isExistToken.user).select(
    '+authentication'
  );
  if (!isExistUser?.authentication?.isResetPassword) {
    throw new ApiError(
      StatusCodes.UNAUTHORIZED,
      "You don't have permission to change the password. Please click again to 'Forgot Password'"
    );
  }

  //validity check
  const isValid = await ResetToken.isExpireToken(token);
  if (!isValid) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Token expired, Please click again to the forget password'
    );
  }

  //check password
  if (newPassword !== confirmPassword) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "New password and Confirm password doesn't match!"
    );
  }

  const hashPassword = await bcrypt.hash(
    newPassword,
    Number(config.bcrypt_salt_rounds)
  );

  const updateData = {
    password: hashPassword,
    authentication: {
      isResetPassword: false,
    },
  };

  await User.findOneAndUpdate({ _id: isExistToken.user }, updateData, {
    new: true,
  });
};

const changePasswordToDB = async (
  user: JwtPayload,
  payload: IChangePassword
) => {
  const { currentPassword, newPassword, confirmPassword } = payload;
  const isExistUser = await User.findById(user.id).select('+password');
  if (!isExistUser) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  //current password match
  if (
    currentPassword &&
    !(await User.isMatchPassword(currentPassword, isExistUser.password))
  ) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Password is incorrect');
  }

  //newPassword and current password
  if (currentPassword === newPassword) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Please give different password from current password'
    );
  }
  //new password and confirm password check
  if (newPassword !== confirmPassword) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Password and Confirm password doesn't matched"
    );
  }

  //hash password
  const hashPassword = await bcrypt.hash(
    newPassword,
    Number(config.bcrypt_salt_rounds)
  );

  const updateData = {
    password: hashPassword,
  };
  await User.findOneAndUpdate({ _id: user.id }, updateData, { new: true });
};

const deleteAccountToDB = async (user: JwtPayload) => {
  const result = await User.findByIdAndDelete(user?.id);
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'No User found');
  }

  return result;
};

const newAccessTokenToUser = async (token: string) => {
  // Check if the token is provided
  if (!token) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Token is required!');
  }

  const verifyUser = jwtHelper.verifyToken(
    token,
    config.jwt.jwtRefreshSecret as Secret
  );

  const isExistUser = await User.findById(verifyUser?.id);
  if (!isExistUser) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Unauthorized access');
  }

  //create token
  const accessToken = jwtHelper.createToken(
    { id: isExistUser._id, role: isExistUser.role, email: isExistUser.email },
    config.jwt.jwt_secret as Secret,
    config.jwt.jwt_expire_in as string
  );

  return { accessToken };
};

const resendVerificationEmailToDB = async (email: string) => {
  // Find the user by ID
  const existingUser: any = await User.findOne({ email: email }).lean();

  if (!existingUser) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      'User with this email does not exist!'
    );
  }

  if (existingUser?.isVerified) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'User is already verified!');
  }

  // Generate OTP and prepare email
  const otp = generateOTP();
  const emailValues = {
    name: existingUser.firstName,
    otp,
    email: existingUser.email,
  };
  const accountEmailTemplate = emailTemplate.createAccount(emailValues);
  emailHelper.sendEmail(accountEmailTemplate);

  // Update user with authentication details
  const authentication = {
    oneTimeCode: otp,
    expireAt: new Date(Date.now() + 3 * 60000),
  };

  await User.findOneAndUpdate(
    { email: email },
    { $set: { authentication } },
    { new: true }
  );
};

export const AuthService = {
  verifyEmailToDB,
  loginUserFromDB,
  forgetPasswordToDB,
  resetPasswordToDB,
  changePasswordToDB,
  deleteAccountToDB,
  newAccessTokenToUser,
  resendVerificationEmailToDB,
  loginUserSocial,
  verifyOtpAndLogin,
};
