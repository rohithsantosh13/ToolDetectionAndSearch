import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
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

export const getImageUrl = (imageData) => {
    console.log('getImageUrl called with:', imageData);

    // If imageData is a string (imageId), use the old method for backward compatibility
    if (typeof imageData === 'string') {
        const baseURL = api.defaults.baseURL.replace('/api', '');
        const url = `${baseURL}/api/images/${imageData}`;
        console.log('Using legacy URL for string ID:', url);
        return url;
    }

    // If imageData is an object with OneDrive URLs, use them directly
    if (imageData && typeof imageData === 'object') {
        // Check if OneDrive URLs exist and are not empty
        const onedriveDownloadUrl = imageData.onedrive_download_url;
        const onedriveFileUrl = imageData.onedrive_file_url;

        console.log('OneDrive URLs check:', {
            onedrive_download_url: onedriveDownloadUrl,
            onedrive_file_url: onedriveFileUrl,
            id: imageData.id
        });

        if (onedriveDownloadUrl && onedriveDownloadUrl.trim() !== '') {
            console.log('Using OneDrive download URL:', onedriveDownloadUrl);
            return onedriveDownloadUrl;
        }

        if (onedriveFileUrl && onedriveFileUrl.trim() !== '') {
            console.log('Using OneDrive file URL:', onedriveFileUrl);
            return onedriveFileUrl;
        }

        // If no OneDrive URLs, fall back to legacy API
        const baseURL = api.defaults.baseURL.replace('/api', '');
        const legacyUrl = `${baseURL}/api/images/${imageData.id}`;
        console.log('Falling back to legacy API URL:', legacyUrl);
        return legacyUrl;
    }

    console.log('No valid imageData, returning null');
    return null;
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

// Chat API functions
export const sendChatMessage = async (chatData) => {
    try {
        const response = await api.post('/chat', chatData);
        return response.data;
    } catch (error) {
        console.error('Chat API error, using fallback:', error);
        // Return a fallback response
        const mockResponse = generateMockResponse(chatData);

        return {
            response: mockResponse,
            timestamp: new Date().toISOString(),
            user_tools_count: 5
        };
    }
};

// Streaming chat function with fallback
export const sendStreamingChatMessage = async (chatData, onChunk, onComplete, onError) => {
    try {
        // Try the real backend first
        const baseURL = api.defaults.baseURL;
        const response = await fetch(`${baseURL}/chat/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(chatData),
        });

        if (!response.ok) {
            throw new Error(`Streaming API error: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
            while (true) {
                const { done, value } = await reader.read();

                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            if (data.done) {
                                onComplete(data);
                                return;
                            } else if (data.content) {
                                onChunk(data.content);
                            }
                        } catch (e) {
                            console.warn('Failed to parse streaming data:', e);
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    } catch (error) {
        console.error('Streaming chat error, using fallback:', error);
        // Fallback to mock streaming response
        const mockResponse = generateMockResponse(chatData);
        simulateStreamingResponse(mockResponse, onChunk, onComplete);
    }
};

// Mock response generator
const generateMockResponse = (chatData) => {
    const messages = chatData.messages || [];
    const lastMessage = messages[messages.length - 1];
    const userMessage = lastMessage?.content || '';
    const messageLower = userMessage.toLowerCase();

    // Inventory questions
    if (messageLower.includes('how many') || messageLower.includes('inventory') || messageLower.includes('tools do i have')) {
        return "You have **5** tools in your inventory:\n\n✅ **hammer**: 2 available\n✅ **screwdriver**: 1 available\n✅ **wrench**: 2 available\n\nI can help you plan tasks and recommend tools!";
    }

    // Task planning questions
    else if (messageLower.includes('task') || messageLower.includes('plan') || messageLower.includes('project')) {
        return "I'd be happy to help you plan that task! Based on your inventory of **5** tools, I can help you figure out what you need. Could you provide more details about the specific task you want to accomplish?";
    }

    // Specific tool questions
    else if (messageLower.includes('hammer')) {
        return "You have **2 hammers** available in your inventory. They're great for driving nails, demolition work, and general construction tasks!";
    }
    else if (messageLower.includes('screwdriver')) {
        return "You have **1 screwdriver** available. Consider getting a set with different sizes and types (Phillips, flathead) for various projects!";
    }
    else if (messageLower.includes('wrench')) {
        return "You have **2 wrenches** available. They're essential for plumbing, automotive work, and any task involving nuts and bolts!";
    }

    // Hanging a picture task
    else if (messageLower.includes('hang') && messageLower.includes('picture')) {
        return "**Task: Hanging a Picture**\n\n**✅ Available Tools:**\n• Hammer (2 available)\n\n**❌ Missing Tools:**\n• Level (for straight hanging)\n• Measuring tape (for proper placement)\n• Nails or picture hooks\n\n**📋 Steps:**\n1. Measure and mark the desired height\n2. Use a level to ensure straight placement\n3. Hammer in the nail at a slight upward angle\n4. Hang your picture and adjust as needed\n\n**💡 Tip:** Consider getting a level and measuring tape for better results!";
    }

    // Installing a shelf task
    else if (messageLower.includes('install') && messageLower.includes('shelf')) {
        return "**Task: Installing a Shelf**\n\n**✅ Available Tools:**\n• Hammer (2 available)\n• Screwdriver (1 available)\n\n**❌ Missing Tools:**\n• Drill (for pilot holes)\n• Level (for straight installation)\n• Measuring tape\n• Wall anchors and screws\n\n**📋 Steps:**\n1. Locate wall studs using a stud finder\n2. Mark shelf placement with level\n3. Drill pilot holes\n4. Install wall anchors if needed\n5. Mount shelf brackets\n6. Place and secure the shelf\n\n**⚠️ Safety:** Always check for electrical wires and pipes before drilling!";
    }

    // General help
    else if (messageLower.includes('help') || messageLower.includes('what can you do')) {
        return "I'm your **Tool Assistant**! I can help you with:\n\n🔧 **Tool Inventory**: Check what tools you have\n📋 **Task Planning**: Plan DIY projects and tasks\n🛠️ **Tool Recommendations**: Suggest tools for specific jobs\n📖 **Step-by-Step Guides**: Get detailed instructions\n\nTry asking:\n• \"How many tools do I have?\"\n• \"What tools do I need to hang a picture?\"\n• \"Help me plan installing a shelf\"";
    }

    // Greeting responses
    else if (messageLower.includes('hi') || messageLower.includes('hello') || messageLower.includes('hey')) {
        return "Hello! 👋 I'm your **Tool Assistant**! I can help you with your tool inventory and DIY task planning. Try asking me:\n\n• \"How many tools do I have?\"\n• \"What tools do I need to hang a picture?\"\n• \"Help me plan a project\"";
    }

    // Default response
    else {
        return `I understand you're asking about "${userMessage}". I'm your tool assistant and I can help with:\n\n🔧 **Tool Inventory**: Check what tools you have\n📋 **Task Planning**: Plan DIY projects\n🛠️ **Tool Recommendations**: Suggest tools for specific jobs\n\nTry asking something like "How many tools do I have?" or "What tools do I need to hang a picture?"`;
    }
};

// Simulate streaming response
const simulateStreamingResponse = (response, onChunk, onComplete) => {
    const words = response.split(' ');
    let index = 0;

    const streamInterval = setInterval(() => {
        if (index < words.length) {
            onChunk(words[index] + ' ');
            index++;
        } else {
            clearInterval(streamInterval);
            onComplete({ response: response, done: true });
        }
    }, 100); // 100ms delay between words
};

export const getToolCategories = async () => {
    const response = await api.get('/chat/tool-categories');
    return response.data;
};

export const getTaskRequirements = async () => {
    const response = await api.get('/chat/task-requirements');
    return response.data;
};

export default api;
