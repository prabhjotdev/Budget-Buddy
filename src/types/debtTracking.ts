import { Timestamp } from 'firebase/firestore';

export interface DebtEntry {
  id: string;
  direction: 'i-owe' | 'they-owe';
  personName: string;
  item: string;
  description?: string;
  amount: number;
  date: Timestamp;
  isPaid: boolean;
  paidDate?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DebtTrackingState {
  entries: {
    byId: { [id: string]: DebtEntry };
    allIds: string[];
  };
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}
