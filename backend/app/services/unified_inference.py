"""
Unified inference service using Google Cloud AI (Gemini) for tool detection

This service provides a simplified interface using only Google Gemini for:
- Construction tool detection
- Cloud-based AI processing
- Consistent results across all platforms
"""

import os
import logging
from typing import List, Tuple, Optional, Dict, Any

from app.services.gemini_service import get_gemini_detector

logger = logging.getLogger(__name__)


class UnifiedToolDetector:
    """Unified tool detector using Google Cloud AI (Gemini)"""
    
    def __init__(self):
        """Initialize the unified detector with Gemini only"""
        self.gemini_detector = get_gemini_detector()
        
        logger.info("Unified detector initialized with Google Cloud AI (Gemini)")
        logger.info(f"Gemini detector available: {self.gemini_detector.is_available()}")
        
        if not self.gemini_detector.is_available():
            logger.warning("Google Cloud AI (Gemini) is not available. Please check your API key configuration.")
    
    def detect_tools(
        self, 
        image_path: str, 
        model_type: Optional[str] = None
    ) -> Tuple[List[str], List[float], Dict[str, Any]]:
        """
        Detect tools in an image using Google Cloud AI (Gemini)
        
        Args:
            image_path: Path to the image file
            model_type: Ignored (kept for API compatibility)
            
        Returns:
            Tuple of (tags, confidences, metadata)
        """
        metadata = {
            "model_used": "gemini",
            "models_tried": ["gemini"],
            "detection_time": 0,
            "confidence_scores": {},
            "model_availability": {
                "gemini": self.gemini_detector.is_available()
            }
        }
        
        import time
        start_time = time.time()
        
        return self._detect_with_gemini(image_path, metadata)
    
    def _detect_with_gemini(self, image_path: str, metadata: Dict[str, Any]) -> Tuple[List[str], List[float], Dict[str, Any]]:
        """Detect tools using Google Cloud AI (Gemini)"""
        logger.info("Using Google Cloud AI (Gemini) for tool detection")
        metadata["models_tried"].append("gemini")
        
        try:
            tags, confidences = self.gemini_detector.detect_tools(image_path)
            metadata["model_used"] = "gemini"
            metadata["confidence_scores"]["gemini"] = {
                "avg_confidence": sum(confidences) / len(confidences) if confidences else 0,
                "max_confidence": max(confidences) if confidences else 0,
                "tool_count": len(tags)
            }
            
            logger.info(f"Google Cloud AI detection completed: {len(tags)} tools found")
            return tags, confidences, metadata
            
        except Exception as e:
            logger.error(f"Google Cloud AI detection failed: {e}")
            metadata["error"] = str(e)
            return [], [], metadata
    
    def get_available_models(self) -> Dict[str, bool]:
        """Get information about available models"""
        return {
            "gemini": self.gemini_detector.is_available()
        }
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get detailed information about the Google Cloud AI model"""
        info = {
            "unified_detector": {
                "model": "google_cloud_ai",
                "available_models": self.get_available_models()
            }
        }
        
        if self.gemini_detector.is_available():
            info["gemini"] = self.gemini_detector.get_detection_info()
        
        return info


# Global instance
unified_detector = None

def get_unified_detector() -> UnifiedToolDetector:
    """Get or create the global unified detector instance"""
    global unified_detector
    if unified_detector is None:
        unified_detector = UnifiedToolDetector()
    return unified_detector
