import apiClient from '../http-common';

// Helper function to convert numbers to words
const numberToWords = (num) => {
  // Implementation of number to words conversion
  const single = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const double = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const formatTens = (num) => {
    if (num < 10) return single[num];
    if (num < 20) return double[num - 10];
    return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + single[num % 10] : '');
  };

  if (num === 0) return 'Zero';
  
  const numStr = num.toString().split('.');
  const wholeNum = parseInt(numStr[0]);
  const decimal = numStr[1] ? parseInt(numStr[1]) : 0;
  
  if (wholeNum === 0) return 'Zero';
  
  let result = '';
  if (wholeNum >= 10000000) {
    result += formatTens(Math.floor(wholeNum / 10000000)) + ' Crore ';
    wholeNum %= 10000000;
  }
  if (wholeNum >= 100000) {
    result += formatTens(Math.floor(wholeNum / 100000)) + ' Lakh ';
    wholeNum %= 100000;
  }
  if (wholeNum >= 1000) {
    result += formatTens(Math.floor(wholeNum / 1000)) + ' Thousand ';
    wholeNum %= 1000;
  }
  if (wholeNum >= 100) {
    result += single[Math.floor(wholeNum / 100)] + ' Hundred ';
    wholeNum %= 100;
  }
  if (wholeNum > 0) {
    result += formatTens(wholeNum);
  }
  
  // Handle decimal part (paise)
  if (decimal > 0) {
    result += ' and ' + formatTens(decimal) + ' Paise';
  }
  
  return result.trim();
};

class InvoiceServices {
  constructor() {
    this.axiosInstance = apiClient; // Use the configured axios instance from http-common
  }

  async getInvoiceYears() {
    try {
      const response = await this.axiosInstance.get('/InvoiceYear/GetAll');
      if (Array.isArray(response.data)) return response.data;
      return response.data || [];
    } catch (error) {
      console.error('Error fetching invoice years:', error);
      // Return default data in case of error
      return [{
        id: 1,
        finYear: '2025-2026',
        startDate: '2025-04-01',
        endDate: '2026-03-31',
        isActive: true
      }];
    }
  }

  async getMaxInvoiceNumber(finYear) {
    try {
      const response = await this.axiosInstance.get(`/InvoiceTransaction/GetMaxInvoiceNumberByFinYear?finYear=${finYear}`);
      if (response.status === 404) {
        console.warn('Max invoice number endpoint not found, using default');
        return { maxInvoiceNumber: `LIT/${finYear}/000` };
      }
      return response.data || { maxInvoiceNumber: `LIT/${finYear}/000` };
    } catch (error) {
      console.error(`Error fetching max invoice number for year ${finYear}:`, error);
      return { maxInvoiceNumber: `LIT/${finYear}/000` };
    }
  }

  async getHsnCodes() {
    try {
      const response = await this.axiosInstance.get('/HsnCode/GetAll');
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('Error fetching HSN codes:', error);
      return [];
    }
  }

  async getTaxes() {
    try {
      const response = await this.axiosInstance.get('/Tax/GetAll');
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('Error fetching taxes:', error);
      return [];
    }
  }

  async createInvoice(payload) {
    try {
      const firstItem = payload.items && payload.items.length > 0 ? payload.items[0] : {};
      const invoiceNumber = payload.invoice?.invoiceNumber || '';
      const finYearMatch = invoiceNumber.match(/LIT\/(\d{4})\//);
      const finYear = finYearMatch ? finYearMatch[1] : new Date().getFullYear().toString();
      let invoiceDate = payload.invoice?.date;
      if (invoiceDate && !isNaN(new Date(invoiceDate).getTime())) {
        invoiceDate = new Date(invoiceDate).toISOString().split('T')[0];
      } else {
        invoiceDate = new Date().toISOString().split('T')[0];
      }
      const grandTotal = payload.invoice?.grandTotal ||
        (payload.items?.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0) || 0);

      const cleanPayload = {
        Invoice: {
          invoiceNumber: invoiceNumber,
          finYear: finYear,
          date: invoiceDate,
          clientName: payload.invoice?.clientName || '',
          clientAddress: payload.invoice?.clientAddress || '',
          state: payload.invoice?.state || '',
          district: payload.invoice?.district || '',
          pinCode: payload.invoice?.pinCode?.toString() || '',
          taxID: payload.invoice?.taxID || '',
          clientGSTNumber: payload.invoice?.clientGSTNumber || '',
          clientPANNumber: payload.invoice?.clientPANNumber || '',
          grandTotal: grandTotal,
          totalInWords: payload.invoice?.totalInWords || numberToWords(grandTotal) + ' only',
          invoiceDescription: firstItem.description || '',
        },
        Description: {
          finYear: finYear,
          invoiceNumber: invoiceNumber,
          invoiceDescription: firstItem.description || '',
          breakupAmount: grandTotal,
          quantity: firstItem.quantity || 1,
          perUnit: (firstItem.perUnit !== undefined && firstItem.perUnit !== null ? firstItem.perUnit : firstItem.rate) || '',
        }
      };

      const response = await this.axiosInstance.post('/InvoiceTransaction/CreateInvoiceWithDescription', cleanPayload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (response.status >= 200 && response.status < 300) {
        return {
          ...response.data,
          status: response.status,
          statusText: response.statusText
        };
      } else {
        const errorMessage = response.data?.message ||
          response.data?.title ||
          response.statusText ||
          'Failed to create invoice';
        const error = new Error(errorMessage);
        error.response = response;
        throw error;
      }
    } catch (error) {
      throw error;
    }
  }
}

export default InvoiceServices;