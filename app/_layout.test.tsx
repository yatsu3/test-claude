import React from 'react';
import { render, screen } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import RootLayout from './_layout';

const mockPush = jest.fn();
const mockRemove = jest.fn();
const mockScreens: { name: string; options: Record<string, unknown> }[] = [];
jest.mock('expo-notifications', () => ({
  addNotificationResponseReceivedListener: jest.fn(),
}));
jest.mock('../src/notifications/reminder', () => ({
  configureNotificationHandler: jest.fn(),
}));
jest.mock('expo-sqlite', () => ({ openDatabaseSync: jest.fn(() => ({})) }));
jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({
  useMigrations: jest.fn(() => ({ success: true, error: undefined })),
}));
jest.mock('expo-router', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const Passthrough = ({ children }: any) => children ?? ReactActual.createElement(View);
  const Stack = Object.assign(
    ({ children }: any) => ReactActual.createElement(View, null, children),
    {
      Screen: ({ name, options }: any) => {
        mockScreens.push({ name, options });
        return null;
      },
    }
  );
  return { Stack, Tabs: Passthrough, useRouter: () => ({ push: mockPush }) };
});

describe('RootLayout', () => {
  beforeEach(() => {
    (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValue({
      remove: mockRemove,
    });
  });
  afterEach(() => {
    jest.clearAllMocks();
    mockScreens.length = 0;
  });

  it('configures the foreground notification handler at module load', () => {
    // Re-import in an isolated registry so the import-time call is observable regardless of test order.
    let configure: jest.Mock | undefined;
    jest.isolateModules(() => {
      configure = require('../src/notifications/reminder').configureNotificationHandler;
      configure?.mockClear();
      require('./_layout');
    });
    expect(configure).toHaveBeenCalledTimes(1);
  });

  it('shows a header with a Japanese back button on the record edit route', async () => {
    await render(<RootLayout />);
    const editScreen = mockScreens.find((s) => s.name === 'record-edit/[date]');
    expect(editScreen?.options).toEqual(
      expect.objectContaining({ headerShown: true, headerBackTitle: '戻る' })
    );
  });

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
