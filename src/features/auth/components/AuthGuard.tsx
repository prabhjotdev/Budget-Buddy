import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../../app/hooks';
import { setUser } from '../authSlice';
import { subscribeToAuthChanges } from '../../../services/firebase/auth';
import { FullPageSpinner } from '../../../components/shared';
import { ROUTES } from '../../../constants';

interface AuthGuardProps {
  children: ReactNode;
}

export const AuthGuard = ({ children }: AuthGuardProps) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, isInitialized } = useAppSelector((state) => state.auth);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((user) => {
      dispatch(setUser(user));
    });

    return () => unsubscribe();
  }, [dispatch]);

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      navigate(ROUTES.LOGIN);
    }
  }, [isInitialized, isAuthenticated, navigate]);

  if (!isInitialized) {
    return <FullPageSpinner />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
};
