export interface LoanInput {
  id: string;
  name: string;
  remainingBalance: number;
  monthlyPayment: number;
  interestRate: number; // APR as percentage
}

export interface LoanResult {
  id: string;
  name: string;
  remainingBalance: number;
  monthlyPayment: number;
  originalPayoffMonths: number;
  originalTotalInterest: number;
  snowballPayoffMonths: number;
  snowballTotalInterest: number;
  monthsSaved: number;
  interestSaved: number;
}

export interface SnowballResult {
  loanResults: LoanResult[];
  originalTotalMonths: number;
  snowballTotalMonths: number;
  totalMonthsSaved: number;
  originalTotalInterest: number;
  snowballTotalInterest: number;
  totalInterestSaved: number;
}

const MAX_MONTHS = 600; // 50 year safety cap

/**
 * Calculate months to pay off a single loan with given monthly payment,
 * accounting for interest. Returns { months, totalInterest }.
 */
function calculateSingleLoanPayoff(
  balance: number,
  monthlyPayment: number,
  annualRate: number
): { months: number; totalInterest: number } {
  if (balance <= 0) return { months: 0, totalInterest: 0 };

  const monthlyRate = annualRate / 100 / 12;
  let remaining = balance;
  let months = 0;
  let totalInterest = 0;

  while (remaining > 0.01 && months < MAX_MONTHS) {
    const interest = remaining * monthlyRate;
    totalInterest += interest;
    remaining += interest;

    const payment = Math.min(monthlyPayment, remaining);
    remaining -= payment;
    months++;

    // If payment doesn't cover interest, loan will never be paid off
    if (monthlyPayment <= interest && remaining > balance) {
      return { months: MAX_MONTHS, totalInterest: Infinity };
    }
  }

  return { months, totalInterest };
}

/**
 * Run the debt snowball simulation.
 *
 * Loans are sorted by remaining balance (smallest first).
 * Each month:
 *   1. Accrue interest on all active loans
 *   2. Apply minimum payments to all active loans
 *   3. Apply extra payment + freed-up payments to the smallest active loan
 *   4. When a loan is paid off, its min payment joins the snowball
 */
export function calculateSnowball(
  loans: LoanInput[],
  extraMonthlyPayment: number
): SnowballResult {
  if (loans.length === 0) {
    return {
      loanResults: [],
      originalTotalMonths: 0,
      snowballTotalMonths: 0,
      totalMonthsSaved: 0,
      originalTotalInterest: 0,
      snowballTotalInterest: 0,
      totalInterestSaved: 0,
    };
  }

  // Calculate original (no-extra-payment) payoff for each loan independently
  const originalResults = loans.map((loan) => {
    const result = calculateSingleLoanPayoff(
      loan.remainingBalance,
      loan.monthlyPayment,
      loan.interestRate
    );
    return { ...loan, ...result };
  });

  // Sort by remaining balance ascending for snowball
  const sorted = [...loans].sort((a, b) => a.remainingBalance - b.remainingBalance);

  // Simulation state
  const balances = new Map<string, number>();
  const interestPaid = new Map<string, number>();
  const payoffMonth = new Map<string, number>();

  for (const loan of sorted) {
    balances.set(loan.id, loan.remainingBalance);
    interestPaid.set(loan.id, 0);
  }

  let snowballExtra = extraMonthlyPayment; // grows as loans are paid off
  let month = 0;

  while (month < MAX_MONTHS) {
    // Check if all loans are paid off
    const activeLoans = sorted.filter(
      (l) => (balances.get(l.id) ?? 0) > 0.01
    );
    if (activeLoans.length === 0) break;

    month++;

    // 1. Accrue interest on all active loans
    for (const loan of activeLoans) {
      const bal = balances.get(loan.id)!;
      const interest = bal * (loan.interestRate / 100 / 12);
      interestPaid.set(loan.id, interestPaid.get(loan.id)! + interest);
      balances.set(loan.id, bal + interest);
    }

    // 2. Apply minimum payments to all active loans
    let extraAvailable = snowballExtra;
    for (const loan of activeLoans) {
      const bal = balances.get(loan.id)!;
      const payment = Math.min(loan.monthlyPayment, bal);
      balances.set(loan.id, bal - payment);

      // If overpaid (payment > balance), add surplus to extra
      if (loan.monthlyPayment > bal) {
        extraAvailable += loan.monthlyPayment - bal;
      }
    }

    // 3. Apply extra + snowball to the smallest active balance
    for (const loan of activeLoans) {
      if (extraAvailable <= 0) break;
      const bal = balances.get(loan.id)!;
      if (bal <= 0.01) continue;

      const extraPayment = Math.min(extraAvailable, bal);
      balances.set(loan.id, bal - extraPayment);
      extraAvailable -= extraPayment;
    }

    // 4. Check for newly paid off loans
    for (const loan of activeLoans) {
      if ((balances.get(loan.id) ?? 0) <= 0.01 && !payoffMonth.has(loan.id)) {
        payoffMonth.set(loan.id, month);
        balances.set(loan.id, 0);
        // This loan's min payment now joins the snowball
        snowballExtra += loan.monthlyPayment;
      }
    }
  }

  // Build results
  const loanResults: LoanResult[] = loans.map((loan) => {
    const orig = originalResults.find((r) => r.id === loan.id)!;
    const snowballMonths = payoffMonth.get(loan.id) ?? MAX_MONTHS;
    const snowballInterest = interestPaid.get(loan.id) ?? 0;

    return {
      id: loan.id,
      name: loan.name,
      remainingBalance: loan.remainingBalance,
      monthlyPayment: loan.monthlyPayment,
      originalPayoffMonths: orig.months,
      originalTotalInterest: orig.totalInterest,
      snowballPayoffMonths: snowballMonths,
      snowballTotalInterest: snowballInterest,
      monthsSaved: orig.months - snowballMonths,
      interestSaved: orig.totalInterest - snowballInterest,
    };
  });

  const originalTotalMonths = Math.max(...originalResults.map((r) => r.months));
  const snowballTotalMonths = Math.max(
    ...loans.map((l) => payoffMonth.get(l.id) ?? MAX_MONTHS)
  );

  const originalTotalInterest = originalResults.reduce(
    (sum, r) => sum + r.totalInterest,
    0
  );
  const snowballTotalInterest = loans.reduce(
    (sum, l) => sum + (interestPaid.get(l.id) ?? 0),
    0
  );

  return {
    loanResults,
    originalTotalMonths,
    snowballTotalMonths,
    totalMonthsSaved: originalTotalMonths - snowballTotalMonths,
    originalTotalInterest,
    snowballTotalInterest,
    totalInterestSaved: originalTotalInterest - snowballTotalInterest,
  };
}
