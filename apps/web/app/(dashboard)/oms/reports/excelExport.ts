import ExcelJS from "exceljs";
import { PLReportSummary } from "./types";

export async function exportPLToExcel(report: PLReportSummary) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "JOTLayerRaid OMS";
  workbook.created = new Date();

  const sheetName = `${report.year} P&L`;
  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true }]
  });

  // Define Columns
  worksheet.columns = [
    { header: "", key: "category", width: 28 },
    { header: "", key: "m1", width: 15 },
    { header: "", key: "m2", width: 15 },
    { header: "", key: "m3", width: 15 },
    { header: "", key: "m4", width: 15 },
    { header: "", key: "m5", width: 15 },
    { header: "", key: "m6", width: 15 },
    { header: "", key: "m7", width: 15 },
    { header: "", key: "m8", width: 15 },
    { header: "", key: "m9", width: 15 },
    { header: "", key: "m10", width: 15 },
    { header: "", key: "m11", width: 15 },
    { header: "", key: "m12", width: 15 },
    { header: "", key: "total", width: 18 }
  ];

  // Helper styles
  const fontBold = { name: "Arial", bold: true, size: 10 };
  const fontRegular = { name: "Arial", size: 10 };
  const fontTitle = { name: "Arial", bold: true, size: 12 };
  const greenHeaderFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "00FF00" } // Bright green matching screenshot
  };
  const lightGreenFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "D9EAD3" } // Soft green
  };
  const yellowFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF2CC" } // Soft yellow matching screenshot
  };
  const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "D3D3D3" } },
    left: { style: "thin", color: { argb: "D3D3D3" } },
    bottom: { style: "thin", color: { argb: "D3D3D3" } },
    right: { style: "thin", color: { argb: "D3D3D3" } }
  };

  // Row 1: Title
  const r1 = worksheet.addRow(["PROFIT & LOSS RECORDING"]);
  r1.getCell(1).font = fontTitle;

  // Row 2: Company Name
  const r2 = worksheet.addRow([report.companyName || "Just One Tee Group"]);
  r2.getCell(1).font = fontRegular;

  // Row 3: Currency Exchange
  const r3 = worksheet.addRow(["Currency Exchange", report.exchangeRate || 26000]);
  r3.getCell(1).font = fontBold;
  r3.getCell(2).font = fontBold;
  r3.getCell(2).numFmt = "#,##0";

  // Row 4: Empty spacer
  worksheet.addRow([]);

  // Row 5: Column Headers (Jan .. Dec, YTD)
  const headerRowValues = [
    "Category / Metric",
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
    "YTD"
  ];
  const rHeader = worksheet.addRow(headerRowValues);
  rHeader.font = fontBold;
  rHeader.alignment = { horizontal: "center", vertical: "middle" };

  // Row 6: Revenue Banner
  const rRevBanner = worksheet.addRow(["Revenue"]);
  for (let c = 1; c <= 14; c++) {
    const cell = rRevBanner.getCell(c);
    cell.fill = greenHeaderFill;
    cell.font = { ...fontBold, color: { argb: "000000" } };
  }

  // Row 7: Revenue (USD)
  const revRowValues: any[] = ["Revenue"];
  for (let m = 1; m <= 12; m++) {
    revRowValues.push(report.months[m - 1]?.totalRevenue || 0);
  }
  revRowValues.push(report.totals.totalRevenue);
  const rRev = worksheet.addRow(revRowValues);
  rRev.font = fontRegular;
  for (let c = 2; c <= 14; c++) {
    const cell = rRev.getCell(c);
    cell.numFmt = "$#,##0.00";
    cell.border = borderThin;
  }

  // Row 8: Refund (USD)
  const refRowValues: any[] = ["Refund"];
  for (let m = 1; m <= 12; m++) {
    refRowValues.push(report.months[m - 1]?.refund || 0);
  }
  refRowValues.push(report.totals.refund);
  const rRef = worksheet.addRow(refRowValues);
  rRef.font = fontRegular;
  for (let c = 2; c <= 14; c++) {
    const cell = rRef.getCell(c);
    cell.numFmt = "$#,##0.00";
    cell.border = borderThin;
  }

  // Row 9: Cross-Revenue / Gross Revenue (USD)
  const crossRowValues: any[] = ["Cross-Revenue"];
  for (let m = 1; m <= 12; m++) {
    crossRowValues.push(report.months[m - 1]?.crossRevenue || 0);
  }
  crossRowValues.push(report.totals.crossRevenue);
  const rCross = worksheet.addRow(crossRowValues);
  rCross.font = fontBold;
  for (let c = 1; c <= 14; c++) {
    const cell = rCross.getCell(c);
    cell.fill = lightGreenFill;
    if (c >= 2) cell.numFmt = "$#,##0.00";
    cell.border = borderThin;
  }

  // Row 10: Empty spacer
  worksheet.addRow([]);

  // Cost Categories Rows
  for (const cat of report.categoriesList) {
    const catRowValues: any[] = [cat];
    for (let m = 1; m <= 12; m++) {
      catRowValues.push(report.months[m - 1]?.costCategories[cat] || 0);
    }
    catRowValues.push(report.totals.costCategories[cat] || 0);
    const rCat = worksheet.addRow(catRowValues);
    rCat.font = fontRegular;
    for (let c = 2; c <= 14; c++) {
      const cell = rCat.getCell(c);
      cell.numFmt = "$#,##0.00";
      cell.border = borderThin;
    }
  }

  // Empty spacer
  worksheet.addRow([]);

  // TOTAL COST Row
  const totalCostValues: any[] = ["TOTAL COST"];
  for (let m = 1; m <= 12; m++) {
    totalCostValues.push(report.months[m - 1]?.totalCost || 0);
  }
  totalCostValues.push(report.totals.totalCost);
  const rTotalCost = worksheet.addRow(totalCostValues);
  rTotalCost.font = fontBold;
  for (let c = 1; c <= 14; c++) {
    const cell = rTotalCost.getCell(c);
    cell.fill = yellowFill;
    if (c >= 2) cell.numFmt = "$#,##0.00";
    cell.border = borderThin;
  }

  // Empty spacer
  worksheet.addRow([]);

  // NET PROFIT ($ USD)
  const netProfitUsdValues: any[] = ["NET PROFIT ($)"];
  for (let m = 1; m <= 12; m++) {
    netProfitUsdValues.push(report.months[m - 1]?.netProfitUsd || 0);
  }
  netProfitUsdValues.push(report.totals.netProfitUsd);
  const rNetUsd = worksheet.addRow(netProfitUsdValues);
  rNetUsd.font = fontBold;
  for (let c = 1; c <= 14; c++) {
    const cell = rNetUsd.getCell(c);
    cell.fill = yellowFill;
    if (c >= 2) cell.numFmt = "$#,##0.00;($#,##0.00);$0.00";
    cell.border = borderThin;
  }

  // NET PROFIT (VND)
  const netProfitVndValues: any[] = ["NET PROFIT (VND)"];
  for (let m = 1; m <= 12; m++) {
    netProfitVndValues.push(report.months[m - 1]?.netProfitVnd || 0);
  }
  netProfitVndValues.push(report.totals.netProfitVnd);
  const rNetVnd = worksheet.addRow(netProfitVndValues);
  rNetVnd.font = fontBold;
  for (let c = 2; c <= 14; c++) {
    const cell = rNetVnd.getCell(c);
    cell.numFmt = '#,##0" ₫";(#,##0" ₫");0" ₫"';
    cell.border = borderThin;
  }

  // Net Profit Margin %
  const marginValues: any[] = ["Net Profit Margin %"];
  for (let m = 1; m <= 12; m++) {
    marginValues.push((report.months[m - 1]?.netProfitMargin || 0) / 100);
  }
  marginValues.push(report.totals.netProfitMargin / 100);
  const rMargin = worksheet.addRow(marginValues);
  rMargin.font = fontRegular;
  for (let c = 2; c <= 14; c++) {
    const cell = rMargin.getCell(c);
    cell.numFmt = "0.00%";
    cell.border = borderThin;
  }

  // Accumulate PROFIT (VND)
  const accVndValues: any[] = ["Accumulate PROFIT (VND)"];
  for (let m = 1; m <= 12; m++) {
    accVndValues.push(report.months[m - 1]?.accumulateProfitVnd || 0);
  }
  accVndValues.push(report.totals.accumulateProfitVnd);
  const rAccVnd = worksheet.addRow(accVndValues);
  rAccVnd.font = fontBold;
  for (let c = 2; c <= 14; c++) {
    const cell = rAccVnd.getCell(c);
    cell.numFmt = '#,##0" ₫";(#,##0" ₫");0" ₫"';
    cell.border = borderThin;
  }

  // Accumulate PROFIT (USD)
  const accUsdValues: any[] = ["Accumulate PROFIT ($)"];
  for (let m = 1; m <= 12; m++) {
    accUsdValues.push(report.months[m - 1]?.accumulateProfitUsd || 0);
  }
  accUsdValues.push(report.totals.accumulateProfitUsd);
  const rAccUsd = worksheet.addRow(accUsdValues);
  rAccUsd.font = fontBold;
  for (let c = 2; c <= 14; c++) {
    const cell = rAccUsd.getCell(c);
    cell.numFmt = "$#,##0.00;($#,##0.00);$0.00";
    cell.border = borderThin;
  }

  // Generate buffer and trigger browser download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `Profit_Loss_Report_${report.year}_${new Date().toISOString().split("T")[0]}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
