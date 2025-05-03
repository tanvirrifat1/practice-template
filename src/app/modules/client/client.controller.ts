import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { ClientServices } from './client.service';

const createClient = catchAsync(async (req, res) => {
  const { client: clientData } = req.body;
  const result = await ClientServices.createClientIntoDB(clientData);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Client is created successfully',
    data: result,
  });
});

const getSingleClient = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await ClientServices.getSingleClientFromDB(id)
;

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Client is retrieved successfully',
    data: result,
  });
});

const getAllClients = catchAsync(async (req, res) => {
  const result = await ClientServices.getAllClientsFromDB(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Clients are retrieved successfully',
    data: result,
  });
});

const updateClient = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { client } = req.body;
  const result = await ClientServices.updateClientIntoDB(id, client);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Client is updated successfully',
    data: result,
  });
});

const deleteClient = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await ClientServices.deleteClientFromDB(id)
;

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Client is deleted successfully',
    data: result,
  });
});

export const ClientControllers = {
  createClient,
  getSingleClient,
  getAllClients,
  updateClient,
  deleteClient,
};
