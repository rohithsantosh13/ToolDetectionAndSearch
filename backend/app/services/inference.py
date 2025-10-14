"""
ML inference service for tool detection using YOLOv8 + CLIP
"""

import os
import cv2
import numpy as np
from typing import List, Tuple, Optional
from PIL import Image
import torch
from ultralytics import YOLO
from transformers import CLIPProcessor, CLIPModel
import logging

logger = logging.getLogger(__name__)


class ToolDetector:
    """Tool detection service using YOLOv8 + CLIP"""
    
    def __init__(self):
        """Initialize the tool detector with YOLOv8 and CLIP models"""
        self.yolo_model_path = os.getenv("YOLO_MODEL", "yolov8n.pt")
        self.clip_model_name = os.getenv("CLIP_MODEL", "openai/clip-vit-base-patch32")
        self.confidence_threshold = float(os.getenv("CONFIDENCE_THRESHOLD", "0.3"))
        
        # Tool classes for CLIP zero-shot classification
        self.tool_classes = [
            "hammer", "drill", "wrench", "screwdriver", "pliers",
            "saw", "measuring tape", "level", "chisel", "clamp",
            "screw", "nail", "bolt", "nut", "cable", "wire",
            "pipe", "tube", "connector", "adapter", "socket",
            "ratchet", "torque wrench", "multimeter", "flashlight",
            "knife", "scissors", "tape measure", "ruler", "protractor",
            "tool", "hand tool", "power tool", "construction tool",
            "workshop tool", "repair tool", "maintenance tool",
            "cutting tool", "measuring tool", "fastening tool",
            "spanner", "mallet", "crowbar", "pry bar", "file", "rasp",
            "vise", "bench vise", "C-clamp", "spring clamp", "bar clamp",
            "drill bit", "screwdriver bit", "hex key", "allen wrench",
            "adjustable wrench", "combination wrench", "box wrench",
            "crescent wrench", "pipe wrench", "monkey wrench"
        ]
        
        self._load_models()
    
    def _load_models(self):
        """Load YOLOv8 and CLIP models"""
        try:
            # Load YOLOv8 model
            logger.info(f"Loading YOLOv8 model: {self.yolo_model_path}")
            self.yolo = YOLO(self.yolo_model_path)
            
            # Load CLIP model
            logger.info(f"Loading CLIP model: {self.clip_model_name}")
            self.clip_model = CLIPModel.from_pretrained(self.clip_model_name)
            self.clip_processor = CLIPProcessor.from_pretrained(self.clip_model_name)
            
            logger.info("Models loaded successfully")
            
        except Exception as e:
            logger.error(f"Error loading models: {e}")
            raise
    
    def detect_tools(self, image_path: str) -> Tuple[List[str], List[float]]:
        """
        Detect tools in an image using YOLOv8 and CLIP
        
        Args:
            image_path: Path to the image file
            
        Returns:
            Tuple of (tags, confidences)
        """
        tags = []
        confidences = []
        
        try:
            # First, try YOLOv8 detection
            yolo_tags, yolo_confidences = self._yolo_detection(image_path)
            tags.extend(yolo_tags)
            confidences.extend(yolo_confidences)
            
            # Always try CLIP for better tool detection
            clip_tags, clip_confidences = self._clip_detection(image_path)
            tags.extend(clip_tags)
            confidences.extend(clip_confidences)
            
            # Remove duplicates and sort by confidence
            unique_results = self._deduplicate_results(tags, confidences)
            
            # Print final results
            if unique_results[0]:  # If we have results
                logger.info("=== FINAL DETECTED TOOLS ===")
                for i, (tag, conf) in enumerate(zip(unique_results[0], unique_results[1])):
                    logger.info(f"Final #{i+1}: {tag} - Confidence: {conf:.3f}")
            else:
                logger.info("=== NO TOOLS DETECTED ===")
            
            return unique_results[0], unique_results[1]
            
        except Exception as e:
            logger.error(f"Error in tool detection: {e}")
            return [], []
    
    def _yolo_detection(self, image_path: str) -> Tuple[List[str], List[float]]:
        """Perform YOLOv8 detection"""
        tags = []
        confidences = []
        
        try:
            # Run YOLOv8 inference
            results = self.yolo(image_path, conf=self.confidence_threshold)
            
            logger.info("=== YOLOv8 DETECTIONS ===")
            for i, result in enumerate(results):
                boxes = result.boxes
                if boxes is not None:
                    for j, box in enumerate(boxes):
                        confidence = float(box.conf[0])
                        class_id = int(box.cls[0])
                        class_name = self.yolo.names[class_id]
                        
                        logger.info(f"YOLOv8 #{j+1}: {class_name} - Confidence: {confidence:.3f}")
                        
                        # Map YOLO classes to tool-related terms
                        tool_mapping = {
                            "person": "hand tool",
                            "bottle": "container",
                            "cup": "container",
                            "bowl": "container",
                            "banana": "tool",  # Sometimes misclassified
                            "apple": "tool",   # Sometimes misclassified
                            "orange": "tool",  # Sometimes misclassified
                            "broccoli": "tool", # Sometimes misclassified
                            "carrot": "tool",  # Sometimes misclassified
                            "hot dog": "tool", # Sometimes misclassified
                            "pizza": "tool",   # Sometimes misclassified
                            "donut": "tool",   # Sometimes misclassified
                            "cake": "tool",    # Sometimes misclassified
                        }
                        
                        mapped_name = tool_mapping.get(class_name, class_name)
                        tags.append(mapped_name)
                        confidences.append(confidence)
                        
        except Exception as e:
            logger.error(f"Error in YOLOv8 detection: {e}")
        
        return tags, confidences
    
    def _clip_detection(self, image_path: str) -> Tuple[List[str], List[float]]:
        """Perform CLIP zero-shot classification"""
        tags = []
        confidences = []
        
        try:
            # Load and preprocess image
            image = Image.open(image_path).convert("RGB")
            
            # Prepare text prompts with multiple variations
            text_prompts = []
            for tool in self.tool_classes:
                text_prompts.extend([
                    f"a photo of a {tool}",
                    f"a {tool} on a workbench",
                    f"a {tool} in someone's hand",
                    f"a close-up of a {tool}",
                    f"a {tool} tool"
                ])
            
            # Process inputs
            inputs = self.clip_processor(
                text=text_prompts,
                images=image,
                return_tensors="pt",
                padding=True
            )
            
            # Get model outputs
            with torch.no_grad():
                outputs = self.clip_model(**inputs)
                logits_per_image = outputs.logits_per_image
                probs = logits_per_image.softmax(dim=-1)
            
            # Get top predictions
            top_probs, top_indices = torch.topk(probs, k=10)
            
            # Print CLIP detections
            logger.info("=== CLIP TOP 10 DETECTIONS ===")
            for i, (prob, idx) in enumerate(zip(top_probs[0], top_indices[0])):
                confidence = float(prob)
                # Map back to original tool class (divide by 5 since we have 5 variations)
                tool_idx = idx // 5
                if tool_idx < len(self.tool_classes):
                    tool_class = self.tool_classes[tool_idx]
                else:
                    tool_class = f"unknown_{idx}"
                logger.info(f"CLIP #{i+1}: {tool_class} - Confidence: {confidence:.3f}")
            
            # Group by tool class and get best confidence for each
            tool_confidence_map = {}
            for prob, idx in zip(top_probs[0], top_indices[0]):
                confidence = float(prob)
                # Map back to original tool class (divide by 5 since we have 5 variations)
                tool_idx = idx // 5
                if tool_idx < len(self.tool_classes):
                    tool_class = self.tool_classes[tool_idx]
                    if tool_class not in tool_confidence_map or confidence > tool_confidence_map[tool_class]:
                        tool_confidence_map[tool_class] = confidence
            
            # Add tools that meet confidence threshold
            for tool_class, confidence in tool_confidence_map.items():
                if confidence >= self.confidence_threshold:
                    tags.append(tool_class)
                    confidences.append(confidence)
                    
        except Exception as e:
            logger.error(f"Error in CLIP detection: {e}")
        
        return tags, confidences
    
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
        """Get information about the detection models"""
        return {
            "yolo_model": self.yolo_model_path,
            "clip_model": self.clip_model_name,
            "confidence_threshold": self.confidence_threshold,
            "tool_classes": self.tool_classes,
            "models_loaded": hasattr(self, 'yolo') and hasattr(self, 'clip_model')
        }


# Global instance
tool_detector = None

def get_tool_detector() -> ToolDetector:
    """Get or create the global tool detector instance"""
    global tool_detector
    if tool_detector is None:
        tool_detector = ToolDetector()
    return tool_detector
