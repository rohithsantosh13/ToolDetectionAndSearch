import React, { useState } from 'react';
import { uploadImage } from '../services/api';

const CameraCapture = ({ latitude, longitude }) => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);
    const [error, setError] = useState(null);

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
            const result = await uploadImage(selectedFile, latitude, longitude);
            setUploadResult(result);

            // Clear the file input
            setSelectedFile(null);
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
            }

        } catch (err) {
            setError(err.response?.data?.detail || 'Upload failed. Please try again.');
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
    };

    return (
        <div className="camera-capture">
            <div className="search-filters">
                <div className="form-group">
                    <label className="form-label">📷 Take Photo</label>
                    <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="camera-input"
                    />
                    <label htmlFor="camera-input" className="btn btn-primary" style={{ width: '100%' }}>
                        📷 Take Photo
                    </label>
                    <small style={{ display: 'block', marginTop: '0.5rem', color: 'var(--text-light)', fontSize: '0.75rem' }}>
                        Opens camera on mobile devices
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
                    />
                    <label htmlFor="file-input" className="btn btn-secondary" style={{ width: '100%' }}>
                        📁 Choose File
                    </label>
                    <small style={{ display: 'block', marginTop: '0.5rem', color: 'var(--text-light)', fontSize: '0.75rem' }}>
                        Select from gallery or files
                    </small>
                </div>
            </div>

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

            {uploadResult && (
                <div className="card mt-4">
                    <div className="card-header">
                        <h4 className="card-title">✅ Upload Successful!</h4>
                        <p className="card-subtitle">AI analysis complete</p>
                    </div>

                    <div className="image-grid" style={{ gridTemplateColumns: '1fr', maxWidth: '400px', margin: '0 auto' }}>
                        <div className="image-card">
                            <img
                                src={`/api/images/${uploadResult.filename}`}
                                alt="Uploaded tool"
                                className="image-preview"
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
