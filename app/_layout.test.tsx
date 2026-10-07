import React from 'react';
import { render, screen } from '@testing-library/react-native';
import RootLayout from './_layout';

jest.mock('expo-sqlite', () => ({ openDatabaseSync: jest.fn(() => ({})) }));
jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({
  useMigrations: jest.fn(() => ({ success: true, error: undefined })),
}));
jest.mock('expo-router', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const Passthrough = ({ children }: any) => children ?? ReactActual.createElement(View);
  return { Stack: Passthrough, Tabs: Passthrough };
});

describe('RootLayout', () => {
  it('renders without crashing once migrations succeed', async () => {
    await render(<RootLayout />);
    expect(screen.root).toBeTruthy();
  });
});
