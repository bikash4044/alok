import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import './App.css';

function App() {
  const [mainImage, setMainImage] = useState(null);
  const [timeSeries, setTimeSeries] = useState([]);
  const [loading, setLoading] = useState(true);

  const API_BASE = "https://private00.pythonanywhere.com";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const imageRes = await axios.get(`${API_BASE}/fetch_main`);
        setMainImage(imageRes.data);

        const dataRes = await axios.get(`${API_BASE}/fetch_timeseries`);
        setTimeSeries(dataRes.data.data);
        
        setLoading(false);
      } catch (err) {
        console.error("Error fetching data:", err);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="loader">Loading WeedWeb Dashboard...</div>;

  return (
    <div className="App">
      <header>
        <h1>WeedWeb Analytics</h1>
      </header>

      <div className="dashboard-container">
        {/* Left Side: Latest Image */}
        <div className="panel image-panel">
          <h2>Latest Capture</h2>
          {mainImage?.image_url ? (
            <div className="image-wrapper">
              <img src={mainImage.image_url} alt="Main Scan" />
              <p className="caption">{mainImage.filename}</p>
            </div>
          ) : (
            <p>No PNG images found in uploads.</p>
          )}
        </div>

        {/* Right Side: Line Plot */}
        <div className="panel chart-panel">
          <h2>Time-Series</h2>
          <div style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeries} margin={{ top: 10, right: 30, left: 50, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  label={{ value: "Date", position: "insideBottom", offset: -5 }}
                  tick={{ fontSize: 10 }} 
                  interval="preserveStartEnd"
                />
                <YAxis 
                  label={{ value: "Values", angle: -90, position: "insideLeft", style: { textAnchor: 'middle' } }}
                />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#82ca9d" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 8 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
