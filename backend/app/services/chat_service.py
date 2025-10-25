"""
AI Chat Service for Tool Assistant
Provides conversational AI with inventory awareness and task assistance
"""

import os
import json
import asyncio
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.database.queries import get_recent_images, get_images_by_tags, search_images
# from app.services.gemini_service import GeminiService


class ChatService:
    def __init__(self):
        # self.gemini_service = GeminiService()
        self.system_prompt = self._get_system_prompt()
    
    def _get_system_prompt(self) -> str:
        """Get the system prompt for the AI assistant"""
        return """You are a helpful tool assistant for a construction/DIY tool management app. You help users with:

1. **Tool Inventory Management**: Answer questions about what tools they have, quantities, and locations
2. **Task Planning**: Help plan projects by identifying required tools and checking availability
3. **Step-by-Step Guidance**: Provide detailed instructions for DIY tasks
4. **Tool Recommendations**: Suggest tools for specific tasks or projects

**Key Guidelines:**
- Always be helpful, clear, and concise
- Ask clarifying questions when you need more information
- When showing tool information, format it clearly with:
  - Tool name
  - Quantity available
  - Location (if available)
- For task planning, always check what tools are available vs. what's needed
- Mark available tools with ✅ and missing tools with ❌
- Provide step-by-step instructions when asked
- Be encouraging and supportive

**Response Format:**
- Use **bold** for important information
- Use bullet points for lists
- Use ✅ for available tools
- Use ❌ for missing tools
- Keep responses conversational but informative

Remember: You have access to the user's tool inventory, so always check what they have before making recommendations."""

    async def get_user_inventory(self, db: Session) -> Dict[str, Any]:
        """Get user's tool inventory with counts and locations"""
        try:
            # Get recent images (last 100)
            recent_images = get_recent_images(db, limit=100)
            
            # Count tools by type
            tool_counts = {}
            tool_locations = {}
            
            for image in recent_images:
                if image.tags:
                    for tag in image.tags:
                        tool_name = tag.lower().strip()
                        if tool_name:
                            tool_counts[tool_name] = tool_counts.get(tool_name, 0) + 1
                            
                            # Store location info
                            if image.latitude and image.longitude:
                                location_key = f"{image.latitude:.4f},{image.longitude:.4f}"
                                if tool_name not in tool_locations:
                                    tool_locations[tool_name] = []
                                tool_locations[tool_name].append({
                                    'location': location_key,
                                    'timestamp': image.created_at.isoformat() if image.created_at else None
                                })
            
            return {
                'total_tools': len(tool_counts),
                'tool_counts': tool_counts,
                'tool_locations': tool_locations,
                'recent_uploads': len(recent_images)
            }
        except Exception as e:
            print(f"Error getting user inventory: {e}")
            return {'total_tools': 0, 'tool_counts': {}, 'tool_locations': {}, 'recent_uploads': 0}

    async def get_tools_for_task(self, db: Session, task_description: str) -> Dict[str, Any]:
        """Get tools needed for a specific task"""
        try:
            # Search for relevant tools in inventory
            search_results = search_images(db, query=task_description, limit=50)
            
            relevant_tools = {}
            for image in search_results:
                if image.tags:
                    for tag in image.tags:
                        tool_name = tag.lower().strip()
                        if tool_name:
                            if tool_name not in relevant_tools:
                                relevant_tools[tool_name] = {
                                    'count': 0,
                                    'locations': [],
                                    'confidence': 0
                                }
                            relevant_tools[tool_name]['count'] += 1
                            if image.latitude and image.longitude:
                                relevant_tools[tool_name]['locations'].append({
                                    'lat': image.latitude,
                                    'lon': image.longitude
                                })
                            if image.confidences:
                                relevant_tools[tool_name]['confidence'] = max(
                                    relevant_tools[tool_name]['confidence'],
                                    max(image.confidences) if image.confidences else 0
                                )
            
            return relevant_tools
        except Exception as e:
            print(f"Error getting tools for task: {e}")
            return {}

    async def generate_response(self, user_message: str, db: Session) -> str:
        """Generate AI response with inventory context"""
        try:
            # Get user's inventory
            inventory = await self.get_user_inventory(db)
            
            # Create context about user's tools
            inventory_context = self._format_inventory_context(inventory)
            
            # Create the prompt
            prompt = f"""User's Tool Inventory:
{inventory_context}

User Question: {user_message}

Please provide a helpful response based on their inventory and question. If they're asking about a specific task, check what tools they have available and what they might need."""

            # Get response from simple AI (fallback)
            response = await self._generate_simple_response(user_message, inventory)
            return response
            
        except Exception as e:
            print(f"Error generating response: {e}")
            return "I'm sorry, I encountered an error while processing your request. Please try again."

    def _format_inventory_context(self, inventory: Dict[str, Any]) -> str:
        """Format inventory data for the AI context"""
        if inventory['total_tools'] == 0:
            return "No tools found in inventory."
        
        context = f"Total tools in inventory: {inventory['total_tools']}\n\n"
        context += "Tool inventory:\n"
        
        for tool_name, count in inventory['tool_counts'].items():
            context += f"- {tool_name}: {count} available\n"
            if tool_name in inventory['tool_locations']:
                locations = inventory['tool_locations'][tool_name]
                if locations:
                    context += f"  Locations: {len(locations)} different locations\n"
        
        return context

    async def _generate_simple_response(self, user_message: str, inventory: Dict[str, Any]) -> str:
        """Generate a simple response without external AI service"""
        message_lower = user_message.lower()
        
        # Check for inventory questions
        if any(word in message_lower for word in ['how many', 'what tools', 'inventory', 'tools do i have']):
            if inventory['total_tools'] == 0:
                return "You don't have any tools in your inventory yet. Try uploading some tool images to get started!"
            
            response = f"You have **{inventory['total_tools']}** tools in your inventory:\n\n"
            for tool_name, count in inventory['tool_counts'].items():
                response += f"✅ **{tool_name}**: {count} available\n"
            
            return response
        
        # Check for task planning questions
        elif any(word in message_lower for word in ['how to', 'plan', 'task', 'project', 'install', 'build', 'fix']):
            return f"I'd be happy to help you plan that task! Based on your inventory of **{inventory['total_tools']}** tools, I can help you figure out what you need. Could you provide more details about the specific task you want to accomplish?"
        
        # Check for tool recommendations
        elif any(word in message_lower for word in ['recommend', 'suggest', 'need for', 'tools for']):
            return f"Based on your current inventory of **{inventory['total_tools']}** tools, I can help recommend what you might need. What specific type of work or project are you planning?"
        
        # Default response
        else:
            return f"Hello! I can help you with your tool inventory. You currently have **{inventory['total_tools']}** tools. Ask me about:\n\n• **Tool inventory**: \"How many hammers do I have?\"\n• **Task planning**: \"What tools do I need to hang a picture?\"\n• **Step-by-step guides**: \"Show me how to install a shelf\"\n• **Tool recommendations**: \"What tools do I need for electrical work?\""

    async def _generate_task_plan(self, task_description: str, available_tools: List[Dict], missing_tools: List[str]) -> str:
        """Generate a simple task plan"""
        plan = f"**Task Plan: {task_description}**\n\n"
        
        if available_tools:
            plan += "**✅ Available Tools:**\n"
            for tool in available_tools:
                plan += f"• {tool['name']} ({tool['count']} available)\n"
        
        if missing_tools:
            plan += "\n**❌ Missing Tools:**\n"
            for tool in missing_tools:
                plan += f"• {tool}\n"
        
        plan += "\n**📋 Steps:**\n"
        plan += "1. Gather all required tools\n"
        plan += "2. Prepare your workspace\n"
        plan += "3. Follow safety guidelines\n"
        plan += "4. Complete the task step by step\n"
        plan += "5. Clean up and store tools\n\n"
        plan += "**⚠️ Safety First:** Always wear appropriate safety gear and follow proper procedures!"
        
        return plan

    async def generate_streaming_response(self, user_message: str, db: Session):
        """Generate streaming response with inventory context"""
        try:
            # Get user's inventory
            inventory = await self.get_user_inventory(db)
            
            # Create context about user's tools
            inventory_context = self._format_inventory_context(inventory)
            
            # Create the prompt
            prompt = f"""User's Tool Inventory:
{inventory_context}

User Question: {user_message}

Please provide a helpful response based on their inventory and question. If they're asking about a specific task, check what tools they have available and what they might need."""

            # Stream response from simple AI (fallback)
            response = await self._generate_simple_response(user_message, inventory)
            # Simulate streaming by yielding chunks
            words = response.split()
            for i, word in enumerate(words):
                yield word + " "
                await asyncio.sleep(0.05)  # Small delay for streaming effect
                
        except Exception as e:
            print(f"Error generating streaming response: {e}")
            yield "I'm sorry, I encountered an error while processing your request. Please try again."

    async def plan_task(self, task_description: str, db: Session) -> Dict[str, Any]:
        """Plan a task with tool requirements and availability"""
        try:
            # Get tools needed for the task
            relevant_tools = await self.get_tools_for_task(db, task_description)
            
            # Get full inventory
            inventory = await self.get_user_inventory(db)
            
            # Analyze what's available vs needed
            available_tools = []
            missing_tools = []
            
            for tool_name, tool_info in relevant_tools.items():
                if tool_info['count'] > 0:
                    available_tools.append({
                        'name': tool_name,
                        'count': tool_info['count'],
                        'locations': tool_info['locations'],
                        'confidence': tool_info['confidence']
                    })
                else:
                    missing_tools.append(tool_name)
            
            # Generate task plan
            plan_response = await self._generate_task_plan(task_description, available_tools, missing_tools)
            
            return {
                'task': task_description,
                'available_tools': available_tools,
                'missing_tools': missing_tools,
                'plan': plan_response,
                'total_available': len(available_tools),
                'total_missing': len(missing_tools)
            }
            
        except Exception as e:
            print(f"Error planning task: {e}")
            return {
                'task': task_description,
                'available_tools': [],
                'missing_tools': [],
                'plan': "I'm sorry, I couldn't create a task plan. Please try again.",
                'total_available': 0,
                'total_missing': 0
            }


# Global chat service instance
chat_service = ChatService()
