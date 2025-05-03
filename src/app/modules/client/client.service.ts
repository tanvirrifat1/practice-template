import { StatusCodes } from 'http-status-codes';
import QueryBuilder from '../../builder/QueryBuilder';
import ApiError from '../../../errors/ApiError';
import mongoose from 'mongoose';
import { TClient } from './client.interface';
import { Client } from './client.model';
import { CLIENT_SEARCHABLE_FIELDS } from './client.constant';

const createClientIntoDB = async (payload: TClient) => {
  const result = await Client.create(payload);

  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to create Client');
  }

  return result;
};

const getAllClientsFromDB = async (query: Record<string, unknown>) => {
  const ClientQuery = new QueryBuilder(Client.find(), query)
    .search(CLIENT_SEARCHABLE_FIELDS)
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await ClientQuery.modelQuery;
  const meta = await ClientQuery.countTotal();
  return {
    result,
    meta,
  };
};

const getSingleClientFromDB = async (id: string) => {
  const result = await Client.findById(id);
  return result;
};

const updateClientIntoDB = async (id: string, payload: any) => {
  const isDeletedService = await mongoose.connection
    .collection('clients')
    .findOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { projection: { isDeleted: 1, name: 1 } }
    );

  if (!isDeletedService?.name) {
    throw new Error('Client not found');
  }

  if (isDeletedService.isDeleted) {
    throw new Error('Cannot update a deleted client');
  }

  const updatedData = await Client.findByIdAndUpdate({ _id: id }, payload, {
    new: true,
    runValidators: true,
  });

  if (!updatedData) {
    throw new Error('Client not found after update');
  }

  return updatedData;
};

const deleteClientFromDB = async (id: string) => {
  const deletedService = await Client.findByIdAndUpdate(
    id,
    { isDeleted: true },
    { new: true }
  );

  if (!deletedService) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to delete Client');
  }

  return deletedService;
};

export const ClientServices = {
  createClientIntoDB,
  getAllClientsFromDB,
  getSingleClientFromDB,
  updateClientIntoDB,
  deleteClientFromDB,
};
