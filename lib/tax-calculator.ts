/**
 * Helper utility for Driver Earnings and Tax Calculation.
 * 
 * Formula:
 * 1. 13.5% Tax is deducted from Total Earnings.
 * 2. Remaining Amount = Total Earnings - Tax Amount
 * 3. 45% of Remaining Amount = Driver Share (Displayed as "Your Share after Tax Payment" on Driver screen)
 * 4. 55% of Remaining Amount = Company Share
 */

export interface EarningsBreakdown {
  totalEarnings: number;
  taxRate: number; // 13.5%
  taxAmount: number;
  remainingAmount: number;
  driverShareRate: number; // 45%
  driverShare: number;
  companyShareRate: number; // 55%
  companyShare: number;
}

export function calculateEarningsBreakdown(totalEarnings: number): EarningsBreakdown {
  const safeEarnings = Math.max(0, Number(totalEarnings) || 0);

  const taxRate = 13.5;
  const taxAmount = Math.round((safeEarnings * 0.135) * 100) / 100;
  
  const remainingAmount = Math.round((safeEarnings - taxAmount) * 100) / 100;

  const driverShareRate = 45;
  const driverShare = Math.round((remainingAmount * 0.45) * 100) / 100;

  const companyShareRate = 55;
  const companyShare = Math.round((remainingAmount * 0.55) * 100) / 100;

  return {
    totalEarnings: safeEarnings,
    taxRate,
    taxAmount,
    remainingAmount,
    driverShareRate,
    driverShare,
    companyShareRate,
    companyShare,
  };
}
