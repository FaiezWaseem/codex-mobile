import * as FileSystem from 'expo-file-system/legacy';
import * as Notifications from 'expo-notifications';

type LocalToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

type LocalToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

function getSafeBaseDirectory() {
  return FileSystem.documentDirectory || FileSystem.cacheDirectory || 'file:///';
}

function normalizeDirectoryUri(uri?: string) {
  if (!uri?.trim()) {
    return getSafeBaseDirectory();
  }

  return uri.endsWith('/') ? uri : `${uri}/`;
}

async function listDirectory(args: { uri?: string }) {
  const targetUri = normalizeDirectoryUri(args.uri);
  const entries = await FileSystem.readDirectoryAsync(targetUri);

  return JSON.stringify({
    uri: targetUri,
    entries,
  });
}

async function readTextFile(args: { uri: string }) {
  const fileInfo = await FileSystem.getInfoAsync(args.uri);

  if (!fileInfo.exists) {
    throw new Error(`File does not exist: ${args.uri}`);
  }

  const content = await FileSystem.readAsStringAsync(args.uri);
  return JSON.stringify({
    uri: args.uri,
    content,
  });
}

async function writeTextFile(args: { uri: string; content: string; overwrite?: boolean }) {
  const fileInfo = await FileSystem.getInfoAsync(args.uri);

  if (fileInfo.exists && args.overwrite === false) {
    throw new Error(`File already exists and overwrite was false: ${args.uri}`);
  }

  const directoryUri = args.uri.slice(0, args.uri.lastIndexOf('/') + 1);

  if (directoryUri) {
    await FileSystem.makeDirectoryAsync(directoryUri, { intermediates: true });
  }

  await FileSystem.writeAsStringAsync(args.uri, args.content);
  return JSON.stringify({
    uri: args.uri,
    success: true,
  });
}

async function listScheduledNotifications() {
  const permission = await Notifications.requestPermissionsAsync();

  if (!permission.granted) {
    throw new Error('Notifications permission was denied.');
  }

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();

  return JSON.stringify({
    count: scheduled.length,
    notifications: scheduled.map((notification) => ({
      identifier: notification.identifier,
      title: notification.content.title,
      body: notification.content.body,
      data: notification.content.data,
      trigger: notification.trigger,
    })),
  });
}

async function scheduleLocalNotification(args: {
  title: string;
  body: string;
  secondsFromNow?: number;
  data?: Record<string, unknown>;
}) {
  const permission = await Notifications.requestPermissionsAsync();

  if (!permission.granted) {
    throw new Error('Notifications permission was denied.');
  }

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: args.title,
      body: args.body,
      data: args.data,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, Math.floor(args.secondsFromNow ?? 1)),
    },
  });

  return JSON.stringify({
    identifier,
    title: args.title,
    body: args.body,
    secondsFromNow: Math.max(1, Math.floor(args.secondsFromNow ?? 1)),
  });
}

async function cancelScheduledNotification(args: { identifier: string }) {
  const permission = await Notifications.requestPermissionsAsync();

  if (!permission.granted) {
    throw new Error('Notifications permission was denied.');
  }

  await Notifications.cancelScheduledNotificationAsync(args.identifier);
  return JSON.stringify({
    identifier: args.identifier,
    canceled: true,
  });
}

async function getNotificationPermissions() {
  const permission = await Notifications.getPermissionsAsync();

  return JSON.stringify({
    granted: permission.granted,
    canAskAgain: permission.canAskAgain,
    status: permission.status,
    ios: permission.ios ?? null,
    android: permission.android ?? null,
  });
}

async function requestNotificationPermissions() {
  const permission = await Notifications.requestPermissionsAsync();

  return JSON.stringify({
    granted: permission.granted,
    canAskAgain: permission.canAskAgain,
    status: permission.status,
    ios: permission.ios ?? null,
    android: permission.android ?? null,
  });
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const LOCAL_TOOL_DEFINITIONS: LocalToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'filesystem_list_directory',
      description: 'List files and folders inside a local device directory.',
      parameters: {
        type: 'object',
        properties: {
          uri: {
            type: 'string',
            description: 'Directory URI. Defaults to the app document directory.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'filesystem_read_text_file',
      description: 'Read a UTF-8 text file from local device storage.',
      parameters: {
        type: 'object',
        properties: {
          uri: {
            type: 'string',
            description: 'Absolute file URI to read.',
          },
        },
        required: ['uri'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'filesystem_write_text_file',
      description: 'Write UTF-8 text to a local device file.',
      parameters: {
        type: 'object',
        properties: {
          uri: {
            type: 'string',
            description: 'Absolute file URI to write.',
          },
          content: {
            type: 'string',
            description: 'Text content to write.',
          },
          overwrite: {
            type: 'boolean',
            description: 'Whether an existing file may be overwritten. Defaults to true.',
          },
        },
        required: ['uri', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'notifications_get_permissions',
      description: 'Read the local device notification permission status.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'notifications_request_permissions',
      description: 'Request local device notification permissions from the user.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'notifications_list_scheduled',
      description: 'List pending scheduled local notifications on the device.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'notifications_schedule_local',
      description: 'Schedule a local device notification to fire after a number of seconds.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Title of the local notification.',
          },
          body: {
            type: 'string',
            description: 'Body text of the local notification.',
          },
          secondsFromNow: {
            type: 'number',
            description: 'How many seconds from now the notification should fire. Defaults to 1.',
          },
          data: {
            type: 'object',
            description: 'Optional JSON payload to attach to the notification.',
          },
        },
        required: ['title', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'notifications_cancel_scheduled',
      description: 'Cancel a scheduled local notification by identifier.',
      parameters: {
        type: 'object',
        properties: {
          identifier: {
            type: 'string',
            description: 'Notification identifier returned when it was scheduled.',
          },
        },
        required: ['identifier'],
      },
    },
  },
];

export function shouldAttemptLocalTools(input: string) {
  return /(file|folder|directory|filesystem|notification|notify|remind|reminder|schedule alert)/i.test(input);
}

export async function executeLocalToolCall(toolCall: LocalToolCall) {
  const parsedArguments = toolCall.function.arguments
    ? (JSON.parse(toolCall.function.arguments) as Record<string, unknown>)
    : {};

  switch (toolCall.function.name) {
    case 'filesystem_list_directory':
      return listDirectory(parsedArguments as { uri?: string });
    case 'filesystem_read_text_file':
      return readTextFile(parsedArguments as { uri: string });
    case 'filesystem_write_text_file':
      return writeTextFile(parsedArguments as {
        uri: string;
        content: string;
        overwrite?: boolean;
      });
    case 'notifications_get_permissions':
      return getNotificationPermissions();
    case 'notifications_request_permissions':
      return requestNotificationPermissions();
    case 'notifications_list_scheduled':
      return listScheduledNotifications();
    case 'notifications_schedule_local':
      return scheduleLocalNotification(parsedArguments as {
        title: string;
        body: string;
        secondsFromNow?: number;
        data?: Record<string, unknown>;
      });
    case 'notifications_cancel_scheduled':
      return cancelScheduledNotification(parsedArguments as { identifier: string });
    default:
      throw new Error(`Unsupported local tool: ${toolCall.function.name}`);
  }
}
