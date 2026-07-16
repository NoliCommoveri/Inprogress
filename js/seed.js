// seed.js — first-run defaults.
// On first run (no stm:v1 key yet), seed a few fundraiserPlatforms and leave
// opponents empty (§7). All storage access routes through data.js.

import { isFirstRun, loadData, addFundraiserPlatform } from './data.js';

export function seedIfNeeded() {
  if (!isFirstRun()) return false;
  loadData();
  addFundraiserPlatform({ name: 'DoubleGood' });
  addFundraiserPlatform({ name: 'GoFundMe' });
  addFundraiserPlatform({ name: 'Snap! Raise' });
  return true;
}
