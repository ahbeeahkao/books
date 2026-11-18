import test from 'tape';
import { Fyo } from 'fyo';
import { POSOpeningShift } from '../models/inventory/Point of Sale/POSOpeningShift';
import { POSClosingShift } from '../models/inventory/Point of Sale/POSClosingShift';
import { ModelNameEnum } from '../models/types';

test('POSOpeningShift.openingCashAmount uses denominations when present', (t) => {
  const fyo = new Fyo();
  const shift = {
    fyo,
    openingCash: [
      { denomination: fyo.pesa(100), count: 2 },
      { denomination: fyo.pesa(50), count: 1 },
    ],
    openingAmounts: [{ paymentMethod: 'Cash', amount: fyo.pesa(999) }],
  };

  const amount = Object.getOwnPropertyDescriptor(
    POSOpeningShift.prototype,
    'openingCashAmount'
  )?.get?.call(shift);

  t.equal(amount.float, 250, 'sums denomination * count');
  t.end();
});

test('POSOpeningShift.openingCashAmount falls back to typed Cash amount when denominations are empty', (t) => {
  const fyo = new Fyo();
  const shift = {
    fyo,
    openingCash: [],
    openingAmounts: [
      { paymentMethod: 'Card', amount: fyo.pesa(100) },
      { paymentMethod: 'Cash', amount: fyo.pesa(350) },
    ],
  };

  const amount = Object.getOwnPropertyDescriptor(
    POSOpeningShift.prototype,
    'openingCashAmount'
  )?.get?.call(shift);

  t.equal(amount.float, 350, 'uses Cash row amount when openingCash is empty');
  t.equal(
    ModelNameEnum.POSOpeningShift,
    'POSOpeningShift',
    'POSOpeningShift model enum is intact'
  );
  t.end();
});

test('POSClosingShift.closingCashAmount falls back to typed Cash closingAmount when denominations are empty', (t) => {
  const fyo = new Fyo();
  const shift = {
    fyo,
    closingCash: [],
    closingAmounts: [
      { paymentMethod: 'Card', closingAmount: fyo.pesa(100) },
      { paymentMethod: 'Cash', closingAmount: fyo.pesa(425) },
    ],
  };

  const amount = Object.getOwnPropertyDescriptor(
    POSClosingShift.prototype,
    'closingCashAmount'
  )?.get?.call(shift);

  t.equal(
    amount.float,
    425,
    'uses Cash row closingAmount when closingCash is empty'
  );
  t.equal(
    ModelNameEnum.POSClosingShift,
    'POSClosingShift',
    'POSClosingShift model enum is intact'
  );
  t.end();
});
