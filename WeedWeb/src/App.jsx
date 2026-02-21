import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import Tab2 from './components/Tab2';
import Tab3 from './components/Tab3';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Data States
  const [mainImage, setMainImage] = useState(null);
  const [timeSeries, setTimeSeries] = useState([]);
  const [weatherData, setWeatherData] = useState(null);
  
  // Loading States
  const [loading, setLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const API_BASE = "https://private00.pythonanywhere.com";

  // --- NOTIFICATION LOGIC ---
  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  const subscribeToNotifications = async () => {
    if (!('serviceWorker' in navigator)) return alert("Browser not supported.");

    try {
      const register = await navigator.serviceWorker.register('/sw.js');
      const response = await axios.get(`${API_BASE}/vapid_public_key`);
      const publicKey = response.data.publicKey;

      if (!publicKey) return alert("Server error: Missing VAPID keys.");

      const subscription = await register.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      await axios.post(`${API_BASE}/subscribe`, subscription);
      setIsSubscribed(true);
      alert("Success! Alerts Enabled.");
    } catch (error) {
      console.error("Subscription failed:", error);
      alert("Failed to enable alerts. Check console for details.");
    }
  };

  const testNotification = async () => {
    try {
      await axios.post(`${API_BASE}/trigger_alert`);
      alert("Test signal sent!");
    } catch (err) {
      alert("Failed. Is Python running?");
    }
  };

  // --- ROBUST DATA FETCHING ---
  useEffect(() => {
    const fetchData = async () => {
      // 1. Timeout Promise (3 seconds)
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout")), 3000)
      );

      try {
        console.log("Attempting to fetch data...");
        
        // 2. Race fetches against timeout
        const [imageRes, dataRes, weatherRes] = await Promise.allSettled([
          Promise.race([axios.get(`${API_BASE}/fetch_main`), timeout]),
          Promise.race([axios.get(`${API_BASE}/fetch_timeseries`), timeout]),
          Promise.race([axios.get(`${API_BASE}/fetch_weather`), timeout])
        ]);

        // 3. Process Data
        if (imageRes.status === 'fulfilled') setMainImage(imageRes.value.data);

        if (dataRes.status === 'fulfilled') {
          const enriched = dataRes.value.data.data.map(item => ({
            ...item,
            metricB: item.value * 0.7 + 5,
            metricC: item.value * 1.2 - 3
          }));
          setTimeSeries(enriched);
        }

        if (weatherRes.status === 'fulfilled') setWeatherData(weatherRes.value.data);

        // 4. Check Subscription Status
        if ('serviceWorker' in navigator) {
           try {
             const reg = await navigator.serviceWorker.ready;
             const sub = await reg.pushManager.getSubscription();
             if (sub) setIsSubscribed(true);
           } catch (e) { /* ignore */ }
        }

      } catch (err) {
        console.error("Critical Error during fetch:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return `${date.getDate()} ${date.toLocaleDateString('en-US', { month: 'short' })}`;
  };

  const renderDashboard = () => (
    <div className="grid-container">
      
      {/* ROW 1: Imagery & Weather (NOW SHORT - SWAPPED) */}
      <div className="card span-2 card-short">
        <h3>Satellite Imagery</h3>
        <div className="image-display-row">
          <div className="img-card">
            {mainImage ? <img src={mainImage.image_url} alt="Main" /> : <div className="loader-box">No Data</div>}
            <div className="label">Captured</div>
          </div>
          <div className="img-card">
            {mainImage ? <img src={mainImage.image_url} alt="Weed" className="filter-weed" /> : <div className="loader-box">No Data</div>}
            <div className="label">Detection</div>
          </div>
          <div className="img-card">
            {mainImage ? <img src={mainImage.image_url} alt="Thermal" className="filter-thermal" /> : <div className="loader-box">No Data</div>}
            <div className="label">Thermal</div>
          </div>
          <div className="img-card">
            {mainImage ? <img src={mainImage.image_url} alt="Thermal" className="filter-thermal" /> : <div className="loader-box">No Data</div>}
            <div className="label">4th image</div>
          </div>
        </div>
      </div>

      <div className="card card-short weather-card">
        <h3>Weather ({weatherData?.location?.name || 'N/A'})</h3>
        <div className="weather-row">
          {weatherData?.forecast?.forecastday ? (
            weatherData.forecast.forecastday.map((day, index) => (
              <div className="w-day" key={index}>
                <div className="w-date">{formatDate(day.date)}</div>
                <div className="w-flex-row">
                  <img src={`https:${day.day.condition.icon}`} alt="icon" className="w-icon" />
                  <div className="w-temp">{Math.round(day.day.maxtemp_c)}°C</div>
                </div>
                {/* Short mode: hide text description, show rain only */}
                <div className="w-rain">💧{day.day.totalprecip_mm}</div>
              </div>
            ))
          ) : (
            <div className="loading-text" style={{color: '#ef4444'}}>Unavailable</div>
          )}
        </div>
      </div>

      {/* ROW 2: Charts (NOW TALL - SWAPPED) */}
      <div className="card card-tall">
        <h3>Canopy Cover (%)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={timeSeries}>
            <Area type="monotone" dataKey="value" stroke="#10b981" fill="#10b98133" />
            <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none'}} />
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} tick={false} />
            <YAxis stroke="#94a3b8" fontSize={10} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="card card-tall">
        <h3>LAI Index</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={timeSeries}>
            <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
            <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none'}} />
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} tick={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card card-tall">
        <h3>Plant Growth Metrics</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={timeSeries}>
            <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none'}} />
            <Line type="monotone" dataKey="value" stroke="#10b981" dot={false} name="Soil" />
            <Line type="monotone" dataKey="metricB" stroke="#f59e0b" dot={false} name="Air" />
            <Line type="monotone" dataKey="metricC" stroke="#3b82f6" dot={false} name="Humidity" />
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ROW 3: Irrigation */}
      <div className="card span-2">
        <div className="irrigation-header">
           <h3>Irrigation Scheduling</h3>
           <div className="btn-group">
             <button onClick={testNotification} className="btn-test">Test Alert</button>
             {!isSubscribed && (
               <button onClick={subscribeToNotifications} className="btn-alert">
                 Enable Alerts 🔔
               </button>
             )}
             {isSubscribed && <span className="sub-badge">Alerts Active ✅</span>}
           </div>
        </div>
        <div className="irrigation-box">
           <div className="irrigation-info">
              <span>Current Soil Moisture: <strong>18%</strong></span>
              <span className="alert-badge">Irrigation Needed!</span>
           </div>
           <div className="irrigation-slider">
              <input type="range" min="0" max="100" value="25" readOnly />
              <span>Threshold: 25%</span>
           </div>
        </div>
      </div>

      <div className="card">
        <h3>Crop Condition</h3>
        <div className="condition-metrics">
          <div className="metric">💧<p>Water Stress</p></div>
          <div className="metric">🌱<p>Irrigated</p></div>
          <div className="metric">✅<p>Healthy</p></div>
        </div>
      </div>

      {/* ROW 4: Yield Prediction */}
      <div className="card span-3">
        <h3>Yield Prediction (Time Series)</h3>
        <div className="large-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} />
              <YAxis stroke="#94a3b8" fontSize={10} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
              <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  if (loading) return (
    <div className="loader">
      <div style={{textAlign:'center'}}>
        <h2>Loading WeedWeb Dashboard...</h2>
        <p style={{fontSize:'0.8rem', color:'#64748b'}}>
          Synchronizing with Python Server...
        </p>
      </div>
    </div>
  );

  return (
    <div className="dashboard-root">
      <nav className="navbar">
        <div className="nav-left">
          <div className="nav-brand">🌿 WeedWeb</div>
          <div className="tab-menu">
            <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
            <button className={activeTab === 'tab2' ? 'active' : ''} onClick={() => setActiveTab('tab2')}>Analysis</button>
            <button className={activeTab === 'tab3' ? 'active' : ''} onClick={() => setActiveTab('tab3')}>Reports</button>
          </div>
        </div>
        <div className="nav-profile">Bikash</div>
      </nav>
      <div className="content-area">
        {activeTab === 'dashboard' ? renderDashboard() : null}
        {activeTab === 'tab2' && <Tab2 />}
        {activeTab === 'tab3' && <Tab3 />}
      </div>
    </div>
  );
}

export default App;
