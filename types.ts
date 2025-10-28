// FIX: Import React to resolve 'React.ReactNode' type.
import React from 'react';

export interface Message {
  id: number;
  text: string | React.ReactNode;
  sender: 'bot' | 'user';
  options?: { text: string; value: any }[];
}

export interface UserInfo {
  name: string;
  phone: string;
  email: string;
  location: string;
}

export interface Job {
  id: number;
  title: string;
  company: string;
  description: string;
}

// FIX: Add Source interface for grounding metadata.
export interface Source {
  uri: string;
  title: string;
}

export interface ResumeData {
  contact: {
    name: string;
    email: string;
    phone: string;
    location: string;
  };
  summary: string;
  experience: string;
  skills: string[];
}
