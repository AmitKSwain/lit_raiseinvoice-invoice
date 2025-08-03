import { useEffect } from 'react';
import './App.css';
import InvoiceForm_copy from './components/InvoiceForm_copy';
import { initializeUrlDisplay } from './utils/urlDisplay';

function App() {
  useEffect(() => {
    // Initialize URL display when component mounts
    initializeUrlDisplay();
    
    // Log the API URL for debugging
    console.log('API URL:', window._env_?.API_URL || '/api');
    console.log('Frontend URL:', window._env_?.FRONTEND_URL || window.location.origin);
  }, []);

  return (
    <div className="App">
      <InvoiceForm_copy />
    </div>
  );
}

export default App;
