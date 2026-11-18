export interface ThermalReceiptItem {
  name: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface ThermalReceiptInput {
  companyName: string;
  invoiceName: string;
  date: string;
  customer?: string;
  currency?: string;
  items: ThermalReceiptItem[];
  netTotal: number;
  taxTotal?: number;
  grandTotal: number;
  eInvoiceValidationUrl?: string;
  widthMm?: 58 | 80;
}

export function buildThermalReceiptHtml(input: ThermalReceiptInput): string {
  const widthMm = input.widthMm ?? 80;
  const currency = input.currency ?? 'MYR';
  const rows = input.items
    .map(
      (item) => `
      <tr>
        <td style="padding:2px 0;">${item.name} x${item.qty}</td>
        <td style="text-align:right;padding:2px 0;">${item.amount.toFixed(2)}</td>
      </tr>`
    )
    .join('');

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
      input.eInvoiceValidationUrl
    )}`;
    const qrBlock = input.eInvoiceValidationUrl
    ? `<div style="text-align:center;margin-top:8px;font-size:10px;word-break:break-all;">
        <div>MyInvois Validation:</div>
        <img src="${qrUrl}" alt="MyInvois QR" style="width:96px;height:96px;margin:4px auto;display:block;" />
        <div>${input.eInvoiceValidationUrl}</div>
      </div>`
    : '';

  return `<div style="width:${widthMm}mm;font-family:monospace;font-size:12px;padding:4px;">
  <div style="text-align:center;font-weight:bold;font-size:14px;">${input.companyName}</div>
  <div style="text-align:center;font-size:11px;margin-bottom:6px;">${input.invoiceName} | ${input.date}</div>
  ${input.customer ? `<div style="font-size:11px;margin-bottom:4px;">Customer: ${input.customer}</div>` : ''}
  <table style="width:100%;border-top:1px dashed #000;border-bottom:1px dashed #000;border-collapse:collapse;">
    <tbody>${rows}</tbody>
  </table>
  <div style="margin-top:6px;">
    <div style="display:flex;justify-content:space-between;"><span>Net Total</span><span>${currency} ${input.netTotal.toFixed(2)}</span></div>
    ${input.taxTotal ? `<div style="display:flex;justify-content:space-between;"><span>Tax</span><span>${currency} ${input.taxTotal.toFixed(2)}</span></div>` : ''}
    <div style="display:flex;justify-content:space-between;font-weight:bold;"><span>Grand Total</span><span>${currency} ${input.grandTotal.toFixed(2)}</span></div>
  </div>
  ${qrBlock}
</div>`;
}
