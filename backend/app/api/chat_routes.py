"""
Chat API routes for the Tool Assistant
"""

import json
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.services.chat_service import chat_service

router = APIRouter()

@router.post("/chat")
async def chat_endpoint(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Chat endpoint for non-streaming responses
    """
    try:
        data = await request.json()
        messages = data.get('messages', [])
        
        if not messages:
            raise HTTPException(status_code=400, detail="No messages provided")
        
        # Get the last user message
        user_message = None
        for message in reversed(messages):
            if message.get('role') == 'user':
                user_message = message.get('content', '')
                break
        
        if not user_message:
            raise HTTPException(status_code=400, detail="No user message found")
        
        # Generate response
        response = await chat_service.generate_response(user_message, db)
        
        return {
            "response": response,
            "timestamp": "2024-01-01T12:00:00Z",
            "user_tools_count": 0  # Will be updated with actual count
        }
        
    except Exception as e:
        print(f"Chat endpoint error: {e}")
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")

@router.post("/chat/stream")
async def chat_stream_endpoint(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Streaming chat endpoint using Server-Sent Events
    """
    try:
        data = await request.json()
        messages = data.get('messages', [])
        
        if not messages:
            raise HTTPException(status_code=400, detail="No messages provided")
        
        # Get the last user message
        user_message = None
        for message in reversed(messages):
            if message.get('role') == 'user':
                user_message = message.get('content', '')
                break
        
        if not user_message:
            raise HTTPException(status_code=400, detail="No user message found")
        
        async def generate_stream():
            try:
                async for chunk in chat_service.generate_streaming_response(user_message, db):
                    # Format as Server-Sent Events
                    yield f"data: {json.dumps({'content': chunk, 'done': False})}\n\n"
                
                # Send completion signal
                yield f"data: {json.dumps({'content': '', 'done': True})}\n\n"
                
            except Exception as e:
                print(f"Streaming error: {e}")
                yield f"data: {json.dumps({'content': 'I encountered an error. Please try again.', 'done': True, 'error': True})}\n\n"
        
        return StreamingResponse(
            generate_stream(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream"
            }
        )
        
    except Exception as e:
        print(f"Chat stream endpoint error: {e}")
        raise HTTPException(status_code=500, detail=f"Chat stream error: {str(e)}")

@router.get("/chat/tool-categories")
async def get_tool_categories():
    """
    Get available tool categories
    """
    return {
        "categories": [
            "Hand Tools",
            "Power Tools", 
            "Measuring Tools",
            "Safety Equipment",
            "Fasteners",
            "Electrical Tools",
            "Plumbing Tools",
            "Woodworking Tools",
            "Metalworking Tools",
            "Garden Tools"
        ]
    }

@router.get("/chat/task-requirements")
async def get_task_requirements():
    """
    Get common task requirements
    """
    return {
        "common_tasks": [
            "Hanging a picture",
            "Installing a shelf",
            "Fixing a leaky faucet",
            "Installing a light fixture",
            "Building a deck",
            "Installing drywall",
            "Painting a room",
            "Installing flooring",
            "Electrical work",
            "Plumbing repairs"
        ]
    }

@router.post("/chat/plan-task")
async def plan_task_endpoint(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Plan a specific task with tool requirements
    """
    try:
        data = await request.json()
        task_description = data.get('task', '')
        
        if not task_description:
            raise HTTPException(status_code=400, detail="Task description required")
        
        # Generate task plan
        plan = await chat_service.plan_task(task_description, db)
        
        return plan
        
    except Exception as e:
        print(f"Task planning error: {e}")
        raise HTTPException(status_code=500, detail=f"Task planning error: {str(e)}")

@router.get("/chat/inventory")
async def get_inventory_endpoint(
    db: Session = Depends(get_db)
):
    """
    Get user's tool inventory
    """
    try:
        inventory = await chat_service.get_user_inventory(db)
        return inventory
        
    except Exception as e:
        print(f"Inventory error: {e}")
        raise HTTPException(status_code=500, detail=f"Inventory error: {str(e)}")
