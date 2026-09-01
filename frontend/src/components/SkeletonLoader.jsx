import React from 'react';
import './SkeletonLoader.css';

const SkeletonLoader = ({
  type = 'text',
  width = '100%',
  height = '1rem',
  count = 1,
  className = ''
}) => {
  return (
    <div className={`skeleton-loader ${className}`} style={{ width, height }}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={`skeleton-${type}`}>
          
        </div>
      ))}
    </div>
  );
};

export default SkeletonLoader;