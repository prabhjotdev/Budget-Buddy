import { Provider } from 'react-redux';
import { store } from './app/store';
import { AppRouter } from './app/router';
import './styles/globals.css';

function App() {
  return (
    <Provider store={store}>
      <AppRouter />
    </Provider>
  );
}

export default App;
