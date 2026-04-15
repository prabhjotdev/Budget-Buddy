import { Provider } from 'react-redux';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { store } from './app/store';
import { AppRouter } from './app/router';
import { ThemeProvider } from './context/ThemeContext';
import './styles/globals.css';

function App() {
  // Register service worker with autoUpdate — new deployments activate
  // immediately (skipWaiting + clientsClaim) and the page auto-reloads
  // via the controllerchange event. No user interaction needed.
  useRegisterSW({
    onRegistered(registration) {
      if (registration) {
        setInterval(() => registration.update(), 60 * 60 * 1000);
      }
    },
  });

  return (
    <Provider store={store}>
      <ThemeProvider>
        <AppRouter />
      </ThemeProvider>
    </Provider>
  );
}

export default App;
