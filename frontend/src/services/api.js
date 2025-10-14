import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api',
    timeout: 30000, // 30 seconds timeout for ML inference
});

// Request interceptor
api.interceptors.request.use(
    (config) => {
        console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor
api.interceptors.response.use(
    (response) => {
        console.log(`API Response: ${response.status} ${response.config.url}`);
        return response;
    },
    (error) => {
        console.error(`API Error: ${error.response?.status} ${error.config?.url}`, error.response?.data);
        return Promise.reject(error);
    }
);

// API functions
export const uploadImage = async (imageFile, latitude, longitude) => {
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('latitude', latitude);
    formData.append('longitude', longitude);

    const response = await api.post('/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });

    return response.data;
};

export const searchImages = async (params) => {
    const response = await api.get('/search', { params });
    return response.data;
};

export const getImageUrl = (imageId) => {
    return `${api.defaults.baseURL.replace('/api', '')}/images/${imageId}`;
};

export const getImageInfo = async (imageId) => {
    const response = await api.get(`/images/${imageId}/info`);
    return response.data;
};

export const healthCheck = async () => {
    const response = await api.get('/health');
    return response.data;
};

export const getModelsInfo = async () => {
    const response = await api.get('/models/info');
    return response.data;
};

export default api;
