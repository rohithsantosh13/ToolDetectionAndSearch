import React, { useState, useRef } from 'react';
import { detectTools, saveImageWithTags } from '../services/api';

const CameraCapture = ({ latitude, longitude }) => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);
    const [error, setError] = useState(null);
    const [isMobile, setIsMobile] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [serverImageLoaded, setServerImageLoaded] = useState(false);
    const [editableTags, setEditableTags] = useState([]);
    const [showEditForm, setShowEditForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    // Detect if device is mobile
    React.useEffect(() => {
        const checkMobile = () => {
            const userAgent = navigator.userAgent || navigator.vendor || window.opera;
            const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
            setIsMobile(isMobileDevice);
        };
        checkMobile();
    }, []);

    // Handle video stream when showCamera changes
    React.useEffect(() => {
        if (showCamera && streamRef.current && videoRef.current) {
            videoRef.current.srcObject = streamRef.current;
            videoRef.current.onloadedmetadata = () => {
                videoRef.current.play();
            };
        }
    }, [showCamera]);

    // Cleanup camera stream on unmount
    React.useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (file) {
            setSelectedFile(file);
            setError(null);
            setUploadResult(null);

            // Create preview URL
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        setUploading(true);
        setError(null);

        try {
            // Only detect tools, don't save to database yet
            const result = await detectTools(selectedFile);
            console.log('Detection result:', result);

            // Create a mock upload result for display
            const mockResult = {
                id: 'temp-' + Date.now(), // Temporary ID for display
                filename: selectedFile.name,
                original_filename: selectedFile.name,
                tags: result.tags || [],
                confidences: result.confidences || [],
                latitude: latitude,
                longitude: longitude,
                created_at: new Date().toISOString(),
                file_size: selectedFile.size,
                mime_type: selectedFile.type
            };

            setUploadResult(mockResult);

            // Set up editable tags for user review
            setEditableTags(result.tags || []);
            setShowEditForm(true);

            // Don't clear the preview URL immediately - let it show until user decides

        } catch (err) {
            setError(err.response?.data?.detail || 'Tool detection failed. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const handleRetake = () => {
        setSelectedFile(null);
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        }
        setError(null);
        setUploadResult(null);
        setShowCamera(false);
        setServerImageLoaded(false);
        setShowEditForm(false);
        setEditableTags([]);
        stopCamera();

        // Reset file inputs
        const fileInput = document.getElementById('file-input');
        const cameraInput = document.getElementById('camera-input');
        if (fileInput) fileInput.value = '';
        if (cameraInput) cameraInput.value = '';
    };

    const handleTagChange = (index, newValue) => {
        const updatedTags = [...editableTags];
        updatedTags[index] = newValue;
        setEditableTags(updatedTags);
    };

    const addNewTag = () => {
        setEditableTags([...editableTags, '']);
    };

    const removeTag = (index) => {
        const updatedTags = editableTags.filter((_, i) => i !== index);
        setEditableTags(updatedTags);
    };

    const handleSave = async () => {
        if (!uploadResult || !selectedFile) return;

        setSaving(true);
        setError(null);

        try {
            // Filter out empty tags
            const finalTags = editableTags.filter(tag => tag.trim() !== '');

            // Now actually save to database with user-confirmed tags
            const savedResult = await saveImageWithTags(selectedFile, latitude, longitude, finalTags);
            console.log('Image saved successfully:', savedResult);

            // Update with the real saved result
            setUploadResult(savedResult);
            setShowEditForm(false);

            // Clear the preview URL after successful save
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
            }
            setSelectedFile(null);

        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to save image. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleCancelEdit = () => {
        // Completely abort the process - don't save anything
        setSelectedFile(null);
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        }
        setError(null);
        setUploadResult(null);
        setShowCamera(false);
        setServerImageLoaded(false);
        setShowEditForm(false);
        setEditableTags([]);
        stopCamera();

        // Reset file inputs
        const fileInput = document.getElementById('file-input');
        const cameraInput = document.getElementById('camera-input');
        if (fileInput) fileInput.value = '';
        if (cameraInput) cameraInput.value = '';
    };

    const startCamera = async () => {
        try {
            console.log('Starting camera...');

            // Try with environment camera first, then fallback to any camera
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'environment',
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                });
            } catch (envError) {
                console.log('Environment camera not available, trying default camera...');
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                });
            }

            console.log('Camera stream obtained:', stream);
            streamRef.current = stream;
            setShowCamera(true);

            // Wait for the video element to be rendered
            setTimeout(() => {
                if (videoRef.current) {
                    console.log('Setting video source...');
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = () => {
                        console.log('Video metadata loaded, starting playback...');
                        videoRef.current.play();
                    };
                } else {
                    console.error('Video ref not available');
                }
            }, 100);
        } catch (err) {
            console.error('Error accessing camera:', err);
            setError('Could not access camera. Please try uploading a file instead.');
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setShowCamera(false);
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const canvas = canvasRef.current;
            const video = videoRef.current;
            const context = canvas.getContext('2d');

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0);

            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
                    setSelectedFile(file);
                    setPreviewUrl(URL.createObjectURL(blob));
                    stopCamera();
                }
            }, 'image/jpeg', 0.8);
        }
    };

    const handleTakePhoto = () => {
        if (isMobile) {
            // For mobile, trigger the file input with camera capture
            document.getElementById('camera-input').click();
        } else {
            // For desktop, start camera
            startCamera();
        }
    };

    return (
        <div className="camera-capture">
            <div className="search-filters">
                {/* AI Model Info */}

                <div className="form-group">
                    <label className="form-label">📷 Take Photo</label>
                    <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="camera-input"
                        multiple={false}
                    />
                    <button
                        onClick={handleTakePhoto}
                        className="btn btn-primary"
                        style={{ width: '100%' }}
                    >
                        📷 Take Photo
                    </button>
                    <small style={{ display: 'block', marginTop: '0.5rem', color: 'var(--text-light)', fontSize: '0.75rem' }}>
                        {isMobile ? 'Opens camera on mobile devices' : 'Opens camera on desktop (requires permission)'}
                    </small>
                </div>

                <div className="form-group">
                    <label className="form-label">📁 Upload File</label>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="file-input"
                        multiple={false}
                    />
                    <label htmlFor="file-input" className="btn btn-secondary" style={{ width: '100%' }}>
                        📁 Choose File
                    </label>
                    <small style={{ display: 'block', marginTop: '0.5rem', color: 'var(--text-light)', fontSize: '0.75rem' }}>
                        Select from gallery, files, or use as camera fallback
                    </small>
                </div>
            </div>

            {/* Camera Interface for Desktop */}
            {showCamera && (
                <div className="card mt-4">
                    <div className="card-header">
                        <h4 className="card-title">📸 Camera</h4>
                        <p className="card-subtitle">Position your tool in the frame and click capture</p>
                    </div>
                    <div className="camera-container" style={{ textAlign: 'center' }}>
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            style={{
                                width: '100%',
                                maxWidth: '500px',
                                height: 'auto',
                                minHeight: '300px',
                                backgroundColor: '#000',
                                borderRadius: 'var(--border-radius)',
                                border: '1px solid var(--border-color)',
                                objectFit: 'cover'
                            }}
                        />
                        <canvas
                            ref={canvasRef}
                            style={{ display: 'none' }}
                        />
                        <div className="camera-controls" style={{ marginTop: '1rem' }}>
                            <button
                                onClick={capturePhoto}
                                className="btn btn-primary"
                                style={{ marginRight: '1rem' }}
                            >
                                📸 Capture Photo
                            </button>
                            <button
                                onClick={stopCamera}
                                className="btn btn-secondary"
                            >
                                ❌ Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {previewUrl && (
                <div className="card mt-4">
                    <div className="card-header">
                        <h4 className="card-title">📸 Image Preview</h4>
                    </div>
                    <div className="image-grid" style={{ gridTemplateColumns: '1fr', maxWidth: '400px', margin: '0 auto' }}>
                        <div className="image-card">
                            <img
                                src={previewUrl}
                                alt="Preview"
                                className="image-preview"
                            />
                        </div>
                    </div>

                    <div className="flex gap-4 justify-center mt-4">
                        <button
                            onClick={handleRetake}
                            className="btn btn-secondary"
                            disabled={uploading}
                        >
                            🔄 Retake
                        </button>
                        <button
                            onClick={handleUpload}
                            className="btn btn-primary"
                            disabled={uploading}
                        >
                            {uploading ? (
                                <>
                                    <div className="spinner" style={{ width: '16px', height: '16px', marginRight: '8px' }}></div>
                                    Uploading...
                                </>
                            ) : (
                                '🚀 Upload & Analyze'
                            )}
                        </button>
                    </div>
                </div>
            )}

            {error && (
                <div className="alert alert-error">
                    <strong>⚠️ Upload Error:</strong> {error}
                </div>
            )}

            {/* Edit Form - shown after tool detection, before saving */}
            {showEditForm && uploadResult && (
                <div className="card mt-4">
                    <div className="card-header">
                        <h4 className="card-title">🔍 Review Detected Tools</h4>
                        <p className="card-subtitle">Edit the detected tool names before saving</p>
                    </div>

                    <div className="image-grid" style={{ gridTemplateColumns: '1fr', maxWidth: '400px', margin: '0 auto' }}>
                        <div className="image-card">
                            <img
                                src={previewUrl || `/api/images/${uploadResult.id}`}
                                alt="Tool detection preview"
                                className="image-preview"
                                onLoad={() => {
                                    console.log('Image loaded successfully');
                                    setServerImageLoaded(true);
                                }}
                                onError={(e) => {
                                    console.error('Image load error:', e);
                                    if (previewUrl && e.target.src !== previewUrl) {
                                        e.target.src = previewUrl;
                                    }
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ padding: '1rem' }}>
                        <h5 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Detected Tools:</h5>
                        <div style={{ marginBottom: '1rem' }}>
                            {editableTags.map((tag, index) => (
                                <div key={index} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    marginBottom: '0.5rem',
                                    gap: '0.5rem'
                                }}>
                                    <input
                                        type="text"
                                        value={tag}
                                        onChange={(e) => handleTagChange(index, e.target.value)}
                                        className="form-input"
                                        style={{ flex: 1 }}
                                        placeholder="Enter tool name..."
                                    />
                                    <button
                                        onClick={() => removeTag(index)}
                                        className="btn btn-danger"
                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                    >
                                        ❌
                                    </button>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={addNewTag}
                            className="btn btn-secondary"
                            style={{ marginBottom: '1rem', width: '100%' }}
                        >
                            ➕ Add New Tag
                        </button>

                        <div style={{
                            display: 'flex',
                            gap: '0.5rem',
                            justifyContent: 'center',
                            flexWrap: 'wrap'
                        }}>
                            <button
                                onClick={handleRetake}
                                className="btn btn-secondary"
                                disabled={saving}
                            >
                                🔄 Retake Photo
                            </button>
                            <button
                                onClick={handleCancelEdit}
                                className="btn btn-outline"
                                disabled={saving}
                            >
                                ❌ Cancel & Discard
                            </button>
                            <button
                                onClick={handleSave}
                                className="btn btn-primary"
                                disabled={saving}
                            >
                                {saving ? (
                                    <>
                                        <div className="spinner" style={{ width: '16px', height: '16px', marginRight: '8px' }}></div>
                                        Saving...
                                    </>
                                ) : (
                                    '💾 Save & Continue'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Final Result - shown after user saves */}
            {uploadResult && !showEditForm && (
                <div className="card mt-4">
                    <div className="card-header">
                        <h4 className="card-title">✅ Upload Successful!</h4>
                        <p className="card-subtitle">AI analysis complete</p>
                    </div>

                    <div className="image-grid" style={{ gridTemplateColumns: '1fr', maxWidth: '400px', margin: '0 auto' }}>
                        <div className="image-card">
                            <img
                                src={serverImageLoaded ? `/api/images/${uploadResult.id}` : (previewUrl || `/api/images/${uploadResult.id}`)}
                                alt="Uploaded tool"
                                className="image-preview"
                                onLoad={() => {
                                    console.log('Image loaded successfully');
                                    setServerImageLoaded(true);
                                    // Once server image loads, we can clear the preview after a delay
                                    if (previewUrl) {
                                        setTimeout(() => {
                                            URL.revokeObjectURL(previewUrl);
                                            setPreviewUrl(null);
                                        }, 2000); // Give it time to ensure smooth transition
                                    }
                                }}
                                onError={(e) => {
                                    console.error('Image load error:', e);
                                    // If server image fails, keep using preview
                                    if (previewUrl && e.target.src !== previewUrl) {
                                        e.target.src = previewUrl;
                                    }
                                }}
                            />
                            <div className="image-info">
                                <div className="image-tags">
                                    {uploadResult.tags && uploadResult.tags.length > 0 ? (
                                        uploadResult.tags.map((tag, index) => (
                                            <span key={index} className="tag">
                                                {tag}
                                                {uploadResult.confidences && uploadResult.confidences[index] && (
                                                    <span> ({(uploadResult.confidences[index] * 100).toFixed(0)}%)</span>
                                                )}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="tag" style={{ background: 'var(--warning-color)' }}>
                                            No tools detected
                                        </span>
                                    )}
                                </div>
                                <div className="image-meta">
                                    📁 {uploadResult.original_filename || uploadResult.filename}<br />
                                    📍 {uploadResult.latitude.toFixed(6)}, {uploadResult.longitude.toFixed(6)}<br />
                                    📅 {new Date(uploadResult.created_at).toLocaleString()}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="text-center mt-4">
                        <a href="/search" className="btn btn-primary">
                            🔍 View All Images
                        </a>
                    </div>
                </div>
            )}

            {uploading && (
                <div className="loading">
                    <div className="spinner"></div>
                    <div className="mt-2">
                        <p>🤖 AI is analyzing your image...</p>
                        <p style={{ color: 'var(--text-light)', fontSize: '0.875rem' }}>This may take a few seconds.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CameraCapture;
