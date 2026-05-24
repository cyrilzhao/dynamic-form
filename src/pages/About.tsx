import React from 'react';
import { Link } from 'react-router-dom';
import '@/styles/pages/About.scss';

const About = () => {
  return (
    <div className="about-page">
      <h1>关于我们</h1>
      <p>这是一个基于 Vite + React + TypeScript 的项目框架</p>
      <Link to="/">返回首页</Link>
    </div>
  );
};

export default About;
