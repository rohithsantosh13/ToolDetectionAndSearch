"""
Google Gemini Image Understanding Service

This service provides construction tool detection using Google's Gemini 2.5 Flash model.
It offers cloud-based AI processing as an alternative to local models.
"""

import os
import json
import logging
from typing import List, Tuple, Optional
from google import genai
from google.genai import types
import requests
from PIL import Image
import io

logger = logging.getLogger(__name__)


class GeminiToolDetector:
    """Tool detection service using Google Gemini"""
    
    def __init__(self):
        """Initialize the Gemini tool detector"""
        self.api_key = os.getenv("GOOGLE_API_KEY")
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        
        if not self.api_key:
            logger.warning("GOOGLE_API_KEY not set. Gemini service will not be available.")
            self.client = None
        else:
            try:
                self.client = genai.Client(api_key=self.api_key)
                logger.info("Gemini client initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Gemini client: {e}")
                self.client = None
    
    def is_available(self) -> bool:
        """Check if Gemini service is available"""
        return self.client is not None
    
    def detect_tools(self, image_path: str) -> Tuple[List[str], List[float]]:
        """
        Detect tools in an image using Gemini
        
        Args:
            image_path: Path to the image file
            
        Returns:
            Tuple of (tags, confidences)
        """
        if not self.is_available():
            logger.error("Gemini service not available")
            return [], []
        
        try:
            # Load image
            image_bytes = self._load_image(image_path)
            if not image_bytes:
                return [], []
            
            # Create image part for Gemini
            image = types.Part.from_bytes(
                data=image_bytes, 
                mime_type="image/jpeg"
            )
            
            # Create prompt for construction tool analysis
            prompt = self._create_tool_detection_prompt()
            
            # Send request to Gemini
            logger.info("Sending request to Gemini for tool detection...")
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=[prompt, image],
            )
            response_text = response.text.replace("```", "").replace("json", "").strip()
            # Parse response
            tags, confidences = self._parse_gemini_response(response_text)
            
            logger.info(f"Gemini detected {len(tags)} tools")
            print(tags)
            for i, tag in enumerate(tags):
                logger.info(f"Gemini #{i+1}: {tag}")
            
            return tags, confidences
            
        except Exception as e:
            logger.error(f"Error in Gemini tool detection: {e}")
            return [], []
    
    def _load_image(self, image_path: str) -> Optional[bytes]:
        """Load image from file and return as bytes"""
        try:
            with open(image_path, "rb") as image_file:
                return image_file.read()
        except Exception as e:
            logger.error(f"Error loading image: {e}")
            return None
    
    def _create_tool_detection_prompt(self) -> str:
        """Create the prompt for tool detection"""
        return """
        You are an AI vision model trained to identify construction-related tools, hardware, and equipment from images.

        Analyze the given image and return all visible **construction tools, hardware, or equipment** — including any items used for **building, renovation, plumbing, electrical work, woodworking, landscaping, grass cutting, or lawn maintenance** commonly found in the United States.

        Your task:
        - Identify and label each item as specifically as possible.
        - Include the **brand name, tool model, and full tool name** (for example: “Milwaukee M12 FUEL 12V Lithium-Ion Brushless Cordless 1/4 in. Hex Impact Driver (Tool-Only)” or “DEWALT 20V MAX XR Cordless Brushless 1/4 in. 3-Speed Impact Driver”).
        - Exclude any **people, vehicles, furniture, packaging, or irrelevant background objects.**
        - Focus **only** on actual construction tools, hardware, and work equipment.
        - Do not include generic or vague labels like “tool” or “machine.”

        Return the result **strictly in the following JSON format** (no explanations, no extra text):

        {tags: [specific tool names with brand and model]}
        
        """
    
    def _parse_gemini_response(self, response_text: str) -> Tuple[List[str], List[float]]:
        """Parse Gemini response and extract tools"""
        tags = []
        
        try:
            # Try to parse as JSON
            data = json.loads(response_text)

            if "tags" in data and isinstance(data["tags"], list):
                # Extract tags directly from the simple JSON format
                tags = [tag.strip() for tag in data["tags"] if tag.strip()]
                logger.info(f"Extracted {len(tags)} tags from JSON response")
            else:
                logger.warning("No 'tags' array found in JSON response")
                    
        except json.JSONDecodeError:
            # If not JSON, try to extract tool names from text
            logger.warning("Failed to parse JSON response, attempting text extraction")
            lines = response_text.split('\n')
            for line in lines:
                line = line.strip()
                if line and ('tool' in line.lower() or 'hammer' in line.lower() or 'drill' in line.lower()):
                    # Extract potential tool names
                    words = line.split()
                    for word in words:
                        if any(tool_word in word.lower() for tool_word in ['tool', 'hammer', 'drill', 'wrench', 'saw']):
                            tags.append(word.strip('.,!?'))
                            break
        
        # Remove duplicates and empty strings
        unique_tags = list(set([tag for tag in tags if tag]))
        
        # Create dummy confidence scores (all 1.0 since we're not using confidence)
        confidences = [1.0] * len(unique_tags)
        
        return unique_tags, confidences
    
    def _deduplicate_results(self, tags: List[str], confidences: List[float]) -> Tuple[List[str], List[float]]:
        """Remove duplicate tags and keep highest confidence"""
        if not tags:
            return [], []
        
        # Create dictionary to track highest confidence for each tag
        tag_confidence_map = {}
        for tag, conf in zip(tags, confidences):
            if tag not in tag_confidence_map or conf > tag_confidence_map[tag]:
                tag_confidence_map[tag] = conf
        
        # Sort by confidence (highest first)
        sorted_items = sorted(tag_confidence_map.items(), key=lambda x: x[1], reverse=True)
        
        unique_tags = [item[0] for item in sorted_items]
        unique_confidences = [item[1] for item in sorted_items]
        
        return unique_tags, unique_confidences
    
    def get_detection_info(self) -> dict:
        """Get information about the Gemini service"""
        return {
            "service": "gemini",
            "model": self.model_name,
            "available": self.is_available(),
            "api_key_set": bool(self.api_key)
        }


# Global instance
gemini_detector = None

def get_gemini_detector() -> GeminiToolDetector:
    """Get or create the global Gemini detector instance"""
    global gemini_detector
    if gemini_detector is None:
        gemini_detector = GeminiToolDetector()
    return gemini_detector
