import { Timestamp } from 'firebase/firestore';

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount?: number;
  currentBalance: number;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SavingsGoalTransaction {
  id: string;
  goalId: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  description: string;
  cycleId: string | null;
  createdAt: Timestamp;
}

export interface SavingsGoalsState {
  goals: {
    byId: { [id: string]: SavingsGoal };
    allIds: string[];
  };
  transactions: {
    byId: { [id: string]: SavingsGoalTransaction };
    allIds: string[];
  };
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}
