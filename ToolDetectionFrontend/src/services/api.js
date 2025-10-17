import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
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
export const detectTools = async (imageFile) => {
    const formData = new FormData();
    formData.append('image', imageFile);

    const response = await api.post('/detect-tools', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });

    return response.data;
};

export const saveImageWithTags = async (imageFile, latitude, longitude, tags) => {
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('latitude', latitude);
    formData.append('longitude', longitude);
    formData.append('tags', JSON.stringify(tags));

    const response = await api.post('/save-image', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });

    return response.data;
};

// Keep the old uploadImage for backward compatibility (if needed)
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
    const baseURL = api.defaults.baseURL.replace('/api', '');
    return `${baseURL}/api/images/${imageId}`;
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

export const getAvailableModels = async () => {
    const response = await api.get('/models/available');
    return response.data;
};

export const searchByImage = async (imageFile, latitude = null, longitude = null) => {
    const formData = new FormData();
    formData.append('image', imageFile);

    if (latitude && longitude) {
        formData.append('lat', latitude);
        formData.append('lon', longitude);
    }

    const response = await api.post('/search-by-image', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });

    return response.data;
};

export default api;
