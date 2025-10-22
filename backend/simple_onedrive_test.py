import msal
import requests
import json
from datetime import datetime


def get_access_token():
    """
    Get access token using MSAL
    """
    CLIENT_ID = "4d0d66fa-1500-469c-ba3b-755441c92823"
    CLIENT_SECRET = "aRn8Q~RMEr4Xwm6v1kWobAK6xmeja0dF4c0NLcUL"
    TENANT_ID = "5dfaa4ab-53c5-40a3-befd-b183604fc0f1"

    authority = f"https://login.microsoftonline.com/{TENANT_ID}"
    scopes = ["https://graph.microsoft.com/.default"]

    app = msal.ConfidentialClientApplication(
        CLIENT_ID,
        authority=authority,
        client_credential=CLIENT_SECRET
    )

    result = app.acquire_token_for_client(scopes=scopes)
    print("Token result:", result)

    if "access_token" in result:
        return result["access_token"]
    else:
        print(f"Error: {result.get('error_description')}")
        return None




def upload_to_onedrive(access_token, file_content, filename):
    """
    Upload a file to SharePoint using Microsoft Graph API with application permissions
    """
    try:
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/octet-stream'
        }
        
        # Use your SharePoint site ID and upload to ToolDetectionImages folder
        site_id = "90cf8811-a62e-4db5-82e2-2aa9c2015210"
        folder_name = "ToolDetectionImages"
        upload_url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drive/root:/{folder_name}/{filename}:/content"
        
        print(f"🏢 Uploading to SharePoint site: {site_id}")
        print(f"📁 Target folder: {folder_name}")
        print(f"🔄 Upload URL: {upload_url}")
        response = requests.put(upload_url, headers=headers, data=file_content)
        
        print(f"📊 Response status: {response.status_code}")
        
        if response.status_code in [200, 201]:
            file_data = response.json()
            print(f"✅ Upload successful!")
            print(f"📁 File ID: {file_data.get('id')}")
            print(f"🔗 Web URL: {file_data.get('webUrl')}")
            print(f"📥 Download URL: {file_data.get('@microsoft.graph.downloadUrl')}")
            return True
        else:
            print(f"❌ Upload failed: {response.status_code}")
            print(f"📄 Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        return False


def test_upload():
    """
    Test the complete upload process
    """
    print("🚀 Starting OneDrive Upload Test")
    print("=" * 50)
    
    # Get access token
    print("🔐 Getting access token...")
    access_token = get_access_token()
    
    if not access_token:
        print("❌ Failed to get access token")
        return False
    
    print("✅ Access token obtained")
    
    # Read requirements.txt file
    requirements_file = "requirements.txt"
    try:
        with open(requirements_file, 'rb') as f:
            file_content = f.read()
        
        print(f"📁 Reading file: {requirements_file}")
        print(f"📄 File size: {len(file_content)} bytes")
        print(f"📄 Content preview: {file_content.decode()[:200]}...")
        
        # Upload the file
        print("\n📤 Uploading to SharePoint...")
        success = upload_to_onedrive(access_token, file_content, requirements_file)
        
        if success:
            print("🎉 Upload completed successfully!")
            return True
        else:
            print("💥 Upload failed!")
            return False
            
    except FileNotFoundError:
        print(f"❌ File not found: {requirements_file}")
        print("Please make sure requirements.txt exists in the current directory")
        return False
    except Exception as e:
        print(f"❌ Error reading file: {str(e)}")
        return False


if __name__ == "__main__":
    test_upload()