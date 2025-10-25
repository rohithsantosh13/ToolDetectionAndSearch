import React, { useState, useEffect, useRef } from 'react';
import { sendStreamingChatMessage } from '../services/api';
import './ToolChat.css';

const ToolChat = () => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingMessage, setStreamingMessage] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isVoiceSupported, setIsVoiceSupported] = useState(false);
    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);
    const recognitionRef = useRef(null);

    // Auto-scroll to bottom when new messages arrive
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, streamingMessage]);

    // Initialize voice recognition
    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setInput(transcript);
                setIsListening(false);
            };

            recognitionRef.current.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                setIsListening(false);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };

            setIsVoiceSupported(true);
        }
    }, []);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [input]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setIsLoading(true);
        setIsStreaming(true);
        setStreamingMessage('');

        // Add user message
        const newMessages = [...messages, { role: 'user', content: userMessage }];
        setMessages(newMessages);

        try {
            // Start streaming response
            await sendStreamingChatMessage(
                { messages: newMessages },
                (chunk) => {
                    // Handle streaming chunks
                    setStreamingMessage(prev => prev + chunk);
                },
                (finalData) => {
                    // Handle completion
                    setIsStreaming(false);
                    setIsLoading(false);
                    setStreamingMessage('');

                    // Add assistant message
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: finalData.response || streamingMessage,
                        timestamp: new Date().toISOString()
                    }]);
                },
                (error) => {
                    // Handle errors
                    console.error('Chat error:', error);
                    setIsStreaming(false);
                    setIsLoading(false);
                    setStreamingMessage('');

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "I'm sorry, I encountered an error. Please try again.",
                        timestamp: new Date().toISOString(),
                        error: true
                    }]);
                }
            );
        } catch (error) {
            console.error('Chat error:', error);
            setIsStreaming(false);
            setIsLoading(false);
            setStreamingMessage('');

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "I'm sorry, I encountered an error. Please try again.",
                timestamp: new Date().toISOString(),
                error: true
            }]);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    const formatMessage = (content) => {
        // Format tool information with proper styling
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/✅/g, '<span class="available">✅</span>')
            .replace(/❌/g, '<span class="missing">❌</span>')
            .replace(/\n/g, '<br>');
    };

    const clearChat = () => {
        setMessages([]);
        setStreamingMessage('');
    };

    const startVoiceInput = () => {
        if (recognitionRef.current && !isListening) {
            setIsListening(true);
            recognitionRef.current.start();
        }
    };

    const stopVoiceInput = () => {
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
    };

    return (
        <div className="tool-chat">
            <div className="chat-header">
                <h2>🔧 Tool Assistant</h2>
                <p>Ask me about your tools, get help with tasks, or plan your next project!</p>
                <button onClick={clearChat} className="clear-btn">
                    Clear Chat
                </button>
            </div>

            <div className="chat-messages">
                {messages.length === 0 && (
                    <div className="welcome-message">
                        <h3>Welcome to your Tool Assistant! 🛠️</h3>
                        <p>I can help you with:</p>
                        <ul>
                            <li>📊 <strong>Tool Inventory:</strong> "How many hammers do I have?"</li>
                            <li>🔧 <strong>Task Planning:</strong> "What tools do I need to hang a picture?"</li>
                            <li>📋 <strong>Step-by-Step Guides:</strong> "Show me how to install a shelf"</li>
                            <li>💡 <strong>Tool Recommendations:</strong> "What tools do I need for electrical work?"</li>
                        </ul>
                        <p>Try asking me about your tools or a specific task!</p>
                    </div>
                )}

                {messages.map((message, index) => (
                    <div key={index} className={`message ${message.role}`}>
                        <div className="message-content">
                            {message.role === 'user' ? (
                                <div className="user-message">
                                    <div className="message-avatar">👤</div>
                                    <div className="message-text">{message.content}</div>
                                </div>
                            ) : (
                                <div className="assistant-message">
                                    <div className="message-avatar">🤖</div>
                                    <div
                                        className="message-text"
                                        dangerouslySetInnerHTML={{
                                            __html: formatMessage(message.content)
                                        }}
                                    />
                                    {message.timestamp && (
                                        <div className="message-timestamp">
                                            {new Date(message.timestamp).toLocaleTimeString()}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {isStreaming && streamingMessage && (
                    <div className="message assistant">
                        <div className="message-content">
                            <div className="assistant-message">
                                <div className="message-avatar">🤖</div>
                                <div
                                    className="message-text streaming"
                                    dangerouslySetInnerHTML={{
                                        __html: formatMessage(streamingMessage) + '<span class="cursor">|</span>'
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="chat-input">
                <div className="input-container">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Ask me about your tools or a task..."
                        disabled={isLoading}
                        className="chat-textarea"
                        rows="1"
                    />
                    {isVoiceSupported && (
                        <button
                            type="button"
                            onClick={isListening ? stopVoiceInput : startVoiceInput}
                            disabled={isLoading}
                            className={`voice-button ${isListening ? 'listening' : ''}`}
                            title={isListening ? 'Stop listening' : 'Start voice input'}
                        >
                            {isListening ? '🛑' : '🎤'}
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="send-button"
                    >
                        {isLoading ? '⏳' : '📤'}
                    </button>
                </div>
                <div className="input-hint">
                    Press Enter to send, Shift+Enter for new line
                    {isVoiceSupported && ' • Click microphone to speak'}
                </div>
            </form>
        </div>
    );
};

export default ToolChat;
