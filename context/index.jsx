import { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";
import { colorScheme as nwColorScheme } from "nativewind";
import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_STORAGE_KEY = 'app_theme_preference';

const appContext = createContext();

const AppProvider = ({ children }) => {
    const [language, setLanguage] = useState("en");
    const [token, setToken] = useState(null);
    const [user, setUser] = useState(null);
    // Mirror NativeWind's reactive colorScheme into local state so consumers re-render on toggle
    const systemScheme = useColorScheme();
    const [colorScheme, setColorSchemeState] = useState(systemScheme ?? 'light');

    useEffect(() => {
        (async () => {
            // Restore auth session
            const t = await AsyncStorage.getItem('auth_token');
            const u = await AsyncStorage.getItem('auth_user');
            if (t && t !== 'false' && t !== 'null' && t.trim() !== '') {
                setToken(t);
                console.log('[CONTEXT] Token loaded from storage');
            }
            if (u) {
                try {
                    const parsedUser = JSON.parse(u);
                    setUser(parsedUser);
                    console.log('[CONTEXT] User data loaded from storage');
                } catch (e) {
                    console.error('[CONTEXT] Failed to parse user data:', e);
                }
            }

            // Restore saved theme preference and apply to NativeWind
            const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
            if (savedTheme === 'dark' || savedTheme === 'light') {
                nwColorScheme.set(savedTheme);
                setColorSchemeState(savedTheme);
            }
        })();
    }, []);

    const saveAuth = async (nextToken, nextUser) => {
        console.log('[CONTEXT] Saving auth data:', { 
            hasToken: !!nextToken, 
            tokenType: typeof nextToken,
            tokenValue: nextToken ? `${String(nextToken).substring(0, 20)}...` : 'null/empty',
            hasUser: !!nextUser 
        });
        
        // Validate token
        if (!nextToken) {
            console.error('[CONTEXT] Invalid token: token is null/undefined');
            throw new Error('Invalid token: token is required');
        }
        
        const tokenStr = String(nextToken).trim();
        if (!tokenStr || tokenStr === 'false' || tokenStr === 'null' || tokenStr === 'undefined') {
            console.error('[CONTEXT] Invalid token value:', tokenStr);
            throw new Error(`Invalid token: cannot be "${tokenStr}"`);
        }
        
        // Update state
        setToken(tokenStr);
        setUser(nextUser);
        
        // Save to AsyncStorage
        await AsyncStorage.setItem('auth_token', tokenStr);
        await AsyncStorage.setItem('auth_user', JSON.stringify(nextUser ?? null));
        
        // Verify it was saved
        const savedToken = await AsyncStorage.getItem('auth_token');
        console.log('[CONTEXT] Auth data saved. Verification:', {
            saved: !!savedToken,
            matches: savedToken === tokenStr,
            savedLength: savedToken?.length
        });
    };

    const signOut = async () => {
        setToken(null);
        setUser(null);
        await AsyncStorage.multiRemove(['auth_token', 'auth_user']);
    };

    /**
     * Applies and persists a theme change ('dark' | 'light').
     * Uses NativeWind's colorScheme singleton so all dark: classes update immediately.
     */
    const setTheme = async (theme) => {
        nwColorScheme.set(theme);
        setColorSchemeState(theme);
        try {
            await AsyncStorage.setItem(THEME_STORAGE_KEY, theme);
        } catch (error) {
            console.error('[CONTEXT] Failed to persist theme:', error);
        }
    };

    const appValue = {
        language,
        setLanguage,
        colorScheme,
        setTheme,
        token,
        user,
        saveAuth,
        signOut,
    };
    return <appContext.Provider value={appValue}>{children}</appContext.Provider>;
};

const useAppContext = () => useContext(appContext);

export { AppProvider, appContext, useAppContext };
