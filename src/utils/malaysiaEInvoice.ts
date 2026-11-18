export type MyInvoisEnvironment = 'Sandbox' | 'Production';

export interface EInvoiceSettingsConfig {
  enableEInvoice?: boolean;
  environment?: MyInvoisEnvironment | string;
  autoSubmitOnInvoiceSubmit?: boolean;
  supplierTIN?: string;
  supplierBRN?: string;
  supplierSST?: string;
  msicCode?: string;
  businessActivityDescription?: string;
  clientId?: string;
  clientSecret?: string;
}

export interface EInvoiceLineItemInput {
  item?: string;
  description?: string;
  quantity?: number;
  rate?: number;
  amount?: number;
  taxAmount?: number;
  classificationCode?: string;
}

export interface EInvoiceDocumentInput {
  name: string;
  date?: Date | string;
  currency?: string;
  party?: string;
  buyerTIN?: string;
  buyerBRN?: string;
  isReturn?: boolean;
  netTotal?: number;
  grandTotal?: number;
  items?: EInvoiceLineItemInput[];
}

export interface MyInvoisSubmissionResult {
  submissionUid: string;
  uuid?: string;
  longId?: string;
  validationUrl?: string;
}

export function isEInvoiceEnabled(
  settings?: EInvoiceSettingsConfig | null
): boolean {
  return Boolean(settings?.enableEInvoice);
}

export function getMyInvoisBaseUrl(
  environment?: MyInvoisEnvironment | string
): string {
  return environment === 'Production'
    ? 'https://api.myinvois.hasil.gov.my'
    : 'https://preprod-api.myinvois.hasil.gov.my';
}

export function validateEInvoiceConfig(
  settings?: EInvoiceSettingsConfig | null
): string[] {
  if (!isEInvoiceEnabled(settings)) {
    return [];
  }

  const errors: string[] = [];
  if (!settings?.supplierTIN?.trim()) {
    errors.push('Supplier TIN is required when Malaysia e-Invoice is enabled.');
  }
  if (!settings?.supplierBRN?.trim()) {
    errors.push(
      'Supplier BRN / NRIC is required when Malaysia e-Invoice is enabled.'
    );
  }
  if (!settings?.msicCode?.trim()) {
    errors.push('MSIC Code is required when Malaysia e-Invoice is enabled.');
  }
  if (!settings?.businessActivityDescription?.trim()) {
    errors.push(
      'Business Activity Description is required when Malaysia e-Invoice is enabled.'
    );
  }
  return errors;
}

