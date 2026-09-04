/**
 * Vandi Load - Professional PDF Export Generator
 * Produces clean, branded PDF reports with active filters, metadata, and tables.
 */

const PDFExport = {
  /**
   * Main export method
   * @param {string} reportType - 'vehicles' | 'drivers' | 'enquiries' | 'orders' | 'categories'
   * @param {Array} data - Filtered list of records
   * @param {Object} filterMeta - Active filter descriptions
   */
  async exportReport(reportType, data, filterMeta = {}) {
    if (!data || data.length === 0) {
      alert('No records available to export with the current filters.');
      return;
    }

    const timestamp = new Date().toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    let title = 'Report';
    let columns = [];
    let rows = [];

    switch (reportType) {
      case 'vehicles':
        title = 'Vehicles Catalog Report';
        columns = ['#', 'Vehicle Name', 'Category', 'Capacity (Kg)', 'Box Capacity', 'Bed Dimensions', 'Status'];
        rows = data.map((v, i) => [
          i + 1,
          v.name || 'N/A',
          v.category ? v.category.toUpperCase() : 'N/A',
          v.capacityKg || v.capacity_kg || 'N/A',
          v.capacityBoxes || v.capacity_boxes || 'N/A',
          v.bedSize || v.bed_size || 'N/A',
          (v.status || 'active').toUpperCase()
        ]);
        break;

      case 'categories':
        title = 'Vehicle Categories Report';
        columns = ['#', 'Category Name', 'Slug ID', 'Load Capacity Info', 'Order', 'Status'];
        rows = data.map((c, i) => [
          i + 1,
          c.name || 'N/A',
          c.id || 'N/A',
          c.capacityInfo || c.capacity_info || 'N/A',
          c.displayOrder || c.display_order || 0,
          (c.status || 'active').toUpperCase()
        ]);
        break;

      case 'drivers':
        title = 'Registered Drivers Report';
        columns = ['#', 'Driver Name', 'Phone', 'Operating City', 'Vehicle Type', 'Vehicle Number', 'Exp (Yrs)', 'Status'];
        rows = data.map((d, i) => [
          i + 1,
          d.full_name || 'N/A',
          d.phone || 'N/A',
          d.location || 'N/A',
          (d.vehicle_type || 'N/A').toUpperCase(),
          d.vehicle_number || 'N/A',
          d.experience || '0',
          (d.status || 'pending').toUpperCase()
        ]);
        break;

      case 'enquiries':
        title = 'Customer Enquiries Report';
        columns = ['#', 'Req ID', 'Customer Name', 'Phone', 'Pickup -> Drop', 'Load Type', 'Vehicle Req', 'Assigned Driver', 'Status'];
        rows = data.map((e, i) => [
          i + 1,
          e.request_code || `#${e.id}`,
          e.name || 'N/A',
          e.phone || 'N/A',
          `${e.pickup_city || '-'} → ${e.drop_city || '-'}`,
          `${e.quantity || ''} ${e.goods_category || ''}`.trim() || 'General Cargo',
          e.vehicle_preferred || 'Best Fit',
          e.assigned_driver_name ? `${e.assigned_driver_name} (${e.assigned_driver_phone || ''})` : 'Unassigned',
          (e.assignment_status || e.status || 'Pending').toUpperCase()
        ]);
        break;

      case 'orders':
        title = 'Assigned Load Orders Report';
        columns = ['#', 'Order Code', 'Customer', 'Phone', 'Route', 'Assigned Driver', 'Driver Phone', 'Status', 'Date'];
        rows = data.map((o, i) => [
          i + 1,
          o.request_code || `#${o.id}`,
          o.name || 'N/A',
          o.phone || 'N/A',
          `${o.pickup_city || '-'} → ${o.drop_city || '-'}`,
          o.assigned_driver_name || 'Unassigned',
          o.assigned_driver_phone || '-',
          (o.assignment_status || 'Pending').toUpperCase(),
          o.created_at ? new Date(o.created_at).toLocaleDateString('en-IN') : '-'
        ]);
        break;
    }

    // Try jsPDF if loaded
    if (window.jspdf && window.jspdf.jsPDF) {
      try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

        // Header Background
        doc.setFillColor(13, 19, 31); // #0d131f
        doc.rect(0, 0, 297, 28, 'F');

        // Gold decorative bar
        doc.setFillColor(229, 168, 59); // #e5a83b
        doc.rect(0, 28, 297, 2, 'F');

        // Brand Text
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('VANDI LOAD', 14, 12);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(203, 213, 225);
        doc.text('MOVE • TRUST • DELIVER | Official Logistics Report', 14, 18);

        // Report Title & Date
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(229, 168, 59);
        doc.text(title.toUpperCase(), 200, 12, { align: 'right' });

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(203, 213, 225);
        doc.text(`Generated: ${timestamp}`, 200, 18, { align: 'right' });

        // Filter Summary Box
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        let filterSummaryText = `Total Records: ${data.length}`;
        if (filterMeta.status && filterMeta.status !== 'all') filterSummaryText += ` | Status: ${filterMeta.status}`;
        if (filterMeta.category && filterMeta.category !== 'all') filterSummaryText += ` | Category: ${filterMeta.category}`;
        if (filterMeta.driver && filterMeta.driver !== 'all') filterSummaryText += ` | Driver Filter: Applied`;
        if (filterMeta.dateFrom || filterMeta.dateTo) filterSummaryText += ` | Date Range: ${filterMeta.dateFrom || 'Any'} to ${filterMeta.dateTo || 'Any'}`;

        doc.text(filterSummaryText, 14, 36);

        // Render Table with autotable
        doc.autoTable({
          startY: 40,
          head: [columns],
          body: rows,
          theme: 'striped',
          headStyles: {
            fillColor: [30, 41, 59],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9,
            cellPadding: 3
          },
          bodyStyles: {
            fontSize: 8.5,
            cellPadding: 2.8,
            textColor: [30, 41, 59]
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252]
          },
          margin: { left: 14, right: 14 },
          didDrawPage: function (data) {
            // Footer page number
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text(`Page ${doc.internal.getNumberOfPages()}`, 280, 202, { align: 'right' });
            doc.text('Vandi Load Management Portal • Confidential', 14, 202);
          }
        });

        const filename = `VandiLoad_${reportType}_${new Date().toISOString().slice(0, 10)}.pdf`;
        doc.save(filename);
        return;
      } catch (err) {
        console.warn('jsPDF rendering error, falling back to print generator:', err);
      }
    }

    // High fidelity printable report fallback
    this.openPrintableReport(title, columns, rows, filterMeta, timestamp, data.length);
  },

  openPrintableReport(title, columns, rows, filterMeta, timestamp, totalCount) {
    const printWin = window.open('', '_blank', 'width=1100,height=800');
    if (!printWin) {
      alert('Please allow popups to download and print the PDF report.');
      return;
    }

    let filterText = `<strong>Total Records:</strong> ${totalCount}`;
    if (filterMeta.status && filterMeta.status !== 'all') filterText += ` &nbsp;|&nbsp; <strong>Status:</strong> ${filterMeta.status}`;
    if (filterMeta.category && filterMeta.category !== 'all') filterText += ` &nbsp;|&nbsp; <strong>Category:</strong> ${filterMeta.category}`;
    if (filterMeta.dateFrom || filterMeta.dateTo) filterText += ` &nbsp;|&nbsp; <strong>Date:</strong> ${filterMeta.dateFrom || 'Any'} to ${filterMeta.dateTo || 'Any'}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Vandi Load - ${title}</title>
        <style>
          @page { size: landscape; margin: 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 20px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #e5a83b; padding-bottom: 12px; margin-bottom: 16px; }
          .brand { display: flex; align-items: center; gap: 12px; }
          .brand-title { font-size: 22px; font-weight: 800; color: #0a0e17; letter-spacing: 0.5px; }
          .brand-tagline { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
          .report-info { text-align: right; }
          .report-title { font-size: 18px; font-weight: 700; color: #3d7950; margin-bottom: 4px; }
          .report-date { font-size: 12px; color: #64748b; }
          .filter-bar { background: #f1f5f9; padding: 8px 12px; border-radius: 6px; font-size: 12px; margin-bottom: 16px; color: #334155; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
          th { background: #0f172a; color: #ffffff; text-align: left; padding: 8px 10px; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
          td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; }
          tr:nth-child(even) td { background: #f8fafc; }
          .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; }
          .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
          @media print {
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 16px; display: flex; gap: 10px;">
          <button onclick="window.print()" style="padding: 8px 18px; background: #3d7950; color: #fff; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">
            🖨️ Print / Save as PDF
          </button>
          <button onclick="window.close()" style="padding: 8px 14px; background: #64748b; color: #fff; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">
            Close
          </button>
        </div>

        <div class="header">
          <div class="brand">
            <div>
              <div class="brand-title">VANDI LOAD</div>
              <div class="brand-tagline">Move • Trust • Deliver</div>
            </div>
          </div>
          <div class="report-info">
            <div class="report-title">${title.toUpperCase()}</div>
            <div class="report-date">Generated: ${timestamp}</div>
          </div>
        </div>

        <div class="filter-bar">
          ${filterText}
        </div>

        <table>
          <thead>
            <tr>${columns.map(c => `<th>${c}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows.map(r => `<tr>${r.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>

        <div class="footer">
          <span>Vandi Load Fleet Management & Logistics Portal</span>
          <span>Confidential • Internal Report</span>
        </div>
      </body>
      </html>
    `;

    printWin.document.write(html);
    printWin.document.close();
  }
};
