import React from 'react';
import { Search, SlidersHorizontal, ChevronDown } from 'lucide-react';

const FilterSelect = ({ label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 12px', background: '#12161F', borderRadius: '6px', border: '1px solid #1A202C', cursor: 'pointer' }}>
    <span style={{ color: '#64748B', fontSize: '0.8rem' }}>{label}</span>
    <span style={{ color: '#fff', fontSize: '0.8rem', fontWeight: '500' }}>{value}</span>
    <ChevronDown size={14} color="#64748B" />
  </div>
);

const FiltersBar = () => {
  return (
    <div style={{
      height: '60px',
      borderBottom: '1px solid #1A202C',
      display: 'flex',
      alignItems: 'center',
      padding: '0 30px',
      gap: '20px',
      background: '#080B10'
    }}>
      <FilterSelect label="Timeframe" value="1D" />
      <FilterSelect label="Exchange" value="All" />
      <FilterSelect label="Market Cap" value="All" />
      <FilterSelect label="Volume (24h)" value="> 100K" />
      <FilterSelect label="Trend" value="All" />
      <FilterSelect label="AI Confidence" value="> 60%" />

      <div style={{ flex: 1 }}></div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#12161F', padding: '6px 12px', borderRadius: '6px', border: '1px solid #1A202C', width: '250px' }}>
        <Search size={14} color="#64748B" />
        <input 
          type="text" 
          placeholder="Search coin..." 
          style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.8rem', width: '100%', outline: 'none' }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 16px', background: '#1A202C', borderRadius: '6px', cursor: 'pointer' }}>
        <SlidersHorizontal size={14} color="#fff" />
        <span style={{ color: '#fff', fontSize: '0.8rem', fontWeight: '500' }}>Filters</span>
      </div>
    </div>
  );
};

export default FiltersBar;
