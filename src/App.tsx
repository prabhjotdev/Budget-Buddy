import { Provider } from 'react-redux';
import { store } from './app/store';
import { AppRouter } from './app/router';
import { ThemeProvider } from './context/ThemeContext';
import { PWAUpdateToast } from './components/shared';
import './styles/globals.css';

function App() {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <AppRouter />
        <PWAUpdateToast />
      </ThemeProvider>
    </Provider>
  );
}

export default App;
