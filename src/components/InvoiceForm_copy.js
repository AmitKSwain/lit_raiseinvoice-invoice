import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import InvoiceServices from '../services/invoiceService';
import apiClient from '../http-common';
import service from '../services/service';

// Helper function to convert numbers to words (Indian style)
function numberToWords(num) {
  const single = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const double = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const formatTens = (num) => {
    if (num < 10) return single[num];
    if (num >= 10 && num < 20) return double[num - 10];
    const ten = Math.floor(num / 10);
    const unit = num % 10;
    return tens[ten] + (unit ? ' ' + single[unit] : '');
  };
  if (num === 0) return 'Zero';
  if (num < 0) return 'Minus ' + numberToWords(Math.abs(num));
  let words = '';
  if (Math.floor(num / 10000000) > 0) {
    words += numberToWords(Math.floor(num / 10000000)) + ' Crore ';
    num %= 10000000;
  }
  if (Math.floor(num / 100000) > 0) {
    words += numberToWords(Math.floor(num / 100000)) + ' Lakh ';
    num %= 100000;
  }
  if (Math.floor(num / 1000) > 0) {
    words += numberToWords(Math.floor(num / 1000)) + ' Thousand ';
    num %= 1000;
  }
  if (Math.floor(num / 100) > 0) {
    words += single[Math.floor(num / 100)] + ' Hundred ';
    num %= 100;
  }
  if (num > 0) {
    if (words !== '') words += 'and ';
    words += formatTens(num);
  }
  return words.trim();
}

const indianStates = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal"
];

const initialForm = {
  date: '',
  clientName: '',
  gstNumber: '',
  panNumber: '',
  address: '',
  state: '',
  district: '',
  pinCode: '',
  hsn: '',
  invoiceNumber: '',
  taxType: '',
  finYear: ''
};

const initialItem = {
  serial: 1,
  description: '',
  quantity: 1,
  rate: '',
  total: 0
};

const fieldCss = {
  flex: "0 0 48%",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  marginBottom: 24
};

