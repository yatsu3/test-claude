import React from 'react';
import { render, screen } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import RootLayout from './_layout';

const mockPush = jest.fn();
const mockRemove = jest.fn();
jest.mock('expo-notifications', () => ({
  addNotificationResponseReceivedListener: jest.fn(),
}));
jest.mock('expo-sqlite', () => ({ openDatabaseSync: jest.fn(() => ({})) }));
jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({
  useMigrations: jest.fn(() => ({ success: true, error: undefined })),
}));
jest.mock('expo-router', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const Passthrough = ({ children }: any) => children ?? ReactActual.createElement(View);
  const Stack = Object.assign(() => ReactActual.createElement(View), { Screen: () => null });
  return { Stack, Tabs: Passthrough, useRouter: () => ({ push: mockPush }) };
});

describe('RootLayout', () => {
  beforeEach(() => {
    (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValue({
      remove: mockRemove,
    });
  });
  afterEach(() => jest.clearAllMocks());

  it('renders without crashing once migrations succeed', async () => {
    await render(<RootLayout />);
    expect(screen.root).toBeTruthy();
  });

  it('navigates to the record tab when a notification is tapped and unsubscribes on unmount', async () => {
    const { unmount } = await render(<RootLayout />);
    const listener = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock
      .calls[0][0];
    listener({});
    expect(mockPush).toHaveBeenCalledWith('/');
    await unmount();
    expect(mockRemove).toHaveBeenCalled();
  });
});