export function buildMyInvoisUBLDocument(
  invoice: EInvoiceDocumentInput,
  settings: EInvoiceSettingsConfig
): Record<string, unknown> {
  const issueDate = invoice.date ? new Date(invoice.date) : new Date();
  const isoDate = issueDate.toISOString().slice(0, 10);
  const isoTime = issueDate.toISOString().slice(11, 19) + 'Z';
  const currency = invoice.currency || 'MYR';
  const invoiceTypeCode = invoice.isReturn ? '02' : '01';
  const items = invoice.items ?? [];

  const taxTotalAmount = items.reduce(
    (sum, item) => sum + Number(item.taxAmount ?? 0),
    0
  );
  const lineExtensionAmount =
    invoice.netTotal ??
    items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const payableAmount =
    invoice.grandTotal ?? lineExtensionAmount + taxTotalAmount;

  return {
    _D: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
    _A: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
    _B: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
    Invoice: [
      {
        ID: [{ _: invoice.name }],
        IssueDate: [{ _: isoDate }],
        IssueTime: [{ _: isoTime }],
        InvoiceTypeCode: [{ _: invoiceTypeCode, listVersionID: '1.0' }],
        DocumentCurrencyCode: [{ _: currency }],
        AccountingSupplierParty: [
          {
            AdditionalAccountID: [
              { _: settings.msicCode ?? '', schemeAgencyName: 'CertEX' },
            ],
            Party: [
              {
                IndustryClassificationCode: [
                  {
                    _: settings.msicCode ?? '',
                    name: settings.businessActivityDescription ?? '',
                  },
                ],
                PartyIdentification: [
                  {
                    ID: [{ _: settings.supplierTIN ?? '', schemeID: 'TIN' }],
                  },
                  {
                    ID: [{ _: settings.supplierBRN ?? '', schemeID: 'BRN' }],
                  },
                  ...(settings.supplierSST
                    ? [
                        {
                          ID: [{ _: settings.supplierSST, schemeID: 'SST' }],
                        },
                      ]
                    : []),
                ],
              },
            ],
          },
        ],
        AccountingCustomerParty: [
          {
            Party: [
              {
                PartyIdentification: [
                  {
                    ID: [
                      {
                        _: invoice.buyerTIN || 'EI00000000010',
                        schemeID: 'TIN',
                      },
                    ],
                  },
                  ...(invoice.buyerBRN
                    ? [{ ID: [{ _: invoice.buyerBRN, schemeID: 'BRN' }] }]
                    : []),
                ],
                PartyLegalEntity: [
                  {
                    RegistrationName: [
                      { _: invoice.party || 'General Public' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        TaxTotal: [
          {
            TaxAmount: [{ _: taxTotalAmount, currencyID: currency }],
          },
        ],
        LegalMonetaryTotal: [
          {
            LineExtensionAmount: [
              { _: lineExtensionAmount, currencyID: currency },
            ],
            TaxExclusiveAmount: [
              { _: lineExtensionAmount, currencyID: currency },
            ],
            TaxInclusiveAmount: [{ _: payableAmount, currencyID: currency }],
            PayableAmount: [{ _: payableAmount, currencyID: currency }],
          },
        ],
        InvoiceLine: items.map((item, idx) => ({
          ID: [{ _: String(idx + 1) }],
          InvoicedQuantity: [
            { _: Number(item.quantity ?? 1), unitCode: 'C62' },
          ],
          LineExtensionAmount: [
            { _: Number(item.amount ?? 0), currencyID: currency },
          ],
          Item: [
            {
              CommodityClassification: [
                {
                  ItemClassificationCode: [
                    {
                      _: item.classificationCode || '022',
                      listID: 'CLASS',
                    },
                  ],
                },
              ],
              Description: [{ _: item.description || item.item || 'Item' }],
            },
          ],
          Price: [
            {
              PriceAmount: [
                { _: Number(item.rate ?? 0), currencyID: currency },
              ],
            },
          ],
        })),
      },
    ],
  };
}

export async function submitToMyInvois(
  ublDocument: Record<string, unknown>,
  codeNumber: string,
  settings: EInvoiceSettingsConfig
): Promise<MyInvoisSubmissionResult> {
  const errors = validateEInvoiceConfig(settings);
  if (errors.length) {
    throw new Error(errors.join(' '));
  }
  if (!settings.clientId || !settings.clientSecret) {
    throw new Error(
      'MyInvois Client ID and Client Secret are required for API submission.'
    );
  }

  const baseUrl = getMyInvoisBaseUrl(settings.environment);
  const tokenRes = await fetch(`${baseUrl}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: settings.clientId,
      client_secret: settings.clientSecret,
      grant_type: 'client_credentials',
      scope: 'InvoicingAPI',
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`MyInvois auth failed (${tokenRes.status})`);
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    throw new Error('MyInvois auth response did not include access_token');
  }

  const docJson = JSON.stringify(ublDocument);
  const docBase64 = Buffer.from(docJson, 'utf-8').toString('base64');

  const submitRes = await fetch(`${baseUrl}/api/v1.0/documentsubmissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      documents: [
        {
          format: 'JSON',
          document: docBase64,
          codeNumber,
        },
      ],
    }),
  });

  if (!submitRes.ok) {
    throw new Error(`MyInvois submission failed (${submitRes.status})`);
  }

  const submitData = (await submitRes.json()) as {
    submissionUid?: string;
    acceptedDocuments?: { uuid?: string; longId?: string }[];
  };
  const accepted = submitData.acceptedDocuments?.[0];
  const uuid = accepted?.uuid;
  const longId = accepted?.longId;

  return {
    submissionUid: submitData.submissionUid ?? '',
    uuid,
    longId,
    validationUrl:
      uuid && longId ? `${baseUrl}/${uuid}/share/${longId}` : undefined,
  };
}
