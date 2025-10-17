"""
Direct Object Detection using Google Gemini Image Understanding API

This script uses Google's Gemini 2.5 Flash model for construction tool detection and analysis.
It provides a cloud-based AI approach for identifying construction hardware tools.

Usage:
1. Set your Google API key: export GOOGLE_API_KEY="your_api_key_here"
2. Run: python test_gemini_direct.py
3. The script will analyze the image and provide detailed tool identification

Requirements:
- Google API key (get from https://aistudio.google.com/app/apikey)
- google-genai package (already installed)
"""

import os
import requests
from google import genai
from google.genai import types
import json
from datetime import datetime

# Configuration
CONFIG = {
    "gemini_model": "gemini-2.5-flash",
    "confidence_threshold": 0.5,  # For future use if we add confidence scoring
    "save_analysis": True,
    "output_file": "gemini_analysis_result.txt"
}

def setup_gemini_client():
    """Initialize Gemini client with API key"""
    try:
        # Check for API key in environment variable
        api_key = os.getenv('GOOGLE_API_KEY')
        api_key = "AIzaSyBUQr3HP2R6qFfj9pB2IvFern2BZ_hMh1I"
        if not api_key:
            print("Error: GOOGLE_API_KEY environment variable not set!")
            print("Please set your API key:")
            print("1. Get your API key from: https://aistudio.google.com/app/apikey")
            print("2. Set it as environment variable: set GOOGLE_API_KEY=your_api_key_here")
            return None
        
        # Initialize the client
        client = genai.Client(api_key=api_key)
        print("Gemini client initialized successfully")
        return client
    
    except Exception as e:
        print(f"Error initializing Gemini client: {e}")
        return None

def load_image_from_url_or_path(image_path_or_url):
    """Load image from URL or local path and return as bytes"""
    try:
        if image_path_or_url.startswith('http'):
            # Handle URL
            response = requests.get(image_path_or_url, stream=True)
            response.raise_for_status()
            return response.content
        else:
            # Handle local file
            with open(image_path_or_url, "rb") as image_file:
                return image_file.read()
    
    except Exception as e:
        print(f"Error loading image: {e}")
        return None

def analyze_construction_tools_with_gemini(client, image_path_or_url):
    """Use Gemini to directly analyze construction tools in an image"""
    
    # Load image
    image_bytes = load_image_from_url_or_path(image_path_or_url)
    if not image_bytes:
        return "Failed to load image"
    
    # Create image part for Gemini
    image = types.Part.from_bytes(
        data=image_bytes, 
        mime_type="image/jpeg"
    )
    
    # Create comprehensive prompt for construction tool analysis
    prompt = """
        You are an AI vision model trained to identify construction-related tools, hardware, and equipment from images.

        Analyze the given image and return all visible **construction tools, hardware, or equipment** — including any items used for **building, renovation, plumbing, electrical work, woodworking, landscaping, grass cutting, or lawn maintenance** commonly found in the United States.

        Your task:
        - Identify and label each item as specifically as possible.
        - Include the **brand name, tool model, and full tool name** (for example: “Milwaukee M12 FUEL 12V Lithium-Ion Brushless Cordless 1/4 in. Hex Impact Driver (Tool-Only)” or “DEWALT 20V MAX XR Cordless Brushless 1/4 in. 3-Speed Impact Driver”).
        - Exclude any **people, vehicles, furniture, packaging, or irrelevant background objects.**
        - Focus **only** on actual construction tools, hardware, and work equipment.
        - Do not include generic or vague labels like “tool” or “machine.”

        Return the result **strictly in the following JSON format** (no explanations, no extra text):

        {
            "tags": [
                "specific tool name with brand and model"
            ]
        }
        """

    try:
        print(f"[Gemini] Analyzing image for construction tools...")
        
        response = client.models.generate_content(
            model=CONFIG['gemini_model'],
            contents=[prompt, image],
        )
        
        return response.text
    
    except Exception as e:
        print(f"Error using Gemini: {e}")
        return f"Gemini analysis failed: {e}"

def save_analysis(analysis, image_source):
    """Save analysis results to file"""
    if not CONFIG['save_analysis']:
        return
    
    try:
        with open(CONFIG['output_file'], 'w', encoding='utf-8') as f:
            f.write(f"Gemini Construction Tool Analysis\n")
            f.write(f"Image Source: {image_source}\n")
            f.write(f"Model: {CONFIG['gemini_model']}\n")
            f.write(f"Analysis Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("=" * 60 + "\n\n")
            f.write(analysis)
        
        print(f"Analysis saved to {CONFIG['output_file']}")
    except Exception as e:
        print(f"Error saving analysis: {e}")

def parse_gemini_response(response_text):
    """Parse and format the Gemini response for better display"""
    try:
        # Try to parse as JSON
        data = json.loads(response_text)
        
        print("\n🔍 CONSTRUCTION TOOL DETECTION RESULTS")
        print("=" * 50)
        
        if 'scene_description' in data:
            print(f"📋 Scene: {data['scene_description']}")
        
        if 'tools_detected' in data:
            print(f"\n🛠️  Tools Found ({len(data['tools_detected'])}):")
            for i, tool in enumerate(data['tools_detected'], 1):
                confidence_emoji = {"High": "🟢", "Medium": "🟡", "Low": "🔴"}.get(tool.get('confidence', 'Unknown'), "⚪")
                print(f"  {i}. {tool.get('name', 'Unknown')} {confidence_emoji}")
                print(f"     Category: {tool.get('category', 'Unknown')}")
                if tool.get('notes'):
                    print(f"     Notes: {tool['notes']}")
                print()
        
        if 'summary' in data:
            summary = data['summary']
            print(f"📊 Summary:")
            print(f"   Total Tools: {summary.get('total_tools', 'Unknown')}")
            print(f"   Categories: {', '.join(summary.get('categories', []))}")
            print(f"   Overall Confidence: {summary.get('confidence_overall', 'Unknown')}")
        
        return data
        
    except json.JSONDecodeError:
        # If not JSON, display as plain text
        print("\n🔍 CONSTRUCTION TOOL DETECTION RESULTS")
        print("=" * 50)
        print(response_text)
        return response_text

def main():
    """Main function to run Gemini object detection"""
    
    print("Gemini Construction Tool Detection")
    print("=" * 50)
    
    # Initialize Gemini client
    client = setup_gemini_client()
    if not client:
        return
    
    # Image source - you can change this to your own image
    # image_url = "https://cdn.hswstatic.com/gif/level-1.jpg"
     # Uncomment to use local image instead:
    image_url = fr"C:\Users\rohit\Downloads\TestImgs\TestImg.jpeg"
    
    print(f"Analyzing image...")
    print(f"Image URL: {image_url[:80]}...")
    
    # Run Gemini analysis
    analysis = analyze_construction_tools_with_gemini(client, image_url)
    
    # Parse and display results
    parsed_result = parse_gemini_response(analysis)
    
    # Save results
    save_analysis(analysis, image_url)
    
    print(f"\nAnalysis complete!")
    print(f"Results saved to: {CONFIG['output_file']}")

if __name__ == "__main__":
    main()
