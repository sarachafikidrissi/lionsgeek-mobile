import axios from "axios";

const APP_URL = process.env.EXPO_PUBLIC_APP_URL;

const ensureAppUrl = () => {
    const value = typeof APP_URL === 'string' ? APP_URL.trim() : '';
    if (!value) {
        throw new Error(
            'EXPO_PUBLIC_APP_URL is not set. Create a .env file (see .env.example) and restart Expo.'
        );
    }
    return value.replace(/\/+$/, '');
};

const IMAGE_URL = APP_URL ? `${APP_URL}/storage/images` : '';
const VIDEO_URL = APP_URL ? `${APP_URL}/storage/videos` : '';

const get = async (endpoint, Token) => {
    try {
        const baseUrl = ensureAppUrl();
        // Token is REQUIRED for all API calls
        if (!Token) {
            throw new Error('Authentication token is required');
        }

        const headers = {
            'Authorization': `Bearer ${Token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        };

        const url = `${baseUrl}/api/${endpoint}`;
        const response = await axios.get(url, { headers });
        
        // Handle case where response.data is a string with HTML warnings + JSON
        if (typeof response.data === 'string') {
            // Extract JSON from string (find the JSON object)
            const jsonMatch = response.data.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    response.data = JSON.parse(jsonMatch[0]);
                } catch (parseError) {
                    console.log(`API WARNING: Failed to parse JSON from response for ${endpoint}`);
                    // Keep original response.data if parsing fails
                }
            }
        }
        
        return response;
    } catch (error) {
        const baseUrl = (() => {
            try { return ensureAppUrl(); } catch { return ''; }
        })();
        const url = baseUrl ? `${baseUrl}/api/${endpoint}` : `/api/${endpoint}`;
        const errorData = error?.response?.data;
        const errorMessage = typeof errorData === 'object' 
            ? JSON.stringify(errorData, null, 2)
            : (errorData || error?.message || 'Unknown error');
        console.log(`API ERROR\nMethod: GET\nURL: ${url}\nEndpoint: ${endpoint}\nError: ${errorMessage}`);
        if (error?.response?.status) {
            console.log(`Status: ${error.response.status}`);
        }
        throw error;
    }
};



const post = async (endpoint, data, Token) => {
    try {
        const baseUrl = ensureAppUrl();
        // Token is REQUIRED for all API calls (except login/forgot-password)
        const headers = {
            'Accept': 'application/json',
        };

        // Check if data is FormData (React Native FormData)
        // In React Native, FormData is a global, so we check for it
        const isFormData = data && (
            (typeof FormData !== 'undefined' && data instanceof FormData) ||
            (data.constructor && data.constructor.name === 'FormData') ||
            (data._parts !== undefined) // React Native FormData has _parts
        );

        // For JSON, we set application/json.
        // For FormData (uploads), axios-on-RN is more reliable when explicitly
        // using multipart/form-data (boundary is handled by the native layer).
        if (!isFormData) {
            headers['Content-Type'] = 'application/json';
        } else {
            headers['Content-Type'] = 'multipart/form-data';
        }

        if (Token) {
            headers['Authorization'] = `Bearer ${Token}`;
        }

        const url = `${baseUrl}/api/${endpoint}`;
        const response = await axios.post(url, data, {
            headers,
            // Avoid custom transformRequest for FormData — it can break multipart in RN and cause Network Error
            timeout: 30000,
        });
        
        // Handle case where response.data is a string with HTML warnings + JSON
        if (typeof response.data === 'string') {
            // Extract JSON from string (find the JSON object)
            const jsonMatch = response.data.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    response.data = JSON.parse(jsonMatch[0]);
                } catch (parseError) {
                    console.log(`API WARNING: Failed to parse JSON from response for ${endpoint}`);
                    // Keep original response.data if parsing fails
                }
            }
        }
        
        return response;
    } catch (error) {
        const baseUrl = (() => {
            try { return ensureAppUrl(); } catch { return ''; }
        })();
        const url = baseUrl ? `${baseUrl}/api/${endpoint}` : `/api/${endpoint}`;
        const status = error?.response?.status;
        const errorData = error?.response?.data;
        const errorMessage = typeof errorData === 'object'
            ? JSON.stringify(errorData, null, 2)
            : (errorData || error?.message || 'Unknown error');
        console.log(`API ERROR\nMethod: POST\nURL: ${url}\nEndpoint: ${endpoint}\nStatus: ${status ?? 'unknown'}\nError: ${errorMessage}`);
        throw error;
    }
};



const put = async (endpoint, Token, data) => {
    try {
        const baseUrl = ensureAppUrl();
        if (!Token) {
            throw new Error('Authentication token is required');
        }

        const headers = {
            'Authorization': `Bearer ${Token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        };

        const url = `${baseUrl}/api/${endpoint}`;
        const response = await axios.put(url, data, { headers });
        return response;
    } catch (error) {
        const baseUrl = (() => {
            try { return ensureAppUrl(); } catch { return ''; }
        })();
        const url = baseUrl ? `${baseUrl}/api/${endpoint}` : `/api/${endpoint}`;
        const errorData = error?.response?.data;
        const errorMessage = typeof errorData === 'object'
            ? JSON.stringify(errorData, null, 2)
            : (errorData || error?.message || 'Unknown error');
        console.log(`API ERROR\nMethod: PUT\nURL: ${url}\nEndpoint: ${endpoint}\nError: ${errorMessage}`);
        throw error;
    }
};


//* Keep this just in case. For updating participants
// export const update_visitor = async (Token, first_name, last_name) => {
//     try {
//         const response = await axios.put(`${APP_URL}/api/visitor`, { first_name, last_name }, {
//             headers: { Token },
//         })
//         return response;
//     } catch (error) {

//         console.log("API ERROR:", error);

//     }
// }


const remove = async (endpoint, Token) => {
    try {
        const baseUrl = ensureAppUrl();
        if (!Token) {
            throw new Error('Authentication token is required');
        }

        const headers = {
            'Authorization': `Bearer ${Token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        };

        const url = `${baseUrl}/api/${endpoint}`;
        const response = await axios.delete(url, { headers });
        return response;
    } catch (error) {
        const baseUrl = (() => {
            try { return ensureAppUrl(); } catch { return ''; }
        })();
        const url = baseUrl ? `${baseUrl}/api/${endpoint}` : `/api/${endpoint}`;
        const errorData = error?.response?.data;
        const errorMessage = typeof errorData === 'object'
            ? JSON.stringify(errorData, null, 2)
            : (errorData || error?.message || 'Unknown error');
        console.log(`API ERROR\nMethod: DELETE\nURL: ${url}\nEndpoint: ${endpoint}\nError: ${errorMessage}`);
        throw error;
    }
};

// Mobile API helpers with token from context
const getWithAuth = async (endpoint, token) => {
    return get(endpoint, token);
};
const postWithAuth = async (endpoint, data, token) => {
    return post(endpoint, data, token);
};

// ---------------------------------------------------------------------------
// Voice call helpers
// Backend routes (see routes/api.php on the Laravel side). All call routes
// live inside the `auth:sanctum` + `prefix('mobile')` group, so the real
// URLs are /api/mobile/calls/... and /api/mobile/call/ably-token.
//   GET    /api/mobile/call/ably-token
//   POST   /api/mobile/calls/initiate          { callee_id }
//   GET    /api/mobile/calls/{id}
//   POST   /api/mobile/calls/{id}/accept
//   POST   /api/mobile/calls/{id}/reject
//   POST   /api/mobile/calls/{id}/end
// All return JSON. These helpers unwrap response.data so callers can
// just `await API.initiateCall(...)` and use the result directly.
// ---------------------------------------------------------------------------

const initiateCall = async (calleeId, token) => {
    const response = await post('mobile/calls/initiate', { callee_id: calleeId }, token);
    return response?.data;
};

const acceptCall = async (callId, token) => {
    const response = await post(`mobile/calls/${callId}/accept`, {}, token);
    return response?.data;
};

const rejectCall = async (callId, token) => {
    const response = await post(`mobile/calls/${callId}/reject`, {}, token);
    return response?.data;
};

const endCall = async (callId, token) => {
    const response = await post(`mobile/calls/${callId}/end`, {}, token);
    return response?.data;
};

const getCall = async (callId, token) => {
    const response = await get(`mobile/calls/${callId}`, token);
    return response?.data;
};

const getCallAblyToken = async (token) => {
    const response = await get('mobile/call/ably-token', token);
    return response?.data;
};

export default {
    get,
    put,
    post,
    remove,
    getWithAuth,
    postWithAuth,
    APP_URL,
    IMAGE_URL,
    VIDEO_URL,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    getCall,
    getCallAblyToken,
};
