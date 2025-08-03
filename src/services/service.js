// src/services/service.js
import apiClient from '../http-common';

const service = {
  getInvoiceYear: async () => {
    try {
      const response = await apiClient.get('/InvoiceYear/GetAll');
      return response.data;
    } catch (error) {
      console.error('Error in getInvoiceYear:', error);
      throw new Error(`Failed to fetch invoice years: ${error.message}`);
    }
  },

  getMaxInvoice: async () => {
    try {
      const response = await apiClient.get('/InvoiceTransaction/GetMaxInvoiceNumberAcrossTables');
      return response.data;
    } catch (error) {
      console.error('Error in getMaxInvoice:', error);
      throw new Error(`Failed to fetch max invoice: ${error.message}`);
    }
  },

  createInvoiceWithDescription: async (payload) => {
    try {
      const response = await apiClient.post('/InvoiceTransaction/CreateInvoiceWithDescription', payload);
      return response.data;
    } catch (error) {
      console.error('Error in createInvoiceWithDescription:', error);
      throw new Error(`Failed to create invoice: ${error.message}`);
    }
  },

  getHsnCodes: async () => {
    try {
      const response = await apiClient.get('/HsnCode/GetAll');
      return response.data;
    } catch (error) {
      console.error('Error in getHsnCodes:', error);
      throw new Error(`Failed to fetch HSN codes: ${error.message}`);
    }
  },

  getTaxes: async () => {
    try {
      const response = await apiClient.get('/Tax/GetAll');
      return response.data;
    } catch (error) {
      console.error('Error in getTaxes:', error);
      throw new Error(`Failed to fetch taxes: ${error.message}`);
    }
  }
};

export default service;