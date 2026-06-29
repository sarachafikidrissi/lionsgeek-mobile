import { Alert, Platform, Pressable, Text, View } from 'react-native'
import { useAppContext } from '@/context';
import * as Device from 'expo-device';
// import * as Notifications from 'expo-notifications';
// import { useEffect } from 'react';
// // import * as Notifications from 'expo-notifications';
// import * as Device from 'expo-device';
// import { Platform } from 'react-native';
import axios from 'axios';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';






const Test = () => {
    const [expoToken, setExpoToken] = useState(null);

    const registerForPushNotificationsAsync = async () => {
        if (!Device.isDevice) {
            console.log('Must use a physical device');
            return;
        }

        const { status: existingStatus } =
            await Notifications.getPermissionsAsync();

        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Permission not granted');
            return;
        }

        const token = (
            await Notifications.getExpoPushTokenAsync({
                projectId: '0d0c0c8d-a116-439d-8892-5965ec3f1841',
            })
        ).data;

        // console.log('Expo Push Token:', token);

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
            });
        }

        return token;
    }


    useEffect(() => {
        registerForPushNotificationsAsync().then(token => {

            setExpoToken(token);
            console.log(expoToken);

        });
        console.log(expoToken);
    }, []);

    const { user } = useAppContext();
    const updateToken = async () => {
        // i want this function run a function to trigger the route /change-token , viza axios , and send to the user id m qnd displqy qlert not console log in the try cqtch
        try {
            const response = await axios.put('https://mylionsgeek.ma/api/change-token', {
                user_id: user.id,
                token: expoToken,
            });
            Alert.alert
                ('Success', response?.data?.message);
        } catch (error) {
            Alert.alert
                ('Error', error?.response?.data?.message);
        }
    }

    // i want to get my expo notification token and storit in use state , using axios , just get it no 

    // const getExpoToken = async () => {
    //     const token = await Notifications.getExpoPushTokenAsync({
    //         projectId: '0d0c0c8d-a116-439d-8892-5965ec3f1841',
    //     });
    //     setExpoToken(token);

    // }
    // useEffect(() => {
    //     getExpoToken();
    //     console.log(expoToken);
    // }, []);

    return (
        <View className='flex-1 items-center justify-center'>
            <Text className='text-2xl font-bold text-white'>Change Expo Token</Text>
            <Text selectable className='text-sm py-6 font-bold text-white'>{expoToken}</Text>

            <Pressable onPress={() => {
                updateToken();
            }}>
                <Text className='text-2xl font-bold bg-dark text-alpha dark:bg-white dark:text-dark'>Change Token</Text>
            </Pressable>
        </View>
    )
}

export default Test;