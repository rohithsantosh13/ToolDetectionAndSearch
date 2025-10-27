import React, { useState, useRef, useEffect } from 'react';
import { detectTools, saveImageWithTags } from '../services/api';
import { getLocationNameForCoords } from '../services/locationService';

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
    const [locationName, setLocationName] = useState(null);
    const [captureTime, setCaptureTime] = useState(null);
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

    // Get location name for the current coordinates
    useEffect(() => {
        if (latitude && longitude) {
            getLocationNameForCoords(latitude, longitude).then(setLocationName);
        }
    }, [latitude, longitude]);

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

            // Set capture time to when the file was selected (or file's lastModified if available)
            const captureTimestamp = file.lastModified ? new Date(file.lastModified) : new Date();
            setCaptureTime(captureTimestamp);

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
                created_at: (captureTime || new Date()).toISOString(),
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

    const handleRetake = async () => {
        setSelectedFile(null);
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        }
        setError(null);
        setUploadResult(null);
        setServerImageLoaded(false);
        setShowEditForm(false);
        setEditableTags([]);
        setCaptureTime(null);

        // Stop current camera if running
        stopCamera();

        // Reset file inputs
        const fileInput = document.getElementById('file-input');
        const cameraInput = document.getElementById('camera-input');
        if (fileInput) fileInput.value = '';
        if (cameraInput) cameraInput.value = '';

        // Automatically start camera again
        try {
            await startCamera();
        } catch (err) {
            console.error('Failed to restart camera:', err);
            setError('Failed to restart camera. Please try again.');
        }
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

            // Show success message
            setUploadResult(prev => ({
                ...prev,
                saveSuccess: true,
                saveMessage: 'Image saved successfully!'
            }));

        } catch (err) {
            console.error('Save error:', err);
            setError(err.response?.data?.detail || 'Failed to save image. Please try again.');

            // Show error message
            setUploadResult(prev => ({
                ...prev,
                saveSuccess: false,
                saveMessage: 'Failed to save image. Please try again.'
            }));
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
        setCaptureTime(null);
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

            // Set capture time to when the photo is actually taken
            setCaptureTime(new Date());

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
            <div className="camera-options" style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                marginBottom: '1.5rem'
            }}>
                <div className="camera-option">
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
                        style={{
                            width: '100%',
                            height: '100%',
                            minHeight: '48px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.125rem',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            padding: '0.375rem',
                            boxSizing: 'border-box',
                            borderRadius: '0.375rem',
                            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <span style={{ fontSize: '1.25rem', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}>📷</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>Take Photo</span>
                    </button>
                    <small style={{
                        display: 'block',
                        marginTop: '0.5rem',
                        color: 'var(--text-secondary)',
                        fontSize: '0.8rem',
                        textAlign: 'center',
                        fontWeight: '500',
                        lineHeight: '1.2'
                    }}>
                    </small>
                </div>

                <div className="camera-option">
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="file-input"
                        multiple={false}
                    />
                    <label
                        htmlFor="file-input"
                        className="btn btn-secondary"
                        style={{
                            width: '100%',
                            height: '100%',
                            minHeight: '48px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.125rem',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            padding: '0.375rem',
                            boxSizing: 'border-box',
                            cursor: 'pointer',
                            borderRadius: '0.375rem',
                            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <span style={{ fontSize: '1.25rem', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}>📁</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>Choose File</span>
                    </label>
                    <small style={{
                        display: 'block',
                        marginTop: '0.5rem',
                        color: 'var(--text-secondary)',
                        fontSize: '0.8rem',
                        textAlign: 'center',
                        fontWeight: '500',
                        lineHeight: '1.2'
                    }}>
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
                        <div className="camera-controls" style={{
                            marginTop: '1.5rem',
                            display: 'flex',
                            gap: '1rem',
                            justifyContent: 'center',
                            flexWrap: 'wrap'
                        }}>
                            <button
                                onClick={capturePhoto}
                                className="btn btn-primary"
                                style={{
                                    padding: '0.875rem 2rem',
                                    fontSize: '1rem',
                                    fontWeight: '600',
                                    height: '48px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    minWidth: '160px'
                                }}
                            >
                                📸 Capture Photo
                            </button>
                            <button
                                onClick={stopCamera}
                                className="btn btn-secondary"
                                style={{
                                    padding: '0.875rem 2rem',
                                    fontSize: '1rem',
                                    fontWeight: '600',
                                    height: '48px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    minWidth: '160px'
                                }}
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

                    <div style={{
                        display: 'flex',
                        gap: '1rem',
                        justifyContent: 'center',
                        flexWrap: 'wrap',
                        paddingTop: '1rem',
                        padding: '1rem'
                    }}>
                        <button
                            onClick={handleRetake}
                            className="btn btn-secondary"
                            disabled={uploading}
                            style={{
                                flex: '1 1 auto',
                                minWidth: '140px',
                                padding: '0.875rem 1.5rem',
                                fontSize: '1rem',
                                fontWeight: '600',
                                height: '48px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            🔄 Retake
                        </button>
                        <button
                            onClick={handleUpload}
                            className="btn btn-primary"
                            disabled={uploading}
                            style={{
                                flex: '1 1 auto',
                                minWidth: '140px',
                                padding: '0.875rem 1.5rem',
                                fontSize: '1rem',
                                fontWeight: '600',
                                height: '48px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            {uploading ? (
                                <>
                                    <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
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
                                src={previewUrl || uploadResult.onedrive_download_url || uploadResult.onedrive_file_url}
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
                                        style={{
                                            padding: '0.5rem',
                                            fontSize: '0.8rem',
                                            height: '36px',
                                            minWidth: '36px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: '0.5rem'
                                        }}
                                    >
                                        ❌
                                    </button>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={addNewTag}
                            className="btn btn-secondary"
                            style={{
                                marginBottom: '1rem',
                                width: '100%',
                                height: '44px',
                                padding: '0.75rem 1rem',
                                fontSize: '0.95rem',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            ➕ Add New Tag
                        </button>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                            gap: '0.75rem',
                            justifyContent: 'center',
                            width: '100%'
                        }}>
                            <button
                                onClick={handleRetake}
                                className="btn btn-secondary"
                                disabled={saving}
                                style={{
                                    padding: '0.875rem 1rem',
                                    fontSize: '0.95rem',
                                    fontWeight: '600',
                                    height: '44px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.4rem'
                                }}
                            >
                                🔄 Retake
                            </button>
                            <button
                                onClick={handleCancelEdit}
                                className="btn btn-outline"
                                disabled={saving}
                                style={{
                                    padding: '0.875rem 1rem',
                                    fontSize: '0.95rem',
                                    fontWeight: '600',
                                    height: '44px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.4rem'
                                }}
                            >
                                ❌ Discard
                            </button>
                            <button
                                onClick={handleSave}
                                className="btn btn-primary"
                                disabled={saving}
                                style={{
                                    padding: '0.875rem 1rem',
                                    fontSize: '0.95rem',
                                    fontWeight: '600',
                                    height: '44px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.4rem'
                                }}
                            >
                                {saving ? (
                                    <>
                                        <div className="spinner" style={{ width: '14px', height: '14px' }}></div>
                                        Saving...
                                    </>
                                ) : (
                                    '💾 Save'
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
                        <h4 className="card-title">
                            {uploadResult.saveSuccess === false ? '❌ Save Failed' : '✅ Upload Successful!'}
                        </h4>
                        <p className="card-subtitle">
                            {uploadResult.saveMessage || 'AI analysis complete'}
                        </p>
                    </div>

                    <div className="image-grid" style={{ gridTemplateColumns: '1fr', maxWidth: '400px', margin: '0 auto' }}>
                        <div className="image-card">
                            <img
                                src={uploadResult.onedrive_download_url || uploadResult.onedrive_file_url || previewUrl}
                                alt="Uploaded tool"
                                className="image-preview"
                                onLoad={() => {
                                    console.log('Image loaded successfully');
                                    setServerImageLoaded(true);
                                    // Once OneDrive image loads, we can clear the preview after a delay
                                    if (previewUrl) {
                                        setTimeout(() => {
                                            URL.revokeObjectURL(previewUrl);
                                            setPreviewUrl(null);
                                        }, 2000); // Give it time to ensure smooth transition
                                    }
                                }}
                                onError={(e) => {
                                    console.error('Image load error:', e);
                                    // If OneDrive image fails, fall back to preview
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
                                    📍 {locationName || `${uploadResult.latitude.toFixed(6)}, ${uploadResult.longitude.toFixed(6)}`}<br />
                                    📅 {new Date(uploadResult.created_at).toLocaleString()}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="text-center mt-4">
                        {uploadResult.saveSuccess === false ? (
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                                <button
                                    onClick={() => {
                                        setShowEditForm(true);
                                        setUploadResult(prev => ({ ...prev, saveSuccess: null, saveMessage: null }));
                                    }}
                                    className="btn btn-warning"
                                >
                                    🔄 Retry Save
                                </button>
                                <a href="/search" className="btn btn-primary">
                                    🔍 Search Images
                                </a>
                            </div>
                        ) : (
                            <a href="/search" className="btn btn-primary">
                                🔍 Search Images
                            </a>
                        )}
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