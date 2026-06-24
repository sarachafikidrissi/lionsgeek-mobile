import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import API from '@/api';

let notificationHandlerConfigured = false;

function ensureNotificationHandler() {
  if (notificationHandlerConfigured) return;
  notificationHandlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Request notification permissions and get Expo push token
 * This should only be called on a physical device
 */
export async function registerForPushNotificationsAsync() {
  ensureNotificationHandler();
  let token = null;

  if (!Device.isDevice) {
    console.warn('Push notifications only work on physical devices, not simulators');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification! Permission denied.');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '0d0c0c8d-a116-439d-8892-5965ec3f1841',
    });

    token = tokenData.data;
    console.log('✅ Expo push token obtained:', token.substring(0, 20) + '...');
    console.log('📱 Full token (for debugging):', token);

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
      await Notifications.setNotificationChannelAsync('incoming-calls', {
        name: 'Incoming voice calls',
        description: 'Persistent ringing notifications for incoming calls.',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 1000, 500, 1000, 500, 1000],
        lightColor: '#22c55e',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
        sound: 'default',
        enableVibrate: true,
        showBadge: false,
      });
    }

    return token;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}

/**
 * Send Expo push token to backend
 */
export async function sendPushTokenToBackend(token, authToken) {
  if (!token || !authToken) {
    console.warn('Cannot send push token: missing token or auth token');
    return false;
  }

  try {
    console.log('📤 Sending push token to backend...');
    const response = await API.post('mobile/push-token', {
      expo_push_token: token,
    }, authToken);

    console.log('📥 Backend response:', JSON.stringify(response?.data, null, 2));

    if (response?.data?.success) {
      console.log('✅ Push token sent to backend successfully');
      return true;
    } else {
      console.warn('⚠️ Backend did not confirm push token save:', response?.data);
      return false;
    }
  } catch (error) {
    console.error('❌ Error sending push token to backend:', error);
    console.error('Error details:', error?.response?.data || error?.message);
    return false;
  }
}

/**
 * Setup notification listeners
 */
export function setupNotificationListeners(navigation) {
  ensureNotificationHandler();
  const notificationListener = Notifications.addNotificationReceivedListener(notification => {
    console.log('Notification received (foreground):', notification);
  });

  const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
    console.log('Notification tapped:', response);
    const data = response.notification.request.content.data;
    
    if (data && navigation) {
      handleNotificationNavigation(data, navigation);
    }
  });

  return {
    notificationListener,
    responseListener,
  };
}

/**
 * Handle navigation based on notification data
 */
function handleNotificationNavigation(data) {
  if (!data) return;

  try {
    import('expo-router').then(({ router }) => {
      const { type, link, post_id, project_id, sender_id, follower_id, conversation_id } = data;

      switch (type) {
        case 'post_interaction':
          if (post_id) {
            router.push('/(tabs)');
          }
          break;
        
        case 'follow':
          if (follower_id) {
            router.push(`/(tabs)/profile`);
          }
          break;
        
        case 'project_status':
        case 'project_submission':
          if (project_id) {
            router.push('/(tabs)/reservations');
          }
          break;
        
        case 'task_assignment':
          router.push('/(tabs)/reservations');
          break;
        
        case 'project_message':
          if (project_id) {
            router.push('/(tabs)/reservations');
          }
          break;
        
        case 'chat_message':
          if (conversation_id) {
            router.push('/(tabs)/chat');
          }
          break;
        
        case 'reservation':
          router.push('/(tabs)/reservations');
          break;
        
        case 'appointment':
          router.push('/(tabs)/reservations');
          break;
        
        case 'access_request_response':
          router.push('/(tabs)/reservations');
          break;
        
        case 'exercise_review':
          router.push('/(tabs)/reservations');
          break;
        
        case 'discipline_change':
          router.push('/(tabs)/profile');
          break;
        
        default:
          if (link) {
            console.log('Notification link:', link);
          }
          router.push('/(tabs)');
          break;
      }
    });
  } catch (error) {
    console.error('Error handling notification navigation:', error);
  }
}

/**
 * Remove notification listeners
 */
export function removeNotificationListeners(listeners) {
  if (listeners?.notificationListener) {
    listeners.notificationListener.remove();
  }
  if (listeners?.responseListener) {
    listeners.responseListener.remove();
  }
}
