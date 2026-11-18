import test from 'tape';
import {
  buildMyInvoisUBLDocument,
  getMyInvoisBaseUrl,
  isEInvoiceEnabled,
  validateEInvoiceConfig,
} from '../src/utils/malaysiaEInvoice';

test('Malaysia e-Invoice toggle and validation', (t) => {
  t.equal(isEInvoiceEnabled(undefined), false, 'disabled when undefined');
  t.equal(
    isEInvoiceEnabled({ enableEInvoice: false }),
    false,
    'disabled when false'
  );
  t.equal(
    isEInvoiceEnabled({ enableEInvoice: true }),
    true,
    'enabled when true'
  );

  t.deepEqual(
    validateEInvoiceConfig({ enableEInvoice: false }),
    [],
    'no validation errors when disabled'
  );

  const errors = validateEInvoiceConfig({ enableEInvoice: true });
  t.equal(
    errors.length,
    4,
    'requires TIN, BRN, MSIC, and Business Activity when enabled'
  );

  t.deepEqual(
    validateEInvoiceConfig({
      enableEInvoice: true,
      supplierTIN: 'C1234567890',
      supplierBRN: '202001012345',
      msicCode: '46510',
      businessActivityDescription: 'Retail sale of computers',
    }),
    [],
    'passes validation when required merchant fields are present'
  );
  t.end();
});

test('Malaysia e-Invoice environment URLs', (t) => {
  t.equal(
    getMyInvoisBaseUrl('Sandbox'),
    'https://preprod-api.myinvois.hasil.gov.my',
    'uses preprod URL for Sandbox'
  );
  t.equal(
    getMyInvoisBaseUrl('Production'),
    'https://api.myinvois.hasil.gov.my',
    'uses production URL for Production'
  );
  t.end();
});

test('buildMyInvoisUBLDocument generates UBL 2.1 JSON payload', (t) => {
  const ubl = buildMyInvoisUBLDocument(
    {
      name: 'SINV-0001',
      date: '2026-11-18T10:00:00Z',
      currency: 'MYR',
      party: 'Acme Sdn Bhd',
      buyerTIN: 'C9876543210',
      netTotal: 100,
      grandTotal: 106,
      items: [
        {
          item: 'Booster Box',
          quantity: 1,
          rate: 100,
          amount: 100,
          taxAmount: 6,
        },
      ],
    },
    {
      enableEInvoice: true,
      supplierTIN: 'C1234567890',
      supplierBRN: '202001012345',
      msicCode: '47612',
      businessActivityDescription: 'Retail sale of games and toys',
    }
  ) as { Invoice: Record<string, unknown>[] };

  const inv = ubl.Invoice[0];
  t.equal((inv.ID as { _: string }[])[0]._, 'SINV-0001', 'sets invoice ID');
  t.equal(
    (inv.DocumentCurrencyCode as { _: string }[])[0]._,
    'MYR',
    'sets MYR currency'
  );
  t.equal(
    (inv.InvoiceTypeCode as { _: string }[])[0]._,
    '01',
    'sets InvoiceTypeCode 01 for normal invoice'
  );
  t.equal((inv.InvoiceLine as unknown[]).length, 1, 'includes 1 invoice line');
  t.end();
});
