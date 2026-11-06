import { Doc } from 'fyo/model/doc';
import { FormulaMap } from 'fyo/model/types';
import { getUomWholeNumberMapping } from 'src/utils/uom';

export class UOM extends Doc {
  isWhole?: boolean;
  mustBeWholeNumber?: boolean;

  formulas: FormulaMap = {
    mustBeWholeNumber: {
      formula: () => getUomWholeNumberMapping(!!this.isWhole),
      dependsOn: ['isWhole'],
    },
  };
}
