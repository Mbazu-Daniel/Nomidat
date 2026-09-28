import PDFDocument from "pdfkit";
import type { InvoiceDocument } from "./types";

const ink = "#303842";
const muted = "#8b9099";
const accent = "#e76b35";
const rule = "#eeece9";

export function createInvoicePdf(invoice: InvoiceDocument, businessName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
      size: "A4",
      margins: { top: 48, bottom: 32, left: 48, right: 48 },
      bufferPages: true,
      info: { Title: invoice.invoiceNumber, Author: businessName },
    });
    const chunks: Buffer[] = [];
    pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdf.on("error", reject);
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    const money = (value: number) =>
      `${invoice.currency} ${(value / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const date = (value: Date) =>
      value.toLocaleDateString("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    const line = (y: number) =>
      pdf.moveTo(48, y).lineTo(547, y).lineWidth(0.6).strokeColor(rule).stroke();
    const text = (
      value: string,
      x: number,
      y: number,
      width: number,
      size = 10,
      color = ink,
      align: "left" | "right" = "left",
    ) => {
      pdf.font("Helvetica").fontSize(size).fillColor(color).text(value, x, y, { width, align });
    };
    function drawLogo() {
      pdf.rect(0, 0, 596, 5).fill(accent);
      let hasLogo = false;
      if (invoice.businessLogo) {
        try {
          pdf.image(Buffer.from(invoice.businessLogo.split(",")[1], "base64"), 48, 40, {
            fit: [160, 48],
          });
          hasLogo = true;
        } catch {
          /* Older or invalid logos use the vector fallback. */
        }
      }
      if (!hasLogo) {
        // Draw the brand directly into the PDF so it never depends on a remote image.
        pdf.roundedRect(48, 44, 34, 34, 9).fill(accent);
        pdf
          .font("Helvetica-Bold")
          .fontSize(27)
          .fillColor("#ffffff")
          .text("n", 57, 46, { lineBreak: false });
        pdf
          .font("Helvetica-Bold")
          .fontSize(22)
          .fillColor(ink)
          .text("nomidat", 91, 49, { lineBreak: false });
        const logoEnd = 91 + pdf.widthOfString("nomidat");
        pdf.fillColor(accent).text(".", logoEnd, 49, { lineBreak: false });
      }
    }
    drawLogo();
    function drawHeader() {
      text("ISSUED BY", 48, 102, 265, 8, muted);
      pdf
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor(ink)
        .text(businessName, 48, 119, { width: 265 });
      let detailsY = pdf.y + 8;
      const business = invoice.businessDetails;
      const businessLines = [
        business?.shopNumber ? `Shop ${business.shopNumber}` : undefined,
        business?.address,
        business?.phone,
        business?.email,
        business?.registrationNumber ? `Registration: ${business.registrationNumber}` : undefined,
      ];
      for (const value of businessLines) {
        if (!value) continue;
        text(value, 48, detailsY, 265, 9, muted);
        detailsY = pdf.y + 5;
      }
      const headerBottom = Math.max(153, detailsY + 8);
      text("INVOICE", 330, 48, 217, 30, ink, "right");
      text(invoice.invoiceNumber, 315, 92, 232, 10, muted, "right");
      text("A clear record of your business.", 315, 112, 232, 8, muted, "right");
      line(headerBottom + 20);
      return headerBottom;
    }
    const headerBottom = drawHeader();
    function drawBilling() {
      const billingY = headerBottom + 43;
      text("BILL TO", 48, billingY, 220, 8, muted);
      text(invoice.customer ?? "Walk-in customer", 48, billingY + 20, 240, 14);
      const customerBottom = pdf.y;
      if (invoice.customerEmail) text(invoice.customerEmail, 48, customerBottom + 7, 240, 9, muted);
      text("Issued on", 350, billingY, 70, 9, muted);
      text(date(invoice.createdAt), 418, billingY, 129, 9, ink, "right");
      text("Due date", 350, billingY + 22, 70, 9, muted);
      text(
        invoice.dueDate ? date(invoice.dueDate) : "On receipt",
        418,
        billingY + 22,
        129,
        9,
        ink,
        "right",
      );
      text("Currency", 350, billingY + 44, 70, 9, muted);
      text(invoice.currency, 418, billingY + 44, 129, 9, ink, "right");
      return Math.max(billingY + 83, customerBottom + 40);
    }
    let y = drawBilling();
    const tableHeader = () => {
      pdf.rect(48, y, 499, 29).fill("#fff1e7");
      text("DESCRIPTION", 60, y + 10, 240, 8, "#986342");
      text("QTY", 308, y + 10, 33, 8, "#986342", "right");
      text("UNIT PRICE", 350, y + 10, 89, 8, "#986342", "right");
      text("AMOUNT", 444, y + 10, 91, 8, "#986342", "right");
      y += 29;
    };
    function drawItems() {
      tableHeader();
      for (const item of invoice.items) {
        pdf.font("Helvetica").fontSize(10);
        const height = Math.max(
          48,
          pdf.heightOfString(item.description ?? "Item", { width: 230 }) + 28,
        );
        if (y + height > 730) {
          pdf.addPage();
          text(`${invoice.invoiceNumber} / continued`, 48, 40, 499, 9, muted);
          y = 66;
          tableHeader();
        }
        text(item.description ?? "Item", 60, y + 16, 230, 10);
        text(String(item.quantity), 308, y + 16, 33, 9, ink, "right");
        text(money(item.unitPriceKobo), 350, y + 16, 89, 9, ink, "right");
        text(money(item.totalKobo), 444, y + 16, 91, 9, ink, "right");
        y += height;
        line(y);
      }
    }
    drawItems();
    function drawTotals() {
      if (y + 182 > 730) {
        pdf.addPage();
        y = 48;
      }
      y += 25;
      for (const [label, value] of [
        ["Subtotal", invoice.subtotalKobo],
        ["Discount", -invoice.discountKobo],
        ["Tax", invoice.taxKobo],
      ] as const) {
        text(label, 335, y, 70, 10, muted);
        text(money(value), 406, y, 129, 10, ink, "right");
        y += 24;
      }
      pdf.roundedRect(322, y + 5, 225, 64, 7).fill("#f5e4d9");
      pdf.roundedRect(322, y + 2, 225, 64, 7).fill(accent);
      text("INVOICE TOTAL", 335, y + 14, 185, 8, "#ffffff");
      text(money(invoice.totalKobo), 335, y + 31, 200, 20, "#ffffff", "right");
      y += 91;
    }
    drawTotals();
    function drawFooter() {
      if (y + 80 > 730) {
        pdf.addPage();
        y = 48;
      }
      text("A NOTE FOR YOU", 48, y, 240, 8, muted);
      text(
        invoice.notes ||
          "Thank you for your business. We appreciate the opportunity to work with you.",
        48,
        y + 19,
        499,
        10,
        muted,
      );
      const pages = pdf.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        pdf.switchToPage(i);
        line(775);
        text("nomidat / " + invoice.invoiceNumber, 48, 789, 350, 8, muted);
        text(`${i + 1} / ${pages.count}`, 447, 789, 100, 8, muted, "right");
      }
    }
    drawFooter();
    pdf.end();
  });
}
