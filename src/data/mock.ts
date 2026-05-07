import type { Capability, Task } from '../types';

export const capabilities: Capability[] = [
  { id: 'web-reading', label: 'Web Reading', icon: 'glasses-outline' },
  { id: 'research', label: 'In-depth Research Analysis', icon: 'flask-outline' },
  { id: 'data', label: 'Data Mining', icon: 'bar-chart-outline' },
  { id: 'content', label: 'Inspired Content Creation', icon: 'create-outline' },
];

export const tasks: Task[] = [
  {
    id: 'task-001',
    title: 'E-commerce Price Comparison Tool',
    workspace: 'Code',
    category: 'Cloud',
    status: 'in-progress',
    updatedAt: 'Yesterday 19:23',
    duration: '35m 0s',
    prompt:
      'Design and implement an automated script tool for collecting and comparing e-commerce product prices. The tool should be able to batch-crawl key information for specified products from major platforms.',
    summary: [
      'A runnable CLI tool and demo app with mock product search results.',
      'End-to-end flow for search, collection, comparison, and summary generation.',
      'Prepared service boundaries for scraper jobs, normalization, and reporting APIs.',
    ],
  },
  {
    id: 'task-002',
    title: 'Market Trends Snapshot',
    workspace: 'MTC',
    category: 'Cloud',
    status: 'draft',
    updatedAt: 'Today 09:10',
    duration: '12m 18s',
    prompt: 'Summarize recent sentiment, pricing shifts, and demand signals for electric scooters.',
    summary: [
      'Generated a starter brief structure.',
      'Queued external sources for validation in Phase 2.',
    ],
  },
];

export const profile = {
  name: 'Faiez Waseem',
  email: 'faiezwaseem7@gmail.com',
  plan: 'Free',
  avatar:
    'https://images.unsplash.com/photo-1546182990-dffeafbe841d?auto=format&fit=crop&w=240&q=80',
};
