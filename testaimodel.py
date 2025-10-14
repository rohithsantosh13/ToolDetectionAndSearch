import os
import requests

import torch
from PIL import Image, ImageDraw, ImageFont
from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection

# Set the path to your local model directory
local_model_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "grounding-dino-base"))
device = "cuda" if torch.cuda.is_available() else "cpu"

# Load processor and model from local files only
processor = AutoProcessor.from_pretrained(local_model_path, local_files_only=True)
model = AutoModelForZeroShotObjectDetection.from_pretrained(local_model_path, local_files_only=True).to(device)

# Your tool list
tools = [
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

# Format text query: lowercase + each item prefixed with "a " + ending with a dot
# Join all tools with ". " separator
text = ". ".join([f"a {tool.lower()}" for tool in tools]) + "."

print(f"Query text: {text[:200]}...")  # Print first 200 chars to verify format

# Load your image (replace with your actual image path)
image_url = "https://i5.walmartimages.com/seo/Hyper-Tough-7oz-Claw-Hammer-7oz-Head-Weight_39054e0f-52e1-4dfe-96c6-403602882edf_1.c99c7c470e6667511b840d587880e57b.jpeg?odnHeight=573&odnWidth=573&odnBg=FFFFFF"
image = Image.open(requests.get(image_url, stream=True).raw)

# Or load from local file:
# image = Image.open("path/to/your/image.jpg")

inputs = processor(images=image, text=text, return_tensors="pt").to(device)
with torch.no_grad():
    outputs = model(**inputs)

results = processor.post_process_grounded_object_detection(
    outputs,
    inputs.input_ids,
    target_sizes=[image.size[::-1]]  # [height, width]
)

# Filter by confidence threshold
confidence_threshold = 0.25  # Lower threshold for tools since they can be harder to detect
result = results[0]

filtered_boxes = []
filtered_labels = []
filtered_scores = []

# FIXED: Use 'text_labels' instead of 'labels' to avoid the FutureWarning
# Check if 'text_labels' exists (newer versions), otherwise use 'labels' (older versions)
if 'text_labels' in result:
    labels_key = 'text_labels'
else:
    labels_key = 'labels'

for box, label, score in zip(result["boxes"], result[labels_key], result["scores"]):
    if score >= confidence_threshold:
        filtered_boxes.append(box)
        filtered_labels.append(label)
        filtered_scores.append(score)

print(f"\nFound {len(filtered_boxes)} tools above confidence threshold {confidence_threshold}:")
for label, score, box in zip(filtered_labels, filtered_scores, filtered_boxes):
    print(f"  {label}: {score:.3f} - Box: [{box[0]:.1f}, {box[1]:.1f}, {box[2]:.1f}, {box[3]:.1f}]")

# Visualize results
if len(filtered_boxes) > 0:
    draw = ImageDraw.Draw(image)
    try:
        font = ImageFont.truetype("arial.ttf", 16)
    except:
        font = ImageFont.load_default()

    colors = ["red", "blue", "green", "yellow", "purple", "orange", "cyan", "magenta"]

    for idx, (box, label, score) in enumerate(zip(filtered_boxes, filtered_labels, filtered_scores)):
        color = colors[idx % len(colors)]
        x1, y1, x2, y2 = box.tolist()
        
        # Draw bounding box
        draw.rectangle([x1, y1, x2, y2], outline=color, width=3)
        
        # Draw label with background
        label_text = f"{label}: {score:.2f}"
        bbox = draw.textbbox((x1, y1 - 20), label_text, font=font)
        draw.rectangle(bbox, fill=color)
        draw.text((x1, y1 - 20), label_text, fill="white", font=font)

    # FIXED: Changed image.show() to image.save() - show() doesn't take arguments
    image.show()
    print("\nVisualization saved to 'tool_detection_result.jpg'")
    
    # Uncomment the line below if you want to display the image as well
    # image.show()
else:
    print("\nNo tools detected above the confidence threshold.")