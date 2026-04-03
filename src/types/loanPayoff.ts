import { Timestamp } from 'firebase/firestore';

export interface Loan {
  id: string;
  name: string;
  description?: string;
  initialAmount: number;
  remainingBalance: number;
  monthlyPayment: number;
  interestRate: number; // Annual APR as percentage (e.g. 5.5 = 5.5%)
  payoffDate?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface LoanPayoffState {
  loans: {
    byId: { [id: string]: Loan };
    allIds: string[];
  };
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}