const InvoiceForm_copy = () => {
  const [financialYears, setFinancialYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [hsnCodes, setHsnCodes] = useState([]);
  const [taxTypes, setTaxTypes] = useState([]);
  const [loadingYears, setLoadingYears] = useState(true);
  const [loadingHsn, setLoadingHsn] = useState(false);

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [formData, setFormData] = useState(initialForm);
  const [items, setItems] = useState([initialItem]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [grandTotalWithTax, setGrandTotalWithTax] = useState(0);
  const [taxRateString, setTaxRateString] = useState('Tax');
  const [errors, setErrors] = useState({});
  const [itemErrors, setItemErrors] = useState([]);

  const getShortYear = (finYear) => {
    if (!finYear) return '';
    if (finYear.length === 4) return finYear;
    if (finYear.length >= 9 && finYear.includes('-')) {
      const [start, end] = finYear.split('-');
      return start.slice(2) + end.slice(2);
    }
    return '';
  };

  useEffect(() => {
    (async () => {
      setLoadingYears(true);
      try {
        const service = new InvoiceServices();
        const years = await service.getInvoiceYears();
        setFinancialYears(years);
        if (years.length > 0) {
          setSelectedYear(years[0]);
          setFormData(prev => ({ ...prev, finYear: years[0].finYear }));
        }
      } catch (err) {
        // error
      } finally {
        setLoadingYears(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedYear) return;
    (async () => {
      const shortYear = getShortYear(selectedYear.finYear);
      try {
        const service = new InvoiceServices();
        const response = await service.getMaxInvoiceNumber(shortYear);
        let maxInvoice = '';
        if (response && typeof response === 'object') {
          if (response.data && response.data.maxInvoiceNumber) maxInvoice = response.data.maxInvoiceNumber;
          else if (response.maxInvoiceNumber) maxInvoice = response.maxInvoiceNumber;
          else if (response.data) maxInvoice = response.data;
        } else if (typeof response === 'string') {
          maxInvoice = response;
        }
        let newNumber = '001';
        const prefix = 'LIT';
        if (maxInvoice) {
          const match = maxInvoice.match(/(\d{3})$/i);
          if (match && match[1]) {
            const lastNum = parseInt(match[1], 10);
            if (!isNaN(lastNum)) newNumber = String(lastNum + 1).padStart(3, '0');
          }
        }
        const newInvoiceNumber = `${prefix}/${shortYear}/${newNumber}`;
        setInvoiceNumber(newInvoiceNumber);
        setFormData(prev => ({ ...prev, invoiceNumber: newInvoiceNumber }));
      } catch {
        setInvoiceNumber(`LIT/${shortYear}/001`);
        setFormData(prev => ({ ...prev, invoiceNumber: `LIT/${shortYear}/001` }));
      }
    })();
    // eslint-disable-next-line
  }, [selectedYear]);

  useEffect(() => {
    (async () => {
      setLoadingHsn(true);
      try {
        const service = new InvoiceServices();
        const [hsnResp, taxResp] = await Promise.all([
          service.getHsnCodes(),
          service.getTaxes()
        ]);
        setHsnCodes(Array.isArray(hsnResp) ? hsnResp : hsnResp?.data || []);
        setTaxTypes(Array.isArray(taxResp) ? taxResp : taxResp?.data || []);
      } catch (e) {
        // error
      } finally {
        setLoadingHsn(false);
      }
    })();
  }, []);

  const handleYearChange = async (e) => {
    const shortYear = e.target.value;
    const matchedYear = financialYears.find(y => getShortYear(y.finYear) === shortYear);
    if (matchedYear) {
      setSelectedYear(matchedYear);
      setFormData(prev => ({ ...prev, finYear: matchedYear.finYear }));
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.clientName.trim()) {
      newErrors.clientName = "Client Name is required";
    } else if (!/^[A-Za-z ]+$/.test(formData.clientName.trim())) {
      newErrors.clientName = "Only alphabets and spaces allowed";
    }
    if (!formData.address.trim()) newErrors.address = "Address is required";
    if (!formData.state) newErrors.state = "State is required";
    if (!formData.date) newErrors.date = "Date is required";
    if (!formData.pinCode.trim()) newErrors.pinCode = "Pin Code is required";
    setErrors(newErrors);

    const newItemErrors = items.map(item => {
      const err = {};
      if (!item.description.trim()) err.description = "Description required";
      if (!item.rate || isNaN(item.rate) || parseFloat(item.rate) < 0) err.rate = "Valid rate required";
      if (item.quantity <= 0) err.quantity = "Quantity must be > 0";
      return err;
    });
    setItemErrors(newItemErrors);

    return Object.keys(newErrors).length === 0 && newItemErrors.every(e => Object.keys(e).length === 0);
  };

  const handleItemChange = (index, key, value) => {
    const updated = [...items];
    if (key === "quantity") value = parseInt(value) || 0;
    if (key === "rate") {
      if (typeof value === 'string' && !/^\d*\.?\d*$/.test(value)) return;
      value = value === "" ? "" : value;
      updated[index].perUnit = value;
    }
    updated[index][key] = value;
    const rate = updated[index].perUnit || updated[index].rate || 0;
    updated[index].total = (parseFloat(updated[index].quantity) || 0) * (parseFloat(updated[index].rate || updated[index].perUnit) || 0);
    setItems(updated);
  };

  const addItem = () => {
    setItems([...items, { ...initialItem, serial: items.length + 1,perUnit: '' }]);
    setItemErrors([...itemErrors, {}]);
  };

  useEffect(() => {
    const total = items.reduce((sum, item) => { const rate = parseFloat(item.rate || item.perUnit) || 0;
      const quantity = parseFloat(item.quantity) || 0;
      return sum + (quantity * rate)
    }, 0);
    setGrandTotal(total);

    let taxAmount = 0;
    let taxRate = 0;
    let taxRateString = "Tax";
    let selectedTax = null;
    if (formData.taxType && taxTypes.length > 0) {
      selectedTax = taxTypes.find(t => String(t.id) === String(formData.taxType)) || taxTypes.find(t => t.taxDescription === formData.taxType);
      if (selectedTax) {
        taxRate = parseFloat(selectedTax.taxPercentage);
        taxRateString = `${selectedTax.taxDescription} (${taxRate}%)`;
      }
    } else if (formData.state === "Karnataka") {
      taxRate = 18;
      taxRateString = "CGST+SGST (18%)";
    } else if (formData.state) {
      taxRate = 18;
      taxRateString = "IGST (18%)";
    }
    if (taxRate > 0) {
      taxAmount = total * (taxRate / 100);
    }
    setTaxAmount(taxAmount);
    setGrandTotalWithTax(total + taxAmount);
    setTaxRateString(taxRateString);
  }, [items, formData.taxType, formData.state, taxTypes]);

  // PDF
  const downloadPDF = () => {
    if (!validate()) {
      alert("Please fill all required fields correctly.");
      return;
    }
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Company Header
    doc.setDrawColor(34, 34, 34);
    doc.setLineWidth(0.4);
    doc.rect(7, 7, pageWidth - 14, pageHeight - 14);

    doc.setFont('times', 'bold');
    doc.setFontSize(18);
    doc.text('INVOICE', pageWidth / 2, 18, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('times', 'normal');
    let y = 28;
    doc.text('M/S. L-IT TRULY SERVICES PRIVATE LIMITED', 14, y, { maxWidth: 110 });
    y += 6;
    doc.text('No 33, 2nd Floor, Chikathoguru Main Road,', 14, y);
    y += 6;
    doc.text('Hosur Road, Electronic City, Bangalore,', 14, y);
    y += 6;
    doc.text('Karnataka, India, 560100', 14, y);
    y += 6;
    doc.text('GSTIN:29AAECL9590K1ZP', 14, y);
    y += 6;
    doc.text('PAN NO: AAECL9590K', 14, y);

    autoTable(doc, {
      startY: 25,
      margin: { left: pageWidth - 81 },
      body: [
        [{ content: 'INVOICE No:', styles: { halign: 'left', fontStyle: 'bold' } }, invoiceNumber],
        [{ content: 'DATE:', styles: { halign: 'left', fontStyle: 'bold' } }, formData.date],
        [{ content: 'HSN Code:', styles: { halign: 'left', fontStyle: 'bold' } }, formData.hsn],
      ],
      theme: 'plain',
      styles: { fontSize: 11, cellPadding: 1 },
      tableLineWidth: 0.1,
      tableLineColor: [0, 0, 0],
      tableWidth: 70
    });

    // Client Info
    let clientY = y + 10;
    doc.setFontSize(13);
    doc.text('To,', 14, clientY);
    doc.text(formData.clientName, 14, clientY + 6);
    let nextClientLine = clientY + 12;
    const addressLines = doc.splitTextToSize(formData.address, 70);
    doc.text(addressLines, 14, nextClientLine);
    nextClientLine += addressLines.length * 6;
    doc.setFontSize(12);
    let extraLine = '';
    if (formData.state) extraLine += formData.state;
    if (formData.district) extraLine += (extraLine ? ', ' : '') + formData.district;
    if (formData.pinCode) extraLine += (extraLine ? ', ' : '') + formData.pinCode;
    if (extraLine) {
      doc.text(extraLine, 14, nextClientLine);
      nextClientLine += 6;
    }
    if (formData.gstNumber) {
      doc.setFont('times', 'bold');
      doc.text(`GSTIN:`, 14, nextClientLine);
      doc.setFont('times', 'normal');
      doc.text(`${formData.gstNumber}`, 32, nextClientLine);
      nextClientLine += 6;
    }
    if (formData.panNumber) {
      doc.setFont('times', 'bold');
      doc.text(`PAN:`, 14, nextClientLine);
      doc.setFont('times', 'normal');
      doc.text(`${formData.panNumber}`, 32, nextClientLine);
      nextClientLine += 6;
    }
    doc.setFontSize(14);
    doc.text('Email Confirmation: Yes', pageWidth - 81, clientY + 6);

    // Invoice Table
    autoTable(doc, {
      startY: nextClientLine + 10,
      margin: { left: 14, right: 14 },
      head: [[
        { content: 'Sl No', styles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] } },
        { content: 'Description', styles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] } },
        { content: 'Quantity', styles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] } },
        { content: 'Per Unit', styles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] } },
        { content: 'Total Amount', styles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] } }
      ]],
      body: items.map((item, idx) => [
        idx + 1,
        item.description,
        item.quantity,
        item.rate ? parseFloat(item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '',
        item.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })
      ]),
      theme: 'grid',
      styles: { fontSize: 11, cellPadding: 2 },
      headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 'wrap' },
        2: { cellWidth: 20, halign: 'right' },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 30, halign: 'right' },
      },
    });

    // Totals
    doc.setFont('times', 'bold');
    doc.setFontSize(13);
    let taxDesc = taxRateString;
    let taxAmountStr = taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    let subtotalStr = grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    let totalAmountStr = 'Rs.' + grandTotalWithTax.toLocaleString('en-IN', { minimumFractionDigits: 2 });

    const table = doc.lastAutoTable;
    const tableRight = (table && typeof table.width === 'number' && typeof table.finalX === 'number')
      ? table.finalX + table.width
      : pageWidth - 14;
    const summaryStartY = (table && typeof table.finalY === 'number')
      ? table.finalY + 8
      : 100;

    let nextLineY = summaryStartY;
    doc.text(`Subtotal: Rs.${subtotalStr}`, tableRight - 68, nextLineY);
    nextLineY += 8;
    doc.text(`${taxDesc}: Rs.${taxAmountStr}`, tableRight - 68, nextLineY);
    nextLineY += 8;
    doc.text(`Total: ${totalAmountStr}`, tableRight - 68, nextLineY);
    nextLineY += 32;

    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    doc.text(
      `Amount in Words:  ${numberToWords(Math.round(grandTotalWithTax))} Only`,
      14,
      nextLineY
    );

    // HSN Table
    autoTable(doc, {
      startY: nextLineY + 9,
      margin: { left: 14, right: 11 },
      head: [[
        { content: 'HSN/SAC', styles: { fillColor: [255, 102, 0], textColor: [255, 255, 255] } },
        { content: 'Net Taxable Value', styles: { fillColor: [255, 102, 0], textColor: [255, 255, 255] } },
        { content: 'Tax', styles: { fillColor: [255, 102, 0], textColor: [255, 255, 255] } },
        { content: 'Tax %', styles: { fillColor: [255, 102, 0], textColor: [255, 255, 255] } },
        { content: 'Tax Amount', styles: { fillColor: [255, 102, 0], textColor: [255, 255, 255] } }
      ]],
      body: [[
        formData.hsn,
        grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
        taxDesc,
        taxTypes.find(t => t.taxDescription === formData.taxType)?.taxPercentage || 18,
        taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })
      ]],
      theme: 'grid',
      styles: { fontSize: 12, cellPadding: 2 },
      headStyles: { fillColor: [255, 102, 0], textColor: [255, 255, 255] }
    });

    // Bank Details and Signature
    const bankY = doc.lastAutoTable.finalY + 14;
    doc.setFont('times', 'bold');
    doc.setFontSize(13);
    doc.text('For L-IT Truly Services Pvt Ltd', 14, bankY + 10);
    doc.setFont('times', 'normal');
    let bankBlockY = bankY;
    doc.setFontSize(11);
    doc.text('Company Name: L-IT TRULY SERVICES PVT LTD', pageWidth - 95, bankBlockY);
    bankBlockY += 7;
    doc.text('Bank and Branch: IDFC, Electronic City, Bangalore', pageWidth - 95, bankBlockY);
    bankBlockY += 7;
    doc.text('IFSC Code: IDFB0080189', pageWidth - 95, bankBlockY);
    bankBlockY += 7;
    doc.text('Account No: 10088308677', pageWidth - 95, bankBlockY);

    doc.setFont('times', 'bold');
    doc.setFontSize(13);
    doc.text('Signature With Seal', 14, bankY + 28);

    doc.save(`${invoiceNumber}.pdf`);
  };

  // Submit invoice to API
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      alert("Please fill all required fields correctly.");
      return;
    }
    try {
      // Ensure perUnit is always a string for backend compatibility
      const firstItem = items.length > 0 ? items[0] : {};
      const invoiceData = {
        invoice: {
          invoiceNumber,
          date: formData.date,
          clientName: formData.clientName,
          clientAddress: formData.address,
          state: formData.state,
          district: formData.district,
          pinCode: formData.pinCode,
          clientGSTNumber: formData.gstNumber,
          clientPANNumber: formData.panNumber || '',
          taxID: formData.taxType || '',
          grandTotal: grandTotalWithTax,
          totalInWords: numberToWords(grandTotalWithTax)
        },
        // This is where DB expects invoiceDescription and perUnit
        description: {
          invoiceNumber,
          invoiceDescription: firstItem.description || '',
          breakupAmount: grandTotalWithTax,
          quantity: firstItem.quantity || 1,
          perUnit: firstItem.perUnit || firstItem.rate || '', // always string
        },
        items: items.map(item => ({
          description: item.description,
          quantity: parseFloat(item.quantity) || 0,
          perUnit: item.perUnit || item.rate || '', // always string
          // perUnit: item.rate !== undefined && item.rate !== null ? String(item.rate) : '', // always string
          total: (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0)
        }))
      };
      const service = new InvoiceServices();
      const response = await service.createInvoice(invoiceData);
      if (response.status === 200 || response.status === 201) {
        alert('Invoice saved successfully!');
      } else {
        throw new Error(response.data?.message || 'Failed to save invoice');
      }
    } catch (error) {
      alert(`Error saving invoice: ${error.message}`);
    }
  };

  return (
    <div style={{
      fontFamily: 'Times New Roman',
      padding: 0,
      background: '#f7f9fa',
      minHeight: '100vh',
      boxSizing: 'border-box'
    }}>
      <form onSubmit={handleSubmit}>
        <div style={{
          maxWidth: 1000,
          margin: '40px auto',
          background: '#fff',
          borderRadius: 5,
          boxShadow: '0 2px 16px #0001',
          border: '1px solid #222',
          padding: 0,
          overflow: 'hidden'
        }}>
          <div style={{
            borderBottom: '1px solid #222',
            margin: 0
          }}>
            <h2 style={{
              textAlign: 'center',
              margin: 0,
              padding: '32px 0 32px 0',
              letterSpacing: 1,
              fontSize: 32,
              borderBottom: '1px solid #222'
            }}>
              Invoice
            </h2>
          </div>
          <div style={{
            padding: '32px 32px 32px 32px',
            display: 'flex',
            flexDirection: 'column',
            gap: 0
          }}>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '30px 30px',
              marginBottom: 30,
              justifyContent: 'space-between'
            }}>
              {/* ...fields unchanged from previous code... */}
              {/* Financial Year */}
              <div style={fieldCss}>
                <label style={{ fontWeight: 'bold', marginBottom: 2, fontSize: 17 }}>
                  Financial Year
                </label>
                <select
                  onChange={handleYearChange}
                  value={selectedYear ? getShortYear(selectedYear.finYear) : ""}
                  style={{
                    width: '100%',
                    padding: 10,
                    borderColor: '#ccc',
                    borderRadius: 5,
                    fontSize: 16
                  }}
                >
                  <option value="">Select Year</option>
                  {financialYears.map(year => {
                    let shortYear = getShortYear(year.finYear);
                    return (
                      <option key={year.id || year.finYear} value={shortYear}>{year.finYear}</option>
                    );
                  })}
                </select>
              </div>
              {/* Invoice Number */}
              <div style={fieldCss}>
                <label style={{ fontWeight: 'bold', marginBottom: 2, fontSize: 17 }}>
                  Invoice Number
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  readOnly
                  style={{
                    width: '100%',
                    padding: 10,
                    borderColor: '#ccc',
                    borderRadius: 5,
                    fontSize: 16,
                    background: '#f7f9fa'
                  }}
                />
              </div>
              {/* Date */}
              <div style={fieldCss}>
                <label style={{ fontWeight: 'bold', marginBottom: 2, fontSize: 17 }}>
                  Date
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: 10,
                    borderColor: errors.date ? 'red' : '#ccc',
                    borderRadius: 5,
                    fontSize: 16
                  }}
                />
                {errors.date && <span style={{ color: 'red', fontSize: 14 }}>{errors.date}</span>}
              </div>
              {/* HSN */}
              <div style={fieldCss}>
                <label style={{ fontWeight: 'bold', marginBottom: 2, fontSize: 17 }}>
                  HSN Code
                </label>
                {loadingHsn
                  ? <div style={{ padding: 10, fontSize: 15 }}>Loading HSN codes…</div>
                  : (
                    <select
                      name="hsn"
                      value={formData.hsn}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        padding: 10,
                        borderColor: '#ccc',
                        borderRadius: 5,
                        fontSize: 16
                      }}
                    >
                      <option value="">Select HSN</option>
                      {hsnCodes.length
                        ? hsnCodes.map(code => (
                          <option key={code.code || code.id || code.hsnCode} value={code.code || code.id || code.hsnCode}>
                            {(code.code || code.hsnCode) + (code.description ? " - " + code.description : "")}
                          </option>
                        ))
                        : <option value="" disabled>No HSN available</option>
                      }
                    </select>
                  )}
              </div>
              {/* Tax Type */}
              <div style={fieldCss}>
                <label style={{ fontWeight: 'bold', marginBottom: 2, fontSize: 17 }}>
                  Tax Type
                </label>
                <select
                  name="taxType"
                  value={formData.taxType}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: 10,
                    borderColor: '#ccc',
                    borderRadius: 5,
                    fontSize: 16
                  }}
                >
                  <option value="">Select Tax</option>
                  {taxTypes.map(tax =>
                    <option key={tax.id} value={tax.taxDescription}>
                      {tax.taxDescription} ({tax.taxPercentage}%)
                    </option>
                  )}
                </select>
              </div>
              {/* Client Name */}
              <div style={fieldCss}>
                <label style={{ fontWeight: 'bold', marginBottom: 2, fontSize: 17 }}>
                  Client Name
                </label>
                <input
                  type="text"
                  name="clientName"
                  value={formData.clientName}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: 10,
                    borderColor: errors.clientName ? 'red' : '#ccc',
                    borderRadius: 5,
                    fontSize: 16
                  }}
                />
                {errors.clientName && <span style={{ color: 'red', fontSize: 14 }}>{errors.clientName}</span>}
              </div>
              {/* GST Number */}
              <div style={fieldCss}>
                <label style={{ fontWeight: 'bold', marginBottom: 2, fontSize: 17 }}>
                  GST Number (Optional)
                </label>
                <input
                  type="text"
                  name="gstNumber"
                  value={formData.gstNumber}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: 10,
                    borderColor: '#ccc',
                    borderRadius: 5,
                    fontSize: 16
                  }}
                />
              </div>
              {/* PAN Number */}
              <div style={fieldCss}>
                <label style={{ fontWeight: 'bold', marginBottom: 2, fontSize: 17 }}>
                  PAN Number (Optional)
                </label>
                <input
                  type="text"
                  name="panNumber"
                  value={formData.panNumber}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: 10,
                    borderColor: '#ccc',
                    borderRadius: 5,
                    fontSize: 16
                  }}
                />
              </div>
              {/* Address */}
              <div style={fieldCss}>
                <label style={{ fontWeight: 'bold', marginBottom: 2, fontSize: 17 }}>
                  Address
                </label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: 10,
                    borderColor: errors.address ? 'red' : '#ccc',
                    borderRadius: 5,
                    fontSize: 16,
                    resize: "vertical"
                  }}
                />
                {errors.address && <span style={{ color: 'red', fontSize: 14 }}>{errors.address}</span>}
              </div>
              {/* State */}
              <div style={fieldCss}>
                <label style={{ fontWeight: 'bold', marginBottom: 2, fontSize: 17 }}>
                  State
                </label>
                <select
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: 10,
                    borderColor: errors.state ? 'red' : '#ccc',
                    borderRadius: 5,
                    fontSize: 16
                  }}
                >
                  <option value="">Select</option>
                  {indianStates.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                {errors.state && <span style={{ color: 'red', fontSize: 14 }}>{errors.state}</span>}
              </div>
              {/* District */}
              <div style={fieldCss}>
                <label style={{ fontWeight: 'bold', marginBottom: 2, fontSize: 17 }}>
                  District (Optional)
                </label>
                <input
                  type="text"
                  name="district"
                  value={formData.district}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: 10,
                    borderColor: '#ccc',
                    borderRadius: 5,
                    fontSize: 16
                  }}
                />
              </div>
              {/* Pin Code */}
              <div style={fieldCss}>
                <label style={{ fontWeight: 'bold', marginBottom: 2, fontSize: 17 }}>
                  Pin Code
                </label>
                <input
                  type="text"
                  name="pinCode"
                  value={formData.pinCode}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: 10,
                    borderColor: errors.pinCode ? 'red' : '#ccc',
                    borderRadius: 5,
                    fontSize: 16
                  }}
                />
                {errors.pinCode && <span style={{ color: 'red', fontSize: 14 }}>{errors.pinCode}</span>}
              </div>
            </div>
            {/* --- Items Table --- */}
            <h3 style={{
              marginTop: 30,
              marginBottom: 10,
              color: '#222',
              fontSize: 22,
              borderBottom: '1.5px solid #222',
              paddingBottom: 8
            }}>
              Items
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                marginBottom: 10,
                background: '#f9f9f9',
                borderRadius: 8,
                overflow: 'hidden',
                fontSize: 16
              }}>
                <thead>
                  <tr style={{ background: '#000' }}>
                    <th style={{ border: '1px solid #d1d5db', padding: 10, color: '#fff', background: '#000', width: 60, fontSize: 16 }}>Sl No</th>
                    <th style={{ border: '1px solid #d1d5db', padding: 10, color: '#fff', width: 200, fontSize: 16 }}>Description</th>
                    <th style={{ border: '1px solid #d1d5db', padding: 10, color: '#fff', width: 90, fontSize: 16 }}>Quantity</th>
                    <th style={{ border: '1px solid #d1d5db', padding: 10, color: '#fff', width: 120, fontSize: 16 }}>Rate</th>
                    <th style={{ border: '1px solid #d1d5db', padding: 10, color: '#fff', width: 120, fontSize: 16 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i}>
                      <td style={{ border: '1px solid #d1d5db', textAlign: 'center', padding: 10, width: 60 }}>{item.serial}</td>
                      <td style={{ border: '1px solid #d1d5db', padding: 0, position: 'relative', width: 250 }}>
                        <div style={{ padding: '8px 0 8px 0', width: '100%' }}>
                          <input
                            value={item.description || ""}
                            onChange={e => handleItemChange(i, 'description', e.target.value)}
                            placeholder="Enter description"
                            style={{
                              width: '85%',
                              marginLeft: 8,
                              border: itemErrors[i]?.description ? '1.5px solid #e74c3c' : '1.5px solid #bbb',
                              borderRadius: 5,
                              padding: 8,
                              background: '#fff',
                              fontSize: 15
                            }}
                            maxLength={80}
                          />
                          {itemErrors[i]?.description && <span style={{ color: '#e74c3c', fontSize: 13, marginLeft: 10 }}>{itemErrors[i].description}</span>}
                        </div>
                      </td>
                      <td style={{ border: '1px solid #d1d5db', textAlign: 'center', padding: 10, width: 90 }}>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity ?? 1}
                          onChange={e => handleItemChange(i, 'quantity', e.target.value)}
                          style={{
                            width: 70,
                            textAlign: 'center',
                            border: itemErrors[i]?.quantity ? '1.5px solid #e74c3c' : '1.5px solid #bbb',
                            borderRadius: 5,
                            padding: 8,
                            background: '#fff',
                            fontSize: 15
                          }}
                        />
                        {itemErrors[i]?.quantity && <span style={{ color: '#e74c3c', fontSize: 13 }}>{itemErrors[i].quantity}</span>}
                      </td>
                      <td style={{ border: '1px solid #d1d5db', padding: 0, position: 'relative', width: 120 }}>
                        <div style={{ padding: '8px 0 8px 0', width: '90%' }}>
                          <input
                            value={item.rate !== undefined && item.rate!== null ? item.rate : ""}
                            type="text"
                            onChange={e => handleItemChange(i, 'rate', e.target.value)}
                            placeholder="Rate"
                            style={{
                              width: '90%',
                              marginLeft: 8,
                              border: itemErrors[i]?.rate ? '1.5px solid #e74c3c' : '1.5px solid #bbb',
                              borderRadius: 5,
                              padding: 8,
                              background: '#fff',
                              fontSize: 15
                            }}
                            maxLength={15}
                          />
                          {itemErrors[i]?.rate && <span style={{ color: '#e74c3c', fontSize: 13, marginLeft: 10 }}>{itemErrors[i].rate}</span>}
                        </div>
                      </td>
                      <td style={{ border: '1px solid #d1d5db', textAlign: 'right', padding: 10, paddingRight: 10, width: 120, fontSize: 15 }}>
                        {item.total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={addItem}
              type="button"
              style={{
                background: 'linear-gradient(90deg,#27ae60,#2ecc71)',
                padding: '14px 40px',
                border: 'none',
                borderRadius: 1,
                color: 'white',
                fontWeight: 'bold',
                fontSize: 20,
                letterSpacing: 1,
                boxShadow: '0 2px 8px #0002',
                cursor: 'pointer',
                marginBottom: 16,
                marginTop: 8
              }}
            >
              Add Item
            </button>
            <div style={{
              textAlign: 'right',
              marginTop: 20,
              fontSize: 20,
              color: '#222',
              borderTop: '1.5px solid #222',
              paddingTop: 16
            }}>
              <div><b>Total:</b> ₹{grandTotal.toFixed(2)}</div>
              <div>
                <b>{taxRateString}:</b> ₹{taxAmount.toFixed(2)}
              </div>
              <div><b>Grand Total:</b> ₹{grandTotalWithTax.toFixed(2)}</div>
              <div style={{ fontSize: 15, color: '#333', marginTop: 5 }}>
                <b>In Words:</b> {numberToWords(Math.round(grandTotalWithTax))} Only
              </div>
            </div>
            <div style={{ marginTop: 40, textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '30px' }}>
              <button
                onClick={downloadPDF}
                type="button"
                style={{
                  background: 'linear-gradient(90deg,#27ae60,#2ecc71)',
                  padding: '14px 40px',
                  border: 'none',
                  borderRadius: 1,
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: 20,
                  letterSpacing: 1,
                  boxShadow: '0 2px 8px #0002',
                  cursor: 'pointer'
                }}
              >
                Download PDF
              </button>
              <button
                type="submit"
                style={{
                  background: 'linear-gradient(90deg,#3a56d4,#4361ee)',
                  padding: '14px 40px',
                  border: 'none',
                  borderRadius: 1,
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: 20,
                  letterSpacing: 1,
                  boxShadow: '0 2px 8px #0002',
                  cursor: 'pointer'
                }}
              >
                Submit Invoice
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default InvoiceForm_copy;