import { Timestamp } from 'firebase/firestore';

export interface EmergencyFund {
  id: string;
  currentBalance: number;
  goalAmount?: number; // Optional goal amount
  goalType?: 'fixed' | 'months'; // Fixed amount or X months of expenses
  goalMonths?: number; // If goalType is 'months', how many months
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface EmergencyFundTransaction {
  id: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  description: string;
  date: Timestamp;
  createdAt: Timestamp;
}

export interface EmergencyFundState {
  fund: EmergencyFund | null;
  transactions: {
    byId: { [id: string]: EmergencyFundTransaction };
    allIds: string[];
  };
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}
